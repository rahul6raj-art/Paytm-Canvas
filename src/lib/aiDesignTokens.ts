import type { AIStyleId } from "@/lib/aiMockGenerator";
import { getPalette } from "@/lib/aiMockGenerator";

/** Craft editor stack for Inter — maps design.md aliases like `inter-subset`. */
export const CRAFT_INTER_FONT_STACK = "var(--font-inter), Inter, system-ui, sans-serif";

const DESIGN_MD_FONT_ALIASES: Record<string, string> = {
  "inter-subset": CRAFT_INTER_FONT_STACK,
  inter: CRAFT_INTER_FONT_STACK,
  "inter var": CRAFT_INTER_FONT_STACK,
};

export type ExtractedDesignTokens = {
  brandPrimary: string;
  brandSecondary: string;
  primaryStrong: string;
  primaryMedium: string;
  canvas: string;
  wash: string;
  surface3: string;
  ink: string;
  muted: string;
  moderate: string;
  hairline: string;
  positive: string;
  notice: string;
  noticeWeak: string;
  onPrimary: string;
  primaryWeak: string;
  /** PODS mobile shell width (design.md: 376px). */
  shellWidth: number;
  shellHeight: number;
  gutter: number;
  cardPad: number;
  sectionGap: number;
  headerToCard: number;
  gridGap: number;
  radiusCard: number;
  radiusControl: number;
  displaySize: number;
  displayLine: number;
  sectionHeaderSize: number;
  sectionHeaderLine: number;
  titleSize: number;
  titleLine: number;
  bodySize: number;
  bodyLine: number;
  subtextSize: number;
  subtextLine: number;
  captionSize: number;
  captionLine: number;
  fontFamily: string;
  source: "design-md" | "prompt" | "style";
};

function parseYamlColors(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^\s{2}([a-z0-9-]+):\s*"(#[0-9a-fA-F]{3,8})"/i);
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

type TypoScale = {
  display: { size: number; line: number };
  sectionHeader: { size: number; line: number };
  title: { size: number; line: number };
  body: { size: number; line: number };
  subtext: { size: number; line: number };
  caption: { size: number; line: number };
  family: string;
};

function parseTypoRole(block: string, role: string): { size: number; line: number } | undefined {
  const m = block.match(new RegExp(`${role}:[\\s\\S]*?fontSize:\\s*(\\d+)[\\s\\S]*?lineHeight:\\s*(\\d+)`));
  if (!m) return undefined;
  return { size: Number(m[1]), line: Number(m[2]) };
}

function parseTypoRoleFont(block: string, role: string): string | undefined {
  const m = block.match(new RegExp(`${role}:[\\s\\S]*?fontFamily:\\s*"([^"]+)"`));
  return m?.[1];
}

/** Map design.md font names to families Craft can render (Inter subset → app Inter). */
export function resolveDesignMdFontStack(raw?: string): string {
  if (!raw?.trim()) return CRAFT_INTER_FONT_STACK;
  const normalized = raw.replace(/inter-subset/gi, "Inter");
  const primary = normalized.split(",")[0]!.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
  const alias = DESIGN_MD_FONT_ALIASES[primary];
  if (alias) return alias;
  if (primary === "inter") return CRAFT_INTER_FONT_STACK;
  return normalized;
}

function parseTypographySizes(block: string): TypoScale {
  const familyRaw =
    parseTypoRoleFont(block, "body-regular") ??
    parseTypoRoleFont(block, "section-header-default") ??
    parseTypoRoleFont(block, "title3-bold") ??
    block.match(/fontFamily:\s*"([^"]+)"/)?.[1];
  const family = resolveDesignMdFontStack(familyRaw);
  return {
    display: parseTypoRole(block, "display3-bold") ?? { size: 32, line: 36 },
    sectionHeader:
      parseTypoRole(block, "section-header-default") ??
      parseTypoRole(block, "title1-bold") ??
      { size: 22, line: 28 },
    title: parseTypoRole(block, "title3-bold") ?? { size: 18, line: 24 },
    body: parseTypoRole(block, "body-regular") ?? { size: 14, line: 20 },
    subtext: parseTypoRole(block, "subtext-regular") ?? { size: 12, line: 16 },
    caption: parseTypoRole(block, "caption-regular") ?? { size: 10, line: 12 },
    family,
  };
}

function parseYamlPxValues(block: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^\s{2}([\w-]+):\s*(\d+)px\s*$/);
    if (m) out[m[1]!] = Number(m[2]);
  }
  return out;
}

