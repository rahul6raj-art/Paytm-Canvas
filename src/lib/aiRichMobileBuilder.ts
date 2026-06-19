import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  extractTransactionsFromPrompt,
  extractUserNameFromPrompt,
  type ExtractedDesignTokens,
} from "@/lib/aiDesignTokens";
import { extractScreenTitle, type ScreenIntent } from "@/lib/aiScreenIntent";
import {
  extractGenericScreenSummary,
  extractProductNameFromPrompt,
  isActivityTrackingPrompt,
} from "@/lib/aiPromptExtract";
import { measureFlatContentHeight } from "@/lib/aiRichContentHeight";
import {
  activityIconForName,
  iconBadge,
  quickActionIcon,
  statIconForLabel,
  type RichIconKey,
} from "@/lib/aiRichIcons";
import { organizeRichScreenHierarchy } from "@/lib/aiRichStructure";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import type { AIGenerateResult } from "@/lib/aiMockGenerator";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import { getAIModelById } from "@/lib/aiModels";
import type { EditorNode } from "@/stores/useEditorStore";

const ROOT = EDITOR_ROOT_KEY;
const TAB_BAR_H = 64;
const STICKY_FOOTER_H = 88;
const MIN_SCREEN_HEIGHT = 280;

const RICH_SCREEN_INTENTS = new Set<ScreenIntent>([
  "mobile_home",
  "activity_tracking",
  "checkout",
  "profile",
  "auth",
  "recharge",
  "send_money",
  "transactions",
  "generic_mobile",
]);

export type RichMobileBuildOptions = {
  prompt: string;
  preset?: string;
  tokens: ExtractedDesignTokens;
  modelId: string;
  contextAttachmentCount?: number;
  title?: string;
};

type BuildCtx = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  nextId: () => string;
  tokens: ExtractedDesignTokens;
  layout: MobileLayout;
  frameId: string;
  contentId: string;
};

type MobileLayout = {
  w: number;
  h: number;
  gutter: number;
  contentW: number;
  cardPad: number;
  sectionGap: number;
  headerToCard: number;
  gridGap: number;
  radiusCard: number;
  radiusControl: number;
  scrollH: number;
};

const DEFAULT_QUICK_ACTIONS = [
  "Scan & Pay",
  "To Mobile",
  "To Bank",
  "Self Transfer",
  "UPI Lite",
  "Balance",
];

export type HomeSectionId =
  | "quick_actions"
  | "balance"
  | "fin_services"
  | "recharge"
  | "offers"
  | "travel"
  | "transactions";

const ALL_HOME_SECTIONS: HomeSectionId[] = [
  "quick_actions",
  "balance",
  "fin_services",
  "recharge",
  "offers",
  "travel",
  "transactions",
];

const SECTION_PROMPT_HINTS: { id: HomeSectionId; patterns: RegExp[] }[] = [
  { id: "quick_actions", patterns: [/quick action/i, /scan.{0,6}pay/i, /send money/i] },
  { id: "balance", patterns: [/upi balance/i, /available balance/i, /\bwallet\b/i, /upi id/i] },
  { id: "fin_services", patterns: [/financial service/i, /personal loan/i, /credit card/i, /mutual fund/i, /insurance/i] },
  { id: "recharge", patterns: [/recharge/i, /bill pay/i, /dth/i, /electricity/i, /broadband/i] },
  { id: "offers", patterns: [/cashback/i, /\boffer/i, /reward/i, /refer/i] },
  { id: "travel", patterns: [/travel/i, /flight/i, /train/i, /\bbus\b/i, /movie/i] },
  { id: "transactions", patterns: [/recent transaction/i, /transaction history/i, /passbook/i, /payment history/i] },
];

export function parseHomeSections(prompt: string): HomeSectionId[] {
  const t = prompt.toLowerCase();
  const excluded = new Set<HomeSectionId>();
  for (const section of ALL_HOME_SECTIONS) {
    const label = section.replace(/_/g, " ");
    if (new RegExp(`(?:skip|without|no|exclude|hide|omit)\\s+(?:the\\s+)?${label}`, "i").test(prompt)) {
      excluded.add(section);
    }
  }

  const picked = SECTION_PROMPT_HINTS.filter((s) => s.patterns.some((p) => p.test(t)))
    .map((s) => s.id)
    .filter((id) => !excluded.has(id));
  const minimal = /(minimal|simple|only|just)\b/i.test(prompt);

  if (minimal && picked.length >= 1) return picked;
  if (picked.length >= 4) return picked.filter((id) => !excluded.has(id));
  if (picked.length >= 2 && /(focus|emphasiz|highlight|primarily)/i.test(prompt)) {
    return picked.filter((id) => !excluded.has(id));
  }
  return ALL_HOME_SECTIONS.filter((id) => !excluded.has(id));
}

