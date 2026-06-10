import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  extractTransactionsFromPrompt,
  extractUserNameFromPrompt,
  type ExtractedDesignTokens,
} from "@/lib/aiDesignTokens";
import { extractScreenTitle, type ScreenIntent } from "@/lib/aiScreenIntent";
import { newGradientStopId } from "@/lib/fillGradient";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import type { AIGenerateResult } from "@/lib/aiMockGenerator";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import { getAIModelById } from "@/lib/aiModels";
import type { EditorNode } from "@/stores/useEditorStore";

const ROOT = EDITOR_ROOT_KEY;
const TAB_BAR_H = 64;
const STICKY_FOOTER_H = 88;

const RICH_SCREEN_INTENTS = new Set<ScreenIntent>([
  "mobile_home",
  "checkout",
  "profile",
  "auth",
  "recharge",
  "send_money",
  "transactions",
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

function makeLayout(tokens: ExtractedDesignTokens): MobileLayout {
  const w = tokens.shellWidth;
  const h = tokens.shellHeight;
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
    ...(gradient
      ? {
          fillType: "gradient" as const,
          fillGradient: {
            kind: "linear" as const,
            transform: { cx: 0.5, cy: 0.5, width: 1, height: 1, rotation: gradient.rotation ?? 135 },
            stops: [
              { id: newGradientStopId(), color: gradient.from, position: 0 },
              { id: newGradientStopId(), color: gradient.to, position: 100 },
            ],
          },
        }
      : {}),
    cornerRadius: radius,
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
  };
  addChild(ctx, parentId, id);
  return id;
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
  rect(ctx, ctx.contentId, "Status bar", 0, y, layout.w, 44, tokens.canvas, 0);
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

  ellipse(ctx, ctx.contentId, "Avatar", avatarX, y + 8, avatar, tokens.primaryWeak);
  text(
    ctx,
    ctx.contentId,
    "Avatar initial",
    avatarX + 12,
    y + 20,
    20,
    tokens.titleLine,
    userName[0] ?? "R",
    tokens.titleSize,
    700,
    tokens.brandSecondary,
    tokens.titleLine,
    "center",
  );
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
  text(ctx, ctx.contentId, "Bell", bellX + 8, y + 18, 16, 16, "🔔", 12, 400, tokens.ink, 16, "center");
  ellipse(ctx, ctx.contentId, "QR", qrX, y + 12, icon, tokens.primaryMedium);
  text(ctx, ctx.contentId, "QR icon", qrX + 8, y + 18, 16, 16, "▦", 12, 700, tokens.onPrimary, 16, "center");

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
    const ix = centerInCell(x, cellW, icon);
    ellipse(ctx, ctx.contentId, label, ix, iy, icon, colors[i % colors.length]!);
    text(
      ctx,
      ctx.contentId,
      `${label} glyph`,
      ix + 16,
      iy + 14,
      16,
      20,
      label.slice(0, 1),
      tokens.bodySize,
      700,
      tokens.onPrimary,
      tokens.bodyLine,
      "center",
    );
    text(
      ctx,
      ctx.contentId,
      label,
      x,
      iy + icon + 8,
      cellW,
      tokens.captionLine + 8,
      label,
      tokens.captionSize,
      600,
      tokens.ink,
      tokens.captionLine,
      "center",
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
  text(
    ctx,
    ctx.contentId,
    "Add money label",
    ctaX,
    ctaY + 10,
    ctaW,
    tokens.bodyLine,
    "Add Money",
    tokens.bodySize,
    600,
    tokens.onPrimary,
    tokens.bodyLine,
    "center",
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
    text(
      ctx,
      ctx.contentId,
      label,
      x,
      iy + icon + 6,
      cellW,
      tokens.captionLine + 4,
      label,
      tokens.captionSize,
      600,
      tokens.ink,
      tokens.captionLine,
      "center",
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
    text(
      ctx,
      ctx.contentId,
      label,
      x + 8,
      cy + 56,
      cellW - 16,
      tokens.subtextLine,
      label,
      tokens.subtextSize,
      600,
      tokens.ink,
      tokens.subtextLine,
      "center",
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
  rect(ctx, ctx.frameId, "Tab bar", 0, y, layout.w, TAB_BAR_H, tokens.canvas, 0, tokens.hairline);

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
    text(
      ctx,
      ctx.frameId,
      tab,
      x,
      y + (active ? 12 : 14),
      tabW,
      tokens.subtextLine,
      tab,
      tokens.captionSize,
      active ? 700 : 500,
      active ? tokens.primaryStrong : tokens.muted,
      tokens.captionLine,
      "center",
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

function extractAmountFromPrompt(prompt: string): string {
  return prompt.match(/₹[\d,]+(?:\.\d{2})?/)?.[0] ?? "₹1,249";
}

function extractMerchantFromPrompt(prompt: string): string {
  const m =
    prompt.match(/(?:from|to|at|merchant)[:\s]+([A-Za-z][A-Za-z0-9 &.'-]{2,24})/i) ??
    prompt.match(/(?:order|pay(?:ment)?)\s+(?:to|for|at)\s+([A-Za-z][A-Za-z0-9 &.'-]{2,24})/i);
  return m?.[1]?.trim() ?? "Swiggy";
}

function createRichCtx(tokens: ExtractedDesignTokens, title: string, scrollHeight?: number): BuildCtx {
  const layout = { ...makeLayout(tokens), scrollH: scrollHeight ?? makeLayout(tokens).scrollH };
  let counter = 0;
  const ctx: BuildCtx = {
    nodes: {},
    childOrder: { [ROOT]: [] },
    nextId: () => `${++counter}`,
    tokens,
    layout,
    frameId: "ai-rich-frame",
    contentId: "ai-rich-scroll",
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
    fill: tokens.wash,
    strokeColor: tokens.hairline,
    strokeWidth: 1,
    cornerRadius: 0,
  };
  ctx.childOrder[ROOT] = [ctx.frameId];

  ctx.nodes[ctx.contentId] = {
    id: ctx.contentId,
    parentId: ctx.frameId,
    type: "frame",
    name: "Scroll content",
    x: 0,
    y: 0,
    width: layout.w,
    height: layout.scrollH,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: tokens.wash,
    cornerRadius: 0,
    clipChildren: true,
  };
  addChild(ctx, ctx.frameId, ctx.contentId);
  return ctx;
}

function finalizeRichResult(
  ctx: BuildCtx,
  options: RichMobileBuildOptions,
  flowLabel: string,
): AIGenerateResult {
  const title = options.title?.trim() || ctx.nodes[ctx.frameId]?.name || "Screen";
  const slice: EditorPersistSlice = wrapPersistSliceWithPages({
    fileName: `${title} · AI`,
    nodes: ctx.nodes,
    childOrder: ctx.childOrder,
    assets: {},
    designTokens: {},
    selectedIds: [ctx.frameId],
    zoom: 0.65,
    pan: { x: 56, y: 40 },
    showGrid: false,
    showRulers: true,
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
  text(ctx, ctx.contentId, "Back", layout.gutter, y + 18, 40, 24, "←", tokens.titleSize, 600, tokens.brandSecondary, tokens.titleLine);
  text(
    ctx,
    ctx.contentId,
    "Screen title",
    layout.gutter + 40,
    y + 16,
    layout.contentW - 80,
    tokens.titleLine,
    title,
    tokens.titleSize,
    700,
    tokens.ink,
    tokens.titleLine,
    "center",
  );
  return y + 56;
}

function buildCheckoutSteps(ctx: BuildCtx, y: number): number {
  const { layout, tokens } = ctx;
  text(
    ctx,
    ctx.contentId,
    "Steps",
    layout.gutter,
    y,
    layout.contentW,
    tokens.subtextLine,
    "Cart  →  Pay  →  Done",
    tokens.subtextSize,
    500,
    tokens.muted,
    tokens.subtextLine,
    "center",
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
  text(ctx, ctx.frameId, "Pay CTA label", layout.gutter, y + 30, layout.contentW, tokens.bodyLine, label, tokens.bodySize, 600, tokens.onPrimary, tokens.bodyLine, "center");
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
  text(ctx, ctx.contentId, "UPI check", ctx.layout.gutter + ctx.layout.contentW - ctx.layout.cardPad - 24, cy + 26, 24, 24, "✓", tokens.bodySize, 700, tokens.brandPrimary, tokens.bodyLine, "center");
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
  ellipse(ctx, ctx.contentId, "Avatar", ctx.layout.gutter + ctx.layout.cardPad, y + 24, 72, tokens.primaryWeak);
  text(ctx, ctx.contentId, "Avatar initial", ctx.layout.gutter + ctx.layout.cardPad + 26, y + 46, 24, tokens.titleLine, userName[0] ?? "R", tokens.displaySize, 700, tokens.brandSecondary, tokens.displayLine, "center");
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
  const ctx = createRichCtx(tokens, title);

  let y = 0;
  y = buildStatusBar(ctx, y);
  ellipse(ctx, ctx.contentId, "Brand logo", ctx.layout.gutter, y + 24, 56, tokens.brandPrimary);
  text(ctx, ctx.contentId, "Welcome", ctx.layout.gutter, y + 96, ctx.layout.contentW, tokens.displayLine, "Welcome back", tokens.displaySize, 700, tokens.ink, tokens.displayLine);
  text(ctx, ctx.contentId, "Subtitle", ctx.layout.gutter, y + 96 + tokens.displayLine + 8, ctx.layout.contentW, tokens.bodyLine, "Sign in to continue securely", tokens.bodySize, 400, tokens.muted, tokens.bodyLine);

  y += 168;
  rect(ctx, ctx.contentId, "Phone field", ctx.layout.gutter, y, ctx.layout.contentW, 48, tokens.canvas, tokens.radiusControl, tokens.hairline);
  text(ctx, ctx.contentId, "Phone placeholder", ctx.layout.gutter + 16, y + 14, 200, tokens.bodyLine, "Mobile number", tokens.bodySize, 400, tokens.muted, tokens.bodyLine);
  y += 64;
  rect(ctx, ctx.contentId, "OTP field", ctx.layout.gutter, y, ctx.layout.contentW, 48, tokens.canvas, tokens.radiusControl, tokens.hairline);
  text(ctx, ctx.contentId, "OTP placeholder", ctx.layout.gutter + 16, y + 14, 160, tokens.bodyLine, "Enter OTP", tokens.bodySize, 400, tokens.muted, tokens.bodyLine);
  y += 72;
  rect(ctx, ctx.contentId, "Continue CTA", ctx.layout.gutter, y, ctx.layout.contentW, 52, tokens.primaryStrong, tokens.radiusControl);
  text(ctx, ctx.contentId, "Continue label", ctx.layout.gutter, y + 16, ctx.layout.contentW, tokens.bodyLine, "Continue", tokens.bodySize, 600, tokens.onPrimary, tokens.bodyLine, "center");
  text(ctx, ctx.contentId, "Signup link", ctx.layout.gutter, y + 72, ctx.layout.contentW, tokens.bodyLine, "New user? Create account", tokens.subtextSize, 500, tokens.primaryMedium, tokens.subtextLine, "center");

  const count = Object.keys(ctx.nodes).length;
  return finalizeRichResult(ctx, { ...options, title }, `Rich auth · ${count} layers`);
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