function parseShellWidth(context: string): number | undefined {
  const m = context.match(/mobile-preview-shell:[\s\S]*?width:\s*(\d+)/);
  return m ? Number(m[1]) : undefined;
}

function hexFromPrompt(text: string): string[] {
  const found = text.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
  return [...new Set(found.map((h) => h.toLowerCase()))];
}

export function extractDesignTokens(
  contextPrompt: string | undefined,
  prompt: string,
  style: AIStyleId,
): ExtractedDesignTokens {
  const base = getPalette(style);
  const merged = `${contextPrompt ?? ""}\n${prompt}`;
  const promptHexes = hexFromPrompt(merged);

  let colors: Record<string, string> = {};
  let typo = parseTypographySizes("");
  let spacing: Record<string, number> = {};
  let rounded: Record<string, number> = {};
  let shellWidth: number | undefined;
  let source: ExtractedDesignTokens["source"] = "style";

  if (contextPrompt?.includes("colors:")) {
    const colorsBlock = contextPrompt.match(/colors:\n([\s\S]*?)(?:\n\w|\n#|$)/)?.[1];
    if (colorsBlock) {
      colors = parseYamlColors(`colors:\n${colorsBlock}`);
      source = "design-md";
    }
  }
  if (contextPrompt?.includes("typography:")) {
    const typoBlock = contextPrompt.match(/typography:\n([\s\S]*?)(?:\n\w+:|$)/)?.[1];
    if (typoBlock) typo = parseTypographySizes(typoBlock);
  }
  if (contextPrompt?.includes("spacing:")) {
    const spacingBlock = contextPrompt.match(/spacing:\n([\s\S]*?)(?:\n\w+:|$)/)?.[1];
    if (spacingBlock) spacing = parseYamlPxValues(spacingBlock);
  }
  if (contextPrompt?.includes("rounded:")) {
    const roundedBlock = contextPrompt.match(/rounded:\n([\s\S]*?)(?:\n\w+:|$)/)?.[1];
    if (roundedBlock) rounded = parseYamlPxValues(roundedBlock);
  }
  if (contextPrompt) shellWidth = parseShellWidth(contextPrompt);

  if (promptHexes.length >= 2) source = source === "design-md" ? "design-md" : "prompt";

  return {
    brandPrimary: colors["brand-primary"] ?? promptHexes[0] ?? "#00b8f5",
    brandSecondary: colors["brand-secondary"] ?? promptHexes[1] ?? "#012a72",
    primaryStrong: colors["primary-strong"] ?? "#004299",
    primaryMedium: colors["primary-medium"] ?? "#1576db",
    canvas: colors.canvas ?? colors["surface-level-1"] ?? "#ffffff",
    wash: colors["surface-level-4"] ?? colors["wash-offset-sky"] ?? "#f5f5f5",
    surface3: colors["surface-level-3"] ?? "#fafafa",
    ink: colors.ink ?? "#282828",
    muted: colors["body-medium"] ?? "#7e7e7e",
    moderate: colors["body-moderate"] ?? "#414244",
    hairline: colors.hairline ?? "#ebebeb",
    positive: colors["semantic-positive"] ?? "#158939",
    notice: colors["semantic-notice"] ?? "#ffa905",
    noticeWeak: colors["semantic-notice-weak"] ?? "#fff2cc",
    onPrimary: colors["on-primary-filled"] ?? "#ffffff",
    primaryWeak: colors["primary-weak"] ?? "#dfedff",
    shellWidth: shellWidth ?? 376,
    shellHeight: 812,
    gutter: spacing["page-gutter"] ?? 12,
    cardPad: spacing["card-padding"] ?? 16,
    sectionGap: spacing["gap-4xl"] ?? 24,
    headerToCard: spacing["section-header-to-card"] ?? 8,
    gridGap: spacing["gap-2xl"] ?? 12,
    radiusCard: rounded["3xl"] ?? 24,
    radiusControl: rounded.m ?? 8,
    displaySize: typo.display.size,
    displayLine: typo.display.line,
    sectionHeaderSize: typo.sectionHeader.size,
    sectionHeaderLine: typo.sectionHeader.line,
    titleSize: typo.title.size,
    titleLine: typo.title.line,
    bodySize: typo.body.size,
    bodyLine: typo.body.line,
    subtextSize: typo.subtext.size,
    subtextLine: typo.subtext.line,
    captionSize: typo.caption.size,
    captionLine: typo.caption.line,
    fontFamily: typo.family,
    source,
  };
}

export function extractUserNameFromPrompt(prompt: string): string | undefined {
  const patterns = [
    /good\s+(?:morning|afternoon|evening),?\s+([A-Z][a-z]+)/i,
    /greeting:?\s*["']?good\s+\w+,?\s+([A-Z][a-z]+)/i,
    /(?:hi|hello|hey),?\s+([A-Z][a-z]+)/i,
    /user(?:\s+name)?[:\s]+([A-Z][a-z]+)/i,
  ];
  for (const p of patterns) {
    const m = prompt.match(p);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

export function designTokensPromptBlock(tokens: ExtractedDesignTokens): string {
  return [
    "Design tokens (use these exact colors and sizes):",
    `- brand primary: ${tokens.brandPrimary}`,
    `- brand secondary: ${tokens.brandSecondary}`,
    `- canvas: ${tokens.canvas}`,
    `- page wash: ${tokens.wash}`,
    `- text ink: ${tokens.ink}`,
    `- muted text: ${tokens.muted}`,
    `- hairline border: ${tokens.hairline}`,
    `- shell width: ${tokens.shellWidth}px, gutter: ${tokens.gutter}px`,
    `- section header: ${tokens.sectionHeaderSize}px / ${tokens.sectionHeaderLine}px`,
    `- font family (use on every text node): ${tokens.fontFamily}`,
    `- title: ${tokens.titleSize}px, body: ${tokens.bodySize}px, subtext: ${tokens.subtextSize}px`,
    `- card radius: ${tokens.radiusCard}px, section gap: ${tokens.sectionGap}px`,
  ].join("\n");
}

export type ParsedTransaction = { merchant: string; amount: string; time: string };

export function extractTransactionsFromPrompt(prompt: string): ParsedTransaction[] | undefined {
  const rows: ParsedTransaction[] = [];
  const lineRe = /(?:^|\n)\s*[-•*]?\s*([A-Za-z][A-Za-z0-9 &.'-]{1,28})\s*[·–-]\s*(₹[\d,]+(?:\.\d{2})?)\s*(?:[·–-]\s*([^,\n]+))?/g;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(prompt)) !== null) {
    rows.push({
      merchant: m[1]!.trim(),
      amount: m[2]!.trim(),
      time: m[3]?.trim() || "Recently",
    });
  }
  if (rows.length >= 2) return rows.slice(0, 6);
  const inline = [...prompt.matchAll(/(?:paid|sent to|received from)\s+([A-Za-z][A-Za-z0-9 &.'-]{1,24})\s+(₹[\d,]+(?:\.\d{2})?)/gi)];
  for (const hit of inline) {
    rows.push({ merchant: hit[1]!.trim(), amount: hit[2]!.trim(), time: "Recently" });
  }
  return rows.length >= 2 ? rows.slice(0, 6) : undefined;
}

export function extractAppTitleFromPrompt(prompt: string, fallback = "Mobile Home Screen"): string {
  const paytm = /paytm/i.test(prompt) ? "Paytm Home" : undefined;
  const named = prompt.match(/(?:design|create|build)\s+(?:a\s+)?(?:modern\s+)?([A-Z][A-Za-z0-9 ]{2,24})\s+(?:mobile\s+)?(?:app\s+)?home/i);
  if (named?.[1]) return `${named[1].trim()} Home`;
  return paytm ?? fallback;
}

/**
 * Rich Paytm-style home layout only when the user explicitly asks for a *home* screen.
 * Feature words alone (UPI, quick actions, bottom nav) must NOT trigger home.
 */
function negatesHomeScreen(t: string): boolean {
  return /not\s+(?:the\s+)?(?:a\s+)?home|non-?home|instead\s+of\s+(?:the\s+)?home|avoid\s+(?:the\s+)?home|skip\s+home|other\s+than\s+home/i.test(
    t,
  );
}

export function isRichMobileHomeIntent(prompt: string): boolean {
  const t = prompt.toLowerCase();
  if (negatesHomeScreen(t)) return false;
  if (/(?:^|[^\w-])(?:mobile\s+)?home\s+(?:screen|tab|page|view)|homepage|home\s+dashboard|main\s+home/.test(t)) {
    return true;
  }
  if (/\bhome\b/.test(t) && /(super.?app|fintech app)/.test(t)) {
    return true;
  }
  return false;
}