export function extractQuickActionsFromPrompt(prompt: string): string[] | undefined {
  const bullet = [...prompt.matchAll(/(?:^|\n)\s*[-•*]\s*([A-Za-z][A-Za-z0-9 &.'/-]{2,22})/g)].map((m) => m[1]!.trim());
  const actionLike = bullet.filter((l) =>
    /(pay|scan|transfer|recharge|balance|bank|mobile|upi|lite|send|receive)/i.test(l),
  );
  if (actionLike.length >= 3) return actionLike.slice(0, 6);

  const inline = prompt.match(/quick actions?[:\s]+([^\n.]{10,120})/i)?.[1];
  if (inline) {
    const parts = inline.split(/[,;|]/).map((s) => s.trim()).filter((s) => s.length >= 3);
    if (parts.length >= 3) return parts.slice(0, 6);
  }
  return undefined;
}

const FIN_SERVICES = [
  { title: "Personal Loan", sub: "Instant approval", color: "#dfedff" },
  { title: "Credit Card", sub: "Lifetime free", color: "#fff2cc" },
  { title: "Insurance", sub: "Family cover", color: "#dbf0e2" },
  { title: "Mutual Funds", sub: "Start SIP", color: "#f3e8ff" },
];

const RECHARGE = [
  "Mobile",
  "Electricity",
  "DTH",
  "Broadband",
  "Gas",
  "Water",
  "FASTag",
  "Metro",
];

const TRAVEL = ["Flights", "Trains", "Bus", "Movies"];

const TRANSACTIONS = [
  { merchant: "Swiggy", amount: "₹248", time: "Today, 2:14 PM" },
  { merchant: "Amazon Pay", amount: "₹1,299", time: "Yesterday" },
  { merchant: "Uber", amount: "₹186", time: "Mon, 9:40 PM" },
  { merchant: "Airtel Recharge", amount: "₹299", time: "Sun, 11:05 AM" },
];

const TABS = ["Home", "UPI", "Services", "Wealth", "Profile"];

function makeLayout(tokens: ExtractedDesignTokens, height = MIN_SCREEN_HEIGHT): MobileLayout {
  const w = tokens.shellWidth;
  const h = height;
  const gutter = tokens.gutter;
  return {
    w,
    h,
    gutter,
    contentW: w - gutter * 2,
    cardPad: tokens.cardPad,
    sectionGap: tokens.sectionGap,
    headerToCard: tokens.headerToCard,
    gridGap: tokens.gridGap,
    radiusCard: tokens.radiusCard,
    radiusControl: tokens.radiusControl,
    scrollH: h - TAB_BAR_H,
  };
}

function tintForAccent(tokens: ExtractedDesignTokens, accent: string): string {
  if (accent === tokens.primaryStrong || accent === tokens.brandPrimary || accent === tokens.primaryMedium) {
    return tokens.primaryWeak;
  }
  if (accent === tokens.notice) return tokens.noticeWeak;
  if (accent === tokens.positive) return "#dbf0e2";
  return tokens.surface3;
}

function colWidth(layout: MobileLayout, cols: number, gap = layout.gridGap): number {
  return (layout.contentW - gap * (cols - 1)) / cols;
}

function colX(layout: MobileLayout, col: number, cols: number, gap = layout.gridGap): number {
  const cw = colWidth(layout, cols, gap);
  return layout.gutter + col * (cw + gap);
}

function centerInCell(cellX: number, cellW: number, size: number): number {
  return cellX + (cellW - size) / 2;
}

function nid(ctx: BuildCtx, prefix: string): string {
  return `${prefix}-${ctx.nextId()}`;
}

function addChild(ctx: BuildCtx, parentId: string, childId: string) {
  if (!ctx.childOrder[parentId]) ctx.childOrder[parentId] = [];
  ctx.childOrder[parentId]!.push(childId);
}

function rect(
  ctx: BuildCtx,
  parentId: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  radius = 0,
  stroke?: string,
  gradient?: { from: string; to: string; rotation?: number },
): string {
  const id = nid(ctx, "r");
  const resolvedFill = gradient?.from ?? fill;
  ctx.nodes[id] = {
    id,
    parentId,
    type: "rectangle",
    name,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: resolvedFill,
    cornerRadius: radius,
    strokeColor: stroke ?? ctx.tokens.hairline,
    strokeWidth: stroke ? 1 : 0,
  };
  addChild(ctx, parentId, id);
  return id;
}

/** Per-corner radii: top-left, top-right, bottom-right, bottom-left. */
function rectRadii(
  ctx: BuildCtx,
  parentId: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  radii: [number, number, number, number],
  stroke?: string,
): string {
  const id = nid(ctx, "r");
  const uniform = radii.every((r) => r === radii[0]);
  ctx.nodes[id] = {
    id,
    parentId,
    type: "rectangle",
    name,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill,
    cornerRadius: uniform ? radii[0] : undefined,
    cornerRadii: uniform ? undefined : [...radii],
    strokeColor: stroke ?? ctx.tokens.hairline,
    strokeWidth: stroke ? 1 : 0,
  };
  addChild(ctx, parentId, id);
  return id;
}

function ellipse(ctx: BuildCtx, parentId: string, name: string, x: number, y: number, size: number, fill: string): string {
  const id = nid(ctx, "e");
  ctx.nodes[id] = {
    id,
    parentId,
    type: "ellipse",
    name,
    x,
    y,
    width: size,
    height: size,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill,
  };
  addChild(ctx, parentId, id);
  return id;
}

function text(
  ctx: BuildCtx,
  parentId: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  size: number,
  weight: number,
  color: string,
  lineHeight: number,
  align: "left" | "center" | "right" = "left",
  verticalAlign: "top" | "middle" | "bottom" = "top",
  resizeMode: "auto-width" | "auto-height" | "fixed" = "auto-width",
): string {
  const id = nid(ctx, "t");
  ctx.nodes[id] = {
    id,
    parentId,
    type: "text",
    name,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content,
    fill: color,
    fontSize: size,
    fontWeight: weight,
    fontFamily: ctx.tokens.fontFamily,
    lineHeight: lineHeight / size,
    textAlign: align,
    verticalAlign,
    textResizeMode: resizeMode,
    autoResize: resizeMode === "fixed" ? "none" : resizeMode === "auto-height" ? "height" : "width-height",
  };
  addChild(ctx, parentId, id);
  return id;
}

/** Center text horizontally and vertically inside a fixed box (grid cells, buttons, tabs). */
function boxText(
  ctx: BuildCtx,
  parentId: string,
  name: string,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  content: string,
  size: number,
  weight: number,
  color: string,
  lineHeightPx: number,
  align: "left" | "center" | "right" = "center",
): string {
  return text(
    ctx,
    parentId,
    name,
    boxX,
    boxY,
    boxW,
    boxH,
    content,
    size,
    weight,
    color,
    lineHeightPx,
    align,
    "middle",
    "fixed",
  );
}

function sectionBlock(ctx: BuildCtx, y: number, label: string): number {
  const { layout, tokens } = ctx;
  const top = y > 0 ? y + layout.sectionGap : y;
  text(
    ctx,
    ctx.contentId,
    "Section header",
    layout.gutter,
    top,
    layout.contentW,
    tokens.sectionHeaderLine,
    label,
    tokens.sectionHeaderSize,
    700,
    tokens.ink,
    tokens.sectionHeaderLine,
  );
  return top + tokens.sectionHeaderLine + layout.headerToCard;
}

function buildStatusBar(ctx: BuildCtx, y: number): number {
  const { layout, tokens } = ctx;
  const shellR = layout.radiusCard;
  rectRadii(ctx, ctx.contentId, "Status bar", 0, y, layout.w, 44, tokens.canvas, [shellR, shellR, 0, 0]);
  text(
    ctx,
    ctx.contentId,
    "Time",
    layout.gutter,
    y + 12,
    48,
    20,
    "9:41",
    tokens.bodySize,
    600,
    tokens.ink,
    tokens.bodyLine,
  );
  rect(ctx, ctx.contentId, "Signal", layout.w - layout.gutter - 58, y + 16, 18, 10, tokens.ink, 2);
  rect(ctx, ctx.contentId, "Battery", layout.w - layout.gutter - 32, y + 14, 24, 12, tokens.positive, 3);
  return y + 44;
}

function buildHeader(ctx: BuildCtx, y: number, userName: string): number {
  const { layout, tokens } = ctx;
  const rowH = 56;
  const avatar = 40;
  const icon = 32;
  const avatarX = layout.gutter;
  const textX = avatarX + avatar + layout.gridGap;
  const textW = layout.w - textX - layout.gutter - icon * 2 - layout.gridGap * 2;

  iconBadge(ctx, ctx.contentId, "Avatar", avatarX, y + 8, avatar, "profile", tokens.brandPrimary, tokens.onPrimary);
  text(
    ctx,
    ctx.contentId,
    "Greeting",
    textX,
    y + 10,
    textW,
    tokens.titleLine,
    `Good Morning, ${userName}`,
    tokens.titleSize,
    700,
    tokens.ink,
    tokens.titleLine,
  );
  text(
    ctx,
    ctx.contentId,
    "Sub greeting",
    textX,
    y + 10 + tokens.titleLine + 4,
    textW,
    tokens.subtextLine,
    "Paytm UPI · Secure payments",
    tokens.subtextSize,
    500,
    tokens.moderate,
    tokens.subtextLine,
  );

  const qrX = layout.w - layout.gutter - icon;
  const bellX = qrX - layout.gridGap - icon;
  ellipse(ctx, ctx.contentId, "Notifications", bellX, y + 12, icon, tokens.surface3);
  boxText(ctx, ctx.contentId, "Bell", bellX, y + 12, icon, icon, "🔔", 14, 400, tokens.ink, 16);
  ellipse(ctx, ctx.contentId, "QR", qrX, y + 12, icon, tokens.primaryMedium);
  boxText(ctx, ctx.contentId, "QR icon", qrX, y + 12, icon, icon, "▦", 14, 700, tokens.onPrimary, 16);

  return y + rowH + 8;
}

function buildSearch(ctx: BuildCtx, y: number): number {
  const { layout, tokens } = ctx;
  const h = 44;
  rect(ctx, ctx.contentId, "Search bar", layout.gutter, y, layout.contentW, h, tokens.surface3, tokens.radiusControl, tokens.hairline);
  ellipse(ctx, ctx.contentId, "Search icon", layout.gutter + 12, y + 10, 24, tokens.canvas);
  text(
    ctx,
    ctx.contentId,
    "Search placeholder",
    layout.gutter + 44,
    y + 12,
    layout.contentW - 56,
    tokens.bodyLine,
    "Search for payments, bills, tickets",
    tokens.bodySize,
    400,
    tokens.muted,
    tokens.bodyLine,
  );
  return y + h;
}

function buildQuickActions(ctx: BuildCtx, y: number, actions = DEFAULT_QUICK_ACTIONS): number {
  const { layout, tokens } = ctx;
  let cy = sectionBlock(ctx, y, "Quick Payments");
  const cols = 3;
  const gap = layout.gridGap;
  const cellW = colWidth(layout, cols, gap);
  const icon = 48;
  const rowH = 88;
  const rows = Math.ceil(actions.length / cols);

  actions.forEach((label, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = colX(layout, col, cols, gap);
    const iy = cy + row * rowH;
    const colors = [
      tokens.brandPrimary,
      tokens.primaryMedium,
      tokens.brandSecondary,
      tokens.primaryStrong,
      tokens.positive,
      tokens.notice,
    ];
    const accent = colors[i % colors.length]!;
    const ix = centerInCell(x, cellW, icon);
    iconBadge(ctx, ctx.contentId, label, ix, iy, icon, quickActionIcon(label), accent, tokens.onPrimary);
    boxText(
      ctx,
      ctx.contentId,
      label,
      x,
      iy + icon + 6,
      cellW,
      tokens.captionLine + 10,
      label,
      tokens.captionSize,
      600,
      tokens.ink,
      tokens.captionLine,
    );
  });
  return cy + rowH * rows;
}

function buildBalanceCard(ctx: BuildCtx, y: number, userName: string): number {
  const { layout, tokens } = ctx;
  const cardH = 148;
  const pad = layout.cardPad;
  const x = layout.gutter;
  rect(ctx, ctx.contentId, "UPI card", x, y, layout.contentW, cardH, tokens.primaryWeak, layout.radiusCard, undefined, {
    from: tokens.primaryMedium,
    to: tokens.brandSecondary,
    rotation: 135,
  });

  const upiHandle = `${userName.toLowerCase()}@paytm`;
  let ty = y + pad;
  text(ctx, ctx.contentId, "UPI label", x + pad, ty, layout.contentW - pad * 2, tokens.subtextLine, `UPI ID · ${upiHandle}`, tokens.subtextSize, 500, tokens.onPrimary, tokens.subtextLine);
  ty += tokens.subtextLine + 8;
  text(ctx, ctx.contentId, "Balance label", x + pad, ty, 160, tokens.subtextLine, "Available Balance", tokens.subtextSize, 400, tokens.onPrimary, tokens.subtextLine);
  ty += tokens.subtextLine + 4;
  text(ctx, ctx.contentId, "Balance value", x + pad, ty, 200, tokens.displayLine, "₹24,580.00", tokens.displaySize, 700, tokens.onPrimary, tokens.displayLine);
  ty += tokens.displayLine + 8;
  text(ctx, ctx.contentId, "Last txn", x + pad, ty, 200, tokens.subtextLine, "Last: Paid Swiggy ₹248", tokens.subtextSize, 400, tokens.onPrimary, tokens.subtextLine);

  const ctaW = 108;
  const ctaH = 40;
  const ctaX = x + layout.contentW - pad - ctaW;
  const ctaY = y + cardH - pad - ctaH;
  rect(ctx, ctx.contentId, "Add money CTA", ctaX, ctaY, ctaW, ctaH, tokens.primaryStrong, tokens.radiusControl);
  boxText(
    ctx,
    ctx.contentId,
    "Add money label",
    ctaX,
    ctaY,
    ctaW,
    ctaH,
    "Add Money",
    tokens.bodySize,
    600,
    tokens.onPrimary,
    tokens.bodyLine,
  );
  return y + cardH;
}

function buildFinServices(ctx: BuildCtx, y: number): number {
  const { layout, tokens } = ctx;
  let cy = sectionBlock(ctx, y, "Financial Services");
  const cols = 2;
  const gap = layout.gridGap;
  const cellW = colWidth(layout, cols, gap);
  const cellH = 104;

  FIN_SERVICES.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = colX(layout, col, cols, gap);
    const iy = cy + row * (cellH + gap);
    rect(ctx, ctx.contentId, item.title, x, iy, cellW, cellH, tokens.canvas, layout.radiusCard, tokens.hairline);
    rect(ctx, ctx.contentId, `${item.title} art`, x + layout.cardPad, iy + layout.cardPad, cellW - layout.cardPad * 2, 40, item.color, tokens.radiusControl);
    text(
      ctx,
      ctx.contentId,
      item.title,
      x + layout.cardPad,
      iy + layout.cardPad + 48,
      cellW - layout.cardPad * 2,
      tokens.subtextLine,
      item.title,
      tokens.subtextSize,
      700,
      tokens.ink,
      tokens.subtextLine,
    );
    text(
      ctx,
      ctx.contentId,
      item.sub,
      x + layout.cardPad,
      iy + layout.cardPad + 48 + tokens.subtextLine + 2,
      cellW - layout.cardPad * 2,
      tokens.captionLine,
      item.sub,
      tokens.captionSize,
      400,
      tokens.muted,
      tokens.captionLine,
    );
  });
  return cy + (cellH + gap) * 2 - gap;
}

function buildRechargeGrid(ctx: BuildCtx, y: number): number {
  const { layout, tokens } = ctx;
  let cy = sectionBlock(ctx, y, "Recharge & Bill Payments");
  const cols = 4;
  const gap = 8;
  const cellW = colWidth(layout, cols, gap);
  const cellH = 72;
  const icon = 36;

  RECHARGE.forEach((label, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = colX(layout, col, cols, gap);
    const iy = cy + row * (cellH + gap);
    const ix = centerInCell(x, cellW, icon);
    ellipse(ctx, ctx.contentId, `${label} icon`, ix, iy, icon, i % 2 === 0 ? tokens.primaryWeak : tokens.noticeWeak);
    boxText(
      ctx,
      ctx.contentId,
      label,
      x,
      iy + icon + 4,
      cellW,
      tokens.captionLine + 8,
      label,
      tokens.captionSize,
      600,
      tokens.ink,
      tokens.captionLine,
    );
  });
  return cy + (cellH + gap) * 2 - gap;
}

function buildOffers(ctx: BuildCtx, y: number): number {
  const { layout, tokens } = ctx;
  let cy = sectionBlock(ctx, y, "Cashback & Offers");
  const offers = [
    { title: "₹50 Cashback", sub: "On first UPI payment", color: tokens.noticeWeak },
    { title: "Festival Sale", sub: "Up to 40% off", color: tokens.primaryWeak },
    { title: "Refer & Earn", sub: "₹200 bonus", color: "#dbf0e2" },
  ];
  const cols = 3;
  const gap = layout.gridGap;
  const cellW = colWidth(layout, cols, gap);
  const cellH = 96;

  offers.forEach((o, i) => {
    const x = colX(layout, i, cols, gap);
    rect(ctx, ctx.contentId, o.title, x, cy, cellW, cellH, o.color, layout.radiusControl);
    text(
      ctx,
      ctx.contentId,
      o.title,
      x + layout.cardPad,
      cy + layout.cardPad,
      cellW - layout.cardPad * 2,
      tokens.subtextLine,
      o.title,
      tokens.subtextSize,
      700,
      tokens.ink,
      tokens.subtextLine,
    );
    text(
      ctx,
      ctx.contentId,
      o.sub,
      x + layout.cardPad,
      cy + layout.cardPad + tokens.subtextLine + 4,
      cellW - layout.cardPad * 2,
      tokens.captionLine + 8,
      o.sub,
      tokens.captionSize,
      400,
      tokens.muted,
      tokens.captionLine,
    );
  });
  return cy + cellH;
}

function buildTravel(ctx: BuildCtx, y: number): number {
  const { layout, tokens } = ctx;
  let cy = sectionBlock(ctx, y, "Travel & Lifestyle");
  const cols = 4;
  const gap = layout.gridGap;
  const cellW = colWidth(layout, cols, gap);
  const cellH = 96;

  TRAVEL.forEach((label, i) => {
    const x = colX(layout, i, cols, gap);
    rect(ctx, ctx.contentId, label, x, cy, cellW, cellH, tokens.canvas, layout.radiusCard, tokens.hairline);
    rect(ctx, ctx.contentId, `${label} banner`, x + 8, cy + 8, cellW - 16, 44, tokens.brandSecondary, tokens.radiusControl);
    boxText(
      ctx,
      ctx.contentId,
      label,
      x + 8,
      cy + 52,
      cellW - 16,
      tokens.subtextLine + 8,
      label,
      tokens.subtextSize,
      600,
      tokens.ink,
      tokens.subtextLine,
    );
  });
  return cy + cellH;
}

function buildTransactions(ctx: BuildCtx, y: number, txns = TRANSACTIONS): number {
  const { layout, tokens } = ctx;
  let cy = sectionBlock(ctx, y, "Recent Transactions");
  const rowH = 56;
  const icon = 36;

  txns.forEach((txn, i) => {
    const iy = cy + i * (rowH + 8);
    rect(ctx, ctx.contentId, txn.merchant, layout.gutter, iy, layout.contentW, rowH, tokens.canvas, layout.radiusControl, tokens.hairline);
    const iconX = layout.gutter + layout.cardPad;
    ellipse(ctx, ctx.contentId, `${txn.merchant} icon`, iconX, iy + (rowH - icon) / 2, icon, tokens.surface3);
    const textX = iconX + icon + 12;
    const amountW = 72;
    const textW = layout.contentW - (textX - layout.gutter) - layout.cardPad - amountW;
    text(ctx, ctx.contentId, txn.merchant, textX, iy + 10, textW, tokens.bodyLine, txn.merchant, tokens.bodySize, 600, tokens.ink, tokens.bodyLine);
    text(ctx, ctx.contentId, txn.time, textX, iy + 10 + tokens.bodyLine + 2, textW, tokens.subtextLine, txn.time, tokens.subtextSize, 400, tokens.muted, tokens.subtextLine);
    text(
      ctx,
      ctx.contentId,
      txn.amount,
      layout.gutter + layout.contentW - layout.cardPad - amountW,
      iy + 18,
      amountW,
      tokens.bodyLine,
      txn.amount,
      tokens.bodySize,
      700,
      tokens.ink,
      tokens.bodyLine,
      "right",
    );
  });
  return cy + txns.length * (rowH + 8) - 8;
}

function buildBottomNav(ctx: BuildCtx): void {
  const { layout, tokens } = ctx;
  const y = layout.scrollH;
  const tabW = layout.w / TABS.length;
  const shellR = layout.radiusCard;
  rectRadii(ctx, ctx.frameId, "Tab bar", 0, y, layout.w, TAB_BAR_H, tokens.canvas, [0, 0, shellR, shellR], tokens.hairline);

  TABS.forEach((tab, i) => {
    const x = i * tabW;
    const active = i === 0;
    if (active) {
      const pillW = 56;
      rect(
        ctx,
        ctx.frameId,
        `${tab} active`,
        x + (tabW - pillW) / 2,
        y + 8,
        pillW,
        28,
        tokens.primaryWeak,
        layout.radiusControl,
      );
    }
    boxText(
      ctx,
      ctx.frameId,
      tab,
      x,
      y + 6,
      tabW,
      28,
      tab,
      tokens.captionSize,
      active ? 700 : 500,
      active ? tokens.primaryStrong : tokens.muted,
      tokens.captionLine,
    );
    const dot = 6;
    ellipse(
      ctx,
      ctx.frameId,
      `${tab} dot`,
      x + (tabW - dot) / 2,
      y + 40,
      dot,
      active ? tokens.primaryStrong : tokens.hairline,
    );
  });
}

function extractQuotedOrPattern(prompt: string, patterns: RegExp[], fallback: string): string {
  for (const p of patterns) {
    const m = prompt.match(p);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return fallback;
}

function extractAuthCopy(prompt: string) {
  return {
    welcome: extractQuotedOrPattern(
      prompt,
      [
        /(?:welcome|headline|title)[:\s]+["']([^"']+)["']/i,
        /(?:welcome|headline)[:\s]+([^\n.]{4,48})/i,
      ],
      /login|sign\s*in/i.test(prompt) ? "Welcome back" : "Welcome",
    ),
    subtitle: extractQuotedOrPattern(
      prompt,
      [/(?:subtitle|subhead|description)[:\s]+["']([^"']+)["']/i, /(?:subtitle|subhead)[:\s]+([^\n.]{4,64})/i],
      "Sign in to continue securely",
    ),
    primaryCta: extractQuotedOrPattern(
      prompt,
      [/(?:button|cta|primary)[:\s]+["']([^"']+)["']/i, /(?:button|cta)[:\s]+([^\n.]{2,24})/i],
      "Continue",
    ),
    footer: extractQuotedOrPattern(
      prompt,
      [/(?:footer|link|secondary)[:\s]+["']([^"']+)["']/i],
      "New user? Create account",
    ),
  };
}

function extractFormFieldsFromPrompt(prompt: string): string[] {
  const fields: string[] = [];
  for (const m of prompt.matchAll(/(?:^|\n)\s*[-•*]?\s*(?:field|input)[:\s]+([^\n,]{2,32})/gi)) {
    fields.push(m[1]!.trim());
  }
  const keywords = [
    "Mobile number",
    "Phone number",
    "Email",
    "Password",
    "Enter OTP",
    "OTP",
    "Username",
    "Search",
  ];
  for (const kw of keywords) {
    if (new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`, "i").test(prompt)) {
      fields.push(kw);
    }
  }
  const unique = [...new Set(fields.map((f) => f.replace(/\benter\s+/i, "").trim()))];
  if (unique.length === 0 && /login|sign\s*in|auth|otp/i.test(prompt)) {
    return ["Mobile number", "Enter OTP"];
  }
  return unique.slice(0, 4);
}

function extractListItemsFromPrompt(prompt: string): string[] {
  const items: string[] = [];
  for (const m of prompt.matchAll(/(?:^|\n)\s*[-•*]\s+([A-Za-z][^\n]{2,40})/g)) {
    const line = m[1]!.trim();
    if (!/^(field|input|button|cta|title|headline)/i.test(line)) items.push(line);
  }
  return items.slice(0, 5);
}

function extractHeadlineFromPrompt(prompt: string, fallback: string): string {
  const product = extractProductNameFromPrompt(prompt);
  if (product) return product;

  return extractQuotedOrPattern(
    prompt,
    [
      /(?:headline|title|screen title)[:\s]+["']([^"']+)["']/i,
      /(?:design|create|build)\s+(?:a\s+)?(?:modern\s+)?(.{4,48}?)\s+(?:screen|page|login)/i,
    ],
    fallback === "Mobile Screen" ? "Overview" : fallback,
  );
}

function extractSubheadFromPrompt(prompt: string): string | undefined {
  const sub = extractQuotedOrPattern(
    prompt,
    [/(?:subtitle|subhead|tagline)[:\s]+["']([^"']+)["']/i],
    "",
  );
  return sub || undefined;
}

function buildInputField(ctx: BuildCtx, y: number, label: string): number {
  const { layout, tokens } = ctx;
  rect(ctx, ctx.contentId, `${label} field`, layout.gutter, y, layout.contentW, 48, tokens.canvas, tokens.radiusControl, tokens.hairline);
  text(
    ctx,
    ctx.contentId,
    `${label} placeholder`,
    layout.gutter + 16,
    y + 14,
    layout.contentW - 32,
    tokens.bodyLine,
    label,
    tokens.bodySize,
    400,
    tokens.muted,
    tokens.bodyLine,
  );
  return y + 64;
}

function centeredLabel(
  ctx: BuildCtx,
  parentId: string,
  name: string,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  content: string,
  size: number,
  weight: number,
  color: string,
  lineHeightPx: number,
): string {
  return boxText(ctx, parentId, name, boxX, boxY, boxW, boxH, content, size, weight, color, lineHeightPx);
}

function buildPrimaryCta(ctx: BuildCtx, y: number, label: string, icon: RichIconKey = "workout"): number {
  const { layout, tokens } = ctx;
  const btnH = 52;
  rect(ctx, ctx.contentId, "Primary CTA", layout.gutter, y, layout.contentW, btnH, tokens.primaryStrong, tokens.radiusControl);
  iconBadge(ctx, ctx.contentId, "Primary CTA", layout.gutter + 16, y + 10, 32, icon, tokens.primaryMedium, tokens.onPrimary);
  centeredLabel(
    ctx,
    ctx.contentId,
    "Primary CTA label",
    layout.gutter + 52,
    y,
    layout.contentW - 68,
    btnH,
    label,
    tokens.bodySize,
    600,
    tokens.onPrimary,
    tokens.bodyLine,
  );
  return y + btnH + 16;
}

function extractAmountFromPrompt(prompt: string): string {
  return prompt.match(/₹[\d,]+(?:\.\d{2})?/)?.[0] ?? "₹1,249";
}

function extractMerchantFromPrompt(prompt: string): string {
  const m =
    prompt.match(/(?:from|to|at|merchant)[:\s]+([A-Za-z][A-Za-z0-9 &.'-]{2,24})/i) ??
    prompt.match(/(?:order|pay(?:ment)?)\s+(?:to|for|at)\s+([A-Za-z][A-Za-z0-9 &.'-]{2,24})/i);
  return m?.[1]?.trim() ?? "Swiggy";
}

function createRichCtx(
  tokens: ExtractedDesignTokens,
  title: string,
  frameHeight?: number,
): BuildCtx {
  const layout = makeLayout(tokens, frameHeight ?? MIN_SCREEN_HEIGHT);
  if (frameHeight != null) {
    layout.scrollH = frameHeight - TAB_BAR_H;
  }
  let counter = 0;
  const ctx: BuildCtx = {
    nodes: {},
    childOrder: { [ROOT]: [] },
    nextId: () => `${++counter}`,
    tokens,
    layout,
    frameId: "ai-rich-frame",
    contentId: "ai-rich-frame",
  };

  ctx.nodes[ctx.frameId] = {
    id: ctx.frameId,
    parentId: null,
    type: "frame",
    name: title,
    x: 80,
    y: 48,
    width: layout.w,
    height: layout.h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: tokens.canvas,
    strokeColor: tokens.hairline,
    strokeWidth: 1,
    cornerRadius: tokens.radiusCard,
    clipChildren: true,
    layoutMode: "vertical",
    layoutGap: 0,
    layoutSizingHorizontal: "fixed",
    layoutSizingVertical: "hug",
  };
  ctx.childOrder[ROOT] = [ctx.frameId];
  return ctx;
}

function finalizeRichResult(
  ctx: BuildCtx,
  options: RichMobileBuildOptions,
  flowLabel: string,
): AIGenerateResult {
  const title = options.title?.trim() || ctx.nodes[ctx.frameId]?.name || "Screen";

  const contentHeight = measureFlatContentHeight(ctx.nodes, ctx.frameId);
  ctx.layout.h = contentHeight;
  ctx.nodes[ctx.frameId] = {
    ...ctx.nodes[ctx.frameId]!,
    height: contentHeight,
  };

  const structured = organizeRichScreenHierarchy(ctx.nodes, ctx.childOrder, ctx.frameId, {
    w: ctx.layout.w,
    h: ctx.layout.h,
    gutter: ctx.layout.gutter,
    sectionGap: ctx.layout.sectionGap,
    gridGap: ctx.layout.gridGap,
  });

  const slice: EditorPersistSlice = wrapPersistSliceWithPages({
    fileName: `${title} · AI`,
    nodes: structured.nodes,
    childOrder: structured.childOrder,
    assets: {},
    designTokens: {},
    selectedIds: [ctx.frameId],
    zoom: 0.65,
    pan: { x: 56, y: 40 },
    showGrid: false,
    showRulers: false,
    canvasBackgroundColor: DEFAULT_CANVAS_BACKGROUND,
    comments: [],
  });
  const modelMeta = getAIModelById(options.modelId);
  return {
    slice,
    preview: {
      fileName: slice.fileName,
      frameCount: 1,
      palette: [ctx.tokens.brandPrimary, ctx.tokens.brandSecondary, ctx.tokens.canvas, ctx.tokens.ink],
      flowLabel,
      modelId: options.modelId,
      modelLabel: modelMeta?.label ?? options.modelId,
      contextAttachmentCount: options.contextAttachmentCount,
      generationSource: "rich",
    },
  };
}

function buildNavHeader(ctx: BuildCtx, y: number, title: string): number {
  const { layout, tokens } = ctx;
  rect(ctx, ctx.contentId, "Nav header", 0, y, layout.w, 56, tokens.canvas, 0);
  iconBadge(ctx, ctx.contentId, "Back", layout.gutter, y + 10, 36, "back", tokens.surface3, tokens.brandSecondary);
  boxText(
    ctx,
    ctx.contentId,
    "Screen title",
    layout.gutter + 40,
    y + 10,
    layout.contentW - 80,
    36,
    title,
    tokens.titleSize,
    700,
    tokens.ink,
    tokens.titleLine,
  );
  return y + 56;
}

function buildCheckoutSteps(ctx: BuildCtx, y: number): number {
  const { layout, tokens } = ctx;
  boxText(
    ctx,
    ctx.contentId,
    "Steps",
    layout.gutter,
    y,
    layout.contentW,
    tokens.subtextLine + 8,
    "Cart  →  Pay  →  Done",
    tokens.subtextSize,
    500,
    tokens.muted,
    tokens.subtextLine,
  );
  return y + tokens.subtextLine + layout.headerToCard;
}

function buildSummaryRow(
  ctx: BuildCtx,
  y: number,
  label: string,
  value: string,
  bold = false,
): number {
  const { layout, tokens } = ctx;
  text(ctx, ctx.contentId, label, layout.gutter + tokens.cardPad, y, 180, tokens.bodyLine, label, tokens.bodySize, bold ? 700 : 400, bold ? tokens.ink : tokens.muted, tokens.bodyLine);
  text(ctx, ctx.contentId, `${label} value`, layout.gutter + layout.contentW - tokens.cardPad - 100, y, 100, tokens.bodyLine, value, tokens.bodySize, bold ? 700 : 500, tokens.ink, tokens.bodyLine, "right");
  return y + tokens.bodyLine + 8;
}

function buildStickyPayCta(ctx: BuildCtx, label: string): void {
  const { layout, tokens } = ctx;
  const y = layout.h - STICKY_FOOTER_H;
  rect(ctx, ctx.frameId, "Pay dock", 0, y, layout.w, STICKY_FOOTER_H, tokens.canvas, 0, tokens.hairline);
  rect(ctx, ctx.frameId, "Pay CTA", layout.gutter, y + 16, layout.contentW, 52, tokens.primaryStrong, tokens.radiusControl);
  boxText(
    ctx,
    ctx.frameId,
    "Pay CTA label",
    layout.gutter,
    y + 16,
    layout.contentW,
    52,
    label,
    tokens.bodySize,
    600,
    tokens.onPrimary,
    tokens.bodyLine,
  );
}

export function buildRichCheckoutScreen(options: RichMobileBuildOptions): AIGenerateResult {
  const tokens = options.tokens;
  const title = options.title?.trim() || extractScreenTitle(options.prompt, "checkout");
  const amount = extractAmountFromPrompt(options.prompt);
  const merchant = extractMerchantFromPrompt(options.prompt);
  const layoutH = tokens.shellHeight;
  const ctx = createRichCtx(tokens, title, layoutH - STICKY_FOOTER_H);

  let y = 0;
  y = buildStatusBar(ctx, y);
  y = buildNavHeader(ctx, y, title);
  y = buildCheckoutSteps(ctx, y);

  rect(ctx, ctx.contentId, "Merchant card", ctx.layout.gutter, y, ctx.layout.contentW, 88, tokens.canvas, ctx.layout.radiusCard, tokens.hairline);
  ellipse(ctx, ctx.contentId, "Merchant logo", ctx.layout.gutter + ctx.layout.cardPad, y + 20, 48, tokens.primaryWeak);
  text(ctx, ctx.contentId, "Merchant", ctx.layout.gutter + ctx.layout.cardPad + 60, y + 24, 200, tokens.titleLine, merchant, tokens.titleSize, 700, tokens.ink, tokens.titleLine);
  text(ctx, ctx.contentId, "Merchant meta", ctx.layout.gutter + ctx.layout.cardPad + 60, y + 24 + tokens.titleLine + 2, 220, tokens.subtextLine, "2 items · Delivery in 35 min", tokens.subtextSize, 400, tokens.muted, tokens.subtextLine);
  y += 88 + ctx.layout.sectionGap;

  let cy = sectionBlock(ctx, y, "Order Summary");
  rect(ctx, ctx.contentId, "Summary card", ctx.layout.gutter, cy, ctx.layout.contentW, 196, tokens.canvas, ctx.layout.radiusCard, tokens.hairline);
  let ry = cy + ctx.layout.cardPad;
  ry = buildSummaryRow(ctx, ry, "Subtotal", "₹1,320");
  ry = buildSummaryRow(ctx, ry, "Delivery fee", "₹40");
  ry = buildSummaryRow(ctx, ry, "UPI cashback", "− ₹50");
  buildSummaryRow(ctx, ry + 4, "Total", amount, true);
  y = cy + 196 + ctx.layout.sectionGap;

  cy = sectionBlock(ctx, y, "Pay with");
  rect(ctx, ctx.contentId, "UPI selected", ctx.layout.gutter, cy, ctx.layout.contentW, 72, tokens.primaryWeak, ctx.layout.radiusControl, tokens.brandPrimary);
  ellipse(ctx, ctx.contentId, "UPI icon", ctx.layout.gutter + ctx.layout.cardPad, cy + 16, 40, tokens.brandPrimary);
  text(ctx, ctx.contentId, "UPI label", ctx.layout.gutter + ctx.layout.cardPad + 52, cy + 18, 200, tokens.bodyLine, "Paytm UPI", tokens.bodySize, 600, tokens.ink, tokens.bodyLine);
  text(ctx, ctx.contentId, "UPI meta", ctx.layout.gutter + ctx.layout.cardPad + 52, cy + 18 + tokens.bodyLine + 2, 220, tokens.subtextLine, "rahul@paytm · Primary", tokens.subtextSize, 400, tokens.muted, tokens.subtextLine);
  boxText(
    ctx,
    ctx.contentId,
    "UPI check",
    ctx.layout.gutter + ctx.layout.contentW - ctx.layout.cardPad - 24,
    cy + 16,
    24,
    40,
    "✓",
    tokens.bodySize,
    700,
    tokens.brandPrimary,
    tokens.bodyLine,
  );
  cy += 72 + 12;
  rect(ctx, ctx.contentId, "Balance option", ctx.layout.gutter, cy, ctx.layout.contentW, 64, tokens.canvas, ctx.layout.radiusControl, tokens.hairline);
  text(ctx, ctx.contentId, "Balance label", ctx.layout.gutter + ctx.layout.cardPad, cy + 20, 200, tokens.bodyLine, "Paytm Wallet", tokens.bodySize, 500, tokens.ink, tokens.bodyLine);
  text(ctx, ctx.contentId, "Balance value", ctx.layout.gutter + ctx.layout.contentW - ctx.layout.cardPad - 100, cy + 20, 100, tokens.bodyLine, "₹24,580", tokens.bodySize, 600, tokens.ink, tokens.bodyLine, "right");

  rect(ctx, ctx.contentId, "Offer strip", ctx.layout.gutter, cy + 80, ctx.layout.contentW, 48, tokens.noticeWeak, ctx.layout.radiusControl);
  text(ctx, ctx.contentId, "Offer text", ctx.layout.gutter + ctx.layout.cardPad, cy + 92, ctx.layout.contentW - ctx.layout.cardPad * 2, tokens.bodyLine, "₹50 cashback on this payment", tokens.subtextSize, 600, tokens.positive, tokens.bodyLine);

  buildStickyPayCta(ctx, `Pay ${amount}`);
  const count = Object.keys(ctx.nodes).length;
  return finalizeRichResult(ctx, { ...options, title }, `Rich checkout · ${count} layers`);
}

const PROFILE_ROWS = [
  "Payment settings",
  "UPI & linked accounts",
  "Notifications",
  "Security & privacy",
  "Help & support",
];

export function buildRichProfileScreen(options: RichMobileBuildOptions): AIGenerateResult {
  const tokens = options.tokens;
  const userName = extractUserNameFromPrompt(options.prompt) ?? "Rahul";
  const title = options.title?.trim() || extractScreenTitle(options.prompt, "profile");
  const ctx = createRichCtx(tokens, title);

  let y = 0;
  y = buildStatusBar(ctx, y);
  y = buildNavHeader(ctx, y, title);

  rect(ctx, ctx.contentId, "Profile card", ctx.layout.gutter, y, ctx.layout.contentW, 120, tokens.canvas, ctx.layout.radiusCard, tokens.hairline);
  const avatarX = ctx.layout.gutter + ctx.layout.cardPad;
  const avatarY = y + 24;
  const avatarSize = 72;
  ellipse(ctx, ctx.contentId, "Avatar", avatarX, avatarY, avatarSize, tokens.primaryWeak);
  boxText(
    ctx,
    ctx.contentId,
    "Avatar initial",
    avatarX,
    avatarY,
    avatarSize,
    avatarSize,
    userName[0] ?? "R",
    tokens.displaySize,
    700,
    tokens.brandSecondary,
    tokens.displayLine,
  );
  text(ctx, ctx.contentId, "Name", ctx.layout.gutter + ctx.layout.cardPad + 88, y + 36, 200, tokens.titleLine, userName, tokens.titleSize, 700, tokens.ink, tokens.titleLine);
  text(ctx, ctx.contentId, "Phone", ctx.layout.gutter + ctx.layout.cardPad + 88, y + 36 + tokens.titleLine + 4, 220, tokens.subtextLine, "+91 98765 43210", tokens.subtextSize, 400, tokens.muted, tokens.subtextLine);
  y += 120 + ctx.layout.sectionGap;

  let cy = sectionBlock(ctx, y, "Account");
  PROFILE_ROWS.forEach((row, i) => {
    const iy = cy + i * 56;
    rect(ctx, ctx.contentId, row, ctx.layout.gutter, iy, ctx.layout.contentW, 52, tokens.canvas, ctx.layout.radiusControl, tokens.hairline);
    text(ctx, ctx.contentId, row, ctx.layout.gutter + ctx.layout.cardPad, iy + 16, ctx.layout.contentW - 56, tokens.bodyLine, row, tokens.bodySize, 500, tokens.ink, tokens.bodyLine);
    text(ctx, ctx.contentId, `${row} chevron`, ctx.layout.gutter + ctx.layout.contentW - ctx.layout.cardPad - 16, iy + 16, 16, 20, "›", tokens.bodySize, 400, tokens.muted, tokens.bodyLine);
  });

  const count = Object.keys(ctx.nodes).length;
  return finalizeRichResult(ctx, { ...options, title }, `Rich profile · ${count} layers`);
}

export function buildRichAuthScreen(options: RichMobileBuildOptions): AIGenerateResult {
  const tokens = options.tokens;
  const title = options.title?.trim() || extractScreenTitle(options.prompt, "auth");
  const copy = extractAuthCopy(options.prompt);
  const fields = extractFormFieldsFromPrompt(options.prompt);
  const ctx = createRichCtx(tokens, title);

  let y = 0;
  y = buildStatusBar(ctx, y);
  ellipse(ctx, ctx.contentId, "Brand logo", ctx.layout.gutter, y + 24, 56, tokens.brandPrimary);
  text(
    ctx,
    ctx.contentId,
    "Welcome",
    ctx.layout.gutter,
    y + 96,
    ctx.layout.contentW,
    tokens.displayLine,
    copy.welcome,
    tokens.displaySize,
    700,
    tokens.ink,
    tokens.displayLine,
  );
  text(
    ctx,
    ctx.contentId,
    "Subtitle",
    ctx.layout.gutter,
    y + 96 + tokens.displayLine + 8,
    ctx.layout.contentW,
    tokens.bodyLine,
    copy.subtitle,
    tokens.bodySize,
    400,
    tokens.muted,
    tokens.bodyLine,
  );

  y += 168;
  for (const field of fields) {
    y = buildInputField(ctx, y, field);
  }
  y = buildPrimaryCta(ctx, y, copy.primaryCta);
  boxText(
    ctx,
    ctx.contentId,
    "Signup link",
    ctx.layout.gutter,
    y + 8,
    ctx.layout.contentW,
    tokens.bodyLine + 8,
    copy.footer,
    tokens.subtextSize,
    500,
    tokens.primaryMedium,
    tokens.subtextLine,
  );

  const count = Object.keys(ctx.nodes).length;
  return finalizeRichResult(ctx, { ...options, title }, `Rich auth · ${count} layers`);
}

function buildStatTile(
  ctx: BuildCtx,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  accent: string,
): void {
  const { tokens } = ctx;
  const tileH = 96;
  const tileBg = tintForAccent(tokens, accent);
  rect(ctx, ctx.contentId, `${label} stat`, x, y, w, tileH, tileBg, tokens.radiusControl, tokens.hairline);
  iconBadge(
    ctx,
    ctx.contentId,
    label,
    x + 12,
    y + 12,
    28,
    statIconForLabel(label),
    accent,
    tokens.onPrimary,
  );
  text(ctx, ctx.contentId, `${label} value`, x + 12, y + 48, w - 24, tokens.titleLine, value, tokens.titleSize, 700, tokens.ink, tokens.titleLine);
  text(ctx, ctx.contentId, `${label} label`, x + 12, y + 48 + tokens.titleLine + 2, w - 24, tokens.subtextLine, label, tokens.subtextSize, 500, tokens.muted, tokens.subtextLine);
}

function buildWeeklyBars(ctx: BuildCtx, y: number): number {
  const { layout, tokens } = ctx;
  const chartH = 96;
  rect(ctx, ctx.contentId, "Weekly chart", layout.gutter, y, layout.contentW, chartH + 36, tokens.canvas, tokens.radiusCard, tokens.hairline);
  iconBadge(
    ctx,
    ctx.contentId,
    "Chart",
    layout.gutter + tokens.cardPad,
    y + 10,
    24,
    "chart",
    tokens.primaryWeak,
    tokens.brandSecondary,
  );
  text(
    ctx,
    ctx.contentId,
    "Weekly chart title",
    layout.gutter + tokens.cardPad + 32,
    y + 12,
    layout.contentW - tokens.cardPad * 2 - 32,
    tokens.bodyLine,
    "This week",
    tokens.bodySize,
    600,
    tokens.ink,
    tokens.bodyLine,
  );

  const bars = [0.45, 0.72, 0.55, 0.9, 0.62, 0.78, 0.5];
  const barW = (layout.contentW - tokens.cardPad * 2 - 6 * 8) / 7;
  const baseY = y + chartH + 8;
  bars.forEach((pct, i) => {
    const bx = layout.gutter + tokens.cardPad + i * (barW + 8);
    const bh = Math.max(12, pct * 56);
    rect(ctx, ctx.contentId, `Bar ${i}`, bx, baseY - bh, barW, bh, i === 3 ? tokens.primaryStrong : tokens.primaryWeak, 4);
  });
  return y + chartH + 36 + layout.sectionGap;
}

const DEFAULT_ACTIVITIES = [
  { name: "Morning Run", detail: "5.2 km · 32 min", time: "7:10 AM" },
  { name: "Evening Walk", detail: "3.1 km · 38 min", time: "6:45 PM" },
  { name: "Yoga Session", detail: "Stretch · 25 min", time: "8:00 PM" },
];

export function buildRichActivityTrackingScreen(options: RichMobileBuildOptions): AIGenerateResult {
  const tokens = options.tokens;
  const title = options.title?.trim() || extractScreenTitle(options.prompt, "activity_tracking");
  const headline = extractProductNameFromPrompt(options.prompt) ?? "Today's Activity";
  const ctx = createRichCtx(tokens, title);

  let y = 0;
  y = buildStatusBar(ctx, y);
  y = buildNavHeader(ctx, y, title);

  text(
    ctx,
    ctx.contentId,
    "Today headline",
    ctx.layout.gutter,
    y + 8,
    ctx.layout.contentW,
    tokens.displayLine,
    headline,
    tokens.displaySize,
    700,
    tokens.ink,
    tokens.displayLine,
  );
  text(
    ctx,
    ctx.contentId,
    "Today date",
    ctx.layout.gutter,
    y + 8 + tokens.displayLine + 4,
    ctx.layout.contentW,
    tokens.bodyLine,
    "Tuesday, 17 Jun",
    tokens.bodySize,
    400,
    tokens.muted,
    tokens.bodyLine,
  );
  y += tokens.displayLine + tokens.bodyLine + 20;

  const tileW = (ctx.layout.contentW - ctx.layout.gridGap * 2) / 3;
  buildStatTile(ctx, ctx.layout.gutter, y, tileW, "Steps", "8,432", tokens.primaryStrong);
  buildStatTile(ctx, ctx.layout.gutter + tileW + ctx.layout.gridGap, y, tileW, "Calories", "420", tokens.notice);
  buildStatTile(ctx, ctx.layout.gutter + (tileW + ctx.layout.gridGap) * 2, y, tileW, "Minutes", "48", tokens.positive);
  y += 96 + ctx.layout.sectionGap;

  y = buildWeeklyBars(ctx, y);

  y = sectionBlock(ctx, y, "Recent activity");
  const rowH = 64;
  DEFAULT_ACTIVITIES.forEach((activity, i) => {
    const iy = y + i * (rowH + 8);
    rect(ctx, ctx.contentId, activity.name, ctx.layout.gutter, iy, ctx.layout.contentW, rowH, tokens.canvas, tokens.radiusControl, tokens.hairline);
    iconBadge(
      ctx,
      ctx.contentId,
      activity.name,
      ctx.layout.gutter + ctx.layout.cardPad,
      iy + 12,
      40,
      activityIconForName(activity.name),
      tokens.primaryWeak,
      tokens.brandSecondary,
    );
    text(
      ctx,
      ctx.contentId,
      activity.name,
      ctx.layout.gutter + ctx.layout.cardPad + 52,
      iy + 14,
      ctx.layout.contentW - 120,
      tokens.bodyLine,
      activity.name,
      tokens.bodySize,
      600,
      tokens.ink,
      tokens.bodyLine,
    );
    text(
      ctx,
      ctx.contentId,
      `${activity.name} detail`,
      ctx.layout.gutter + ctx.layout.cardPad + 52,
      iy + 14 + tokens.bodyLine + 2,
      ctx.layout.contentW - 120,
      tokens.subtextLine,
      activity.detail,
      tokens.subtextSize,
      400,
      tokens.muted,
      tokens.subtextLine,
    );
    text(
      ctx,
      ctx.contentId,
      `${activity.name} time`,
      ctx.layout.gutter + ctx.layout.contentW - ctx.layout.cardPad - 56,
      iy + 22,
      48,
      tokens.subtextLine,
      activity.time,
      tokens.captionSize,
      500,
      tokens.moderate,
      tokens.captionLine,
      "right",
    );
  });
  y += DEFAULT_ACTIVITIES.length * (rowH + 8) + 8;

  buildPrimaryCta(ctx, y, "Start workout");

  const count = Object.keys(ctx.nodes).length;
  return finalizeRichResult(ctx, { ...options, title }, `Rich activity · ${count} layers`);
}

export function buildRichGenericMobileScreen(options: RichMobileBuildOptions): AIGenerateResult {
  const tokens = options.tokens;
  const title = options.title?.trim() || extractScreenTitle(options.prompt, "generic_mobile");
  const headline = extractHeadlineFromPrompt(options.prompt, title);
  const subhead = extractSubheadFromPrompt(options.prompt);
  const fields = extractFormFieldsFromPrompt(options.prompt);
  const listItems = extractListItemsFromPrompt(options.prompt);
  const cta = extractQuotedOrPattern(
    options.prompt,
    [/(?:button|cta|primary)[:\s]+["']([^"']+)["']/i],
    "Continue",
  );
  const ctx = createRichCtx(tokens, title);

  let y = 0;
  y = buildStatusBar(ctx, y);
  y = buildNavHeader(ctx, y, title);

  text(
    ctx,
    ctx.contentId,
    "Hero headline",
    ctx.layout.gutter,
    y + 16,
    ctx.layout.contentW,
    tokens.displayLine,
    headline,
    tokens.displaySize,
    700,
    tokens.ink,
    tokens.displayLine,
  );
  if (subhead) {
    text(
      ctx,
      ctx.contentId,
      "Hero subhead",
      ctx.layout.gutter,
      y + 16 + tokens.displayLine + 8,
      ctx.layout.contentW,
      tokens.bodyLine,
      subhead,
      tokens.bodySize,
      400,
      tokens.muted,
      tokens.bodyLine,
    );
    y += tokens.displayLine + tokens.bodyLine + 24;
  } else {
    y += tokens.displayLine + 24;
  }

  if (fields.length > 0) {
    for (const field of fields) {
      y = buildInputField(ctx, y, field);
    }
    y = buildPrimaryCta(ctx, y, cta);
  } else {
    rect(
      ctx,
      ctx.contentId,
      "Hero card",
      ctx.layout.gutter,
      y,
      ctx.layout.contentW,
      120,
      tokens.canvas,
      tokens.radiusCard,
      tokens.hairline,
    );
    text(
      ctx,
      ctx.contentId,
      "Card body",
      ctx.layout.gutter + tokens.cardPad,
      y + tokens.cardPad,
      ctx.layout.contentW - tokens.cardPad * 2,
      tokens.bodyLine * 2,
      extractGenericScreenSummary(options.prompt, title),
      tokens.bodySize,
      400,
      tokens.moderate,
      tokens.bodyLine,
    );
    y += 136;
    y = buildPrimaryCta(ctx, y, cta);
  }

  if (listItems.length > 0) {
    y += 8;
    y = sectionBlock(ctx, y, "Details");
    const rowH = 52;
    listItems.forEach((item, i) => {
      const iy = y + i * (rowH + 8);
      rect(ctx, ctx.contentId, item, ctx.layout.gutter, iy, ctx.layout.contentW, rowH, tokens.canvas, tokens.radiusControl, tokens.hairline);
      text(
        ctx,
        ctx.contentId,
        `${item} label`,
        ctx.layout.gutter + tokens.cardPad,
        iy + 16,
        ctx.layout.contentW - tokens.cardPad * 2,
        tokens.bodyLine,
        item,
        tokens.bodySize,
        500,
        tokens.ink,
        tokens.bodyLine,
      );
    });
  }

  const count = Object.keys(ctx.nodes).length;
  return finalizeRichResult(ctx, { ...options, title }, `Rich mobile · ${count} layers`);
}

export function supportsRichScreen(intent: ScreenIntent): boolean {
  return RICH_SCREEN_INTENTS.has(intent);
}

export function buildRichScreenForIntent(intent: ScreenIntent, options: RichMobileBuildOptions): AIGenerateResult | null {
  switch (intent) {
    case "mobile_home":
      return buildRichMobileHomeScreen(options);
    case "checkout":
    case "send_money":
    case "recharge":
      return buildRichCheckoutScreen({
        ...options,
        title: options.title ?? extractScreenTitle(options.prompt, intent === "send_money" ? "send_money" : intent === "recharge" ? "recharge" : "checkout"),
      });
    case "profile":
    case "transactions":
      return buildRichProfileScreen({
        ...options,
        title: options.title ?? extractScreenTitle(options.prompt, intent),
      });
    case "auth":
      return buildRichAuthScreen(options);
    case "activity_tracking":
      return buildRichActivityTrackingScreen(options);
    case "generic_mobile":
      if (isActivityTrackingPrompt(options.prompt)) {
        return buildRichActivityTrackingScreen(options);
      }
      return buildRichGenericMobileScreen(options);
    default:
      return null;
  }
}

export function buildRichMobileHomeScreen(options: RichMobileBuildOptions): AIGenerateResult {
  const tokens = options.tokens;
  const userName = extractUserNameFromPrompt(options.prompt) ?? "Rahul";
  const title = options.title?.trim() || extractScreenTitle(options.prompt, "mobile_home");
  const txns = extractTransactionsFromPrompt(options.prompt) ?? TRANSACTIONS;
  const sections = new Set(parseHomeSections(options.prompt));
  const quickActions = extractQuickActionsFromPrompt(options.prompt) ?? DEFAULT_QUICK_ACTIONS;

  const ctx = createRichCtx(tokens, title);

  let y = 0;
  y = buildStatusBar(ctx, y);
  y = buildHeader(ctx, y, userName);
  y = buildSearch(ctx, y);
  if (sections.has("quick_actions")) y = buildQuickActions(ctx, y, quickActions);
  if (sections.has("balance")) y = buildBalanceCard(ctx, y, userName);
  if (sections.has("fin_services")) y = buildFinServices(ctx, y);
  if (sections.has("recharge")) y = buildRechargeGrid(ctx, y);
  if (sections.has("offers")) y = buildOffers(ctx, y);
  if (sections.has("travel")) y = buildTravel(ctx, y);
  if (sections.has("transactions")) buildTransactions(ctx, y, txns);
  buildBottomNav(ctx);

  const elementCount = Object.keys(ctx.nodes).length;
  return finalizeRichResult(ctx, { ...options, title }, `Rich home · ${sections.size} sections · ${elementCount} layers`);
}

export function countLayoutElements(result: AIGenerateResult): number {
  const frameId = result.slice.childOrder[ROOT]?.[0];
  if (!frameId) return 0;
  return (result.slice.childOrder[frameId]?.length ?? 0) + countDescendants(result, frameId) - 1;
}

function countDescendants(result: AIGenerateResult, parentId: string): number {
  const kids = result.slice.childOrder[parentId] ?? [];
  return kids.reduce((sum, id) => sum + 1 + countDescendants(result, id), 0);
}
