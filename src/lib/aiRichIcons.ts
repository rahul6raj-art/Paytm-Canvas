import type { ExtractedDesignTokens } from "@/lib/aiDesignTokens";
import type { EditorNode } from "@/stores/useEditorStore";

export type RichIconKey =
  | "steps"
  | "calories"
  | "minutes"
  | "run"
  | "walk"
  | "yoga"
  | "workout"
  | "chart"
  | "activity"
  | "back"
  | "bell"
  | "search"
  | "home"
  | "profile"
  | "payment"
  | "wallet"
  | "offer"
  | "location";

const GLYPHS: Record<RichIconKey, string> = {
  steps: "👟",
  calories: "🔥",
  minutes: "⏱",
  run: "🏃",
  walk: "🚶",
  yoga: "🧘",
  workout: "💪",
  chart: "📊",
  activity: "⚡",
  back: "‹",
  bell: "🔔",
  search: "⌕",
  home: "⌂",
  profile: "👤",
  payment: "↗",
  wallet: "💳",
  offer: "★",
  location: "📍",
};

export type IconBuildCtx = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  nextId: () => string;
  tokens: Pick<ExtractedDesignTokens, "fontFamily">;
};

export function iconGlyph(key: RichIconKey): string {
  return GLYPHS[key];
}

export function statIconForLabel(label: string): RichIconKey {
  const t = label.toLowerCase();
  if (t.includes("step")) return "steps";
  if (t.includes("calor")) return "calories";
  if (t.includes("min")) return "minutes";
  if (t.includes("distance")) return "walk";
  return "activity";
}

export function activityIconForName(name: string): RichIconKey {
  const t = name.toLowerCase();
  if (t.includes("run") || t.includes("jog")) return "run";
  if (t.includes("walk")) return "walk";
  if (t.includes("yoga") || t.includes("stretch")) return "yoga";
  if (t.includes("cycle") || t.includes("bike")) return "activity";
  if (t.includes("swim")) return "activity";
  return "workout";
}

export function quickActionIcon(label: string): RichIconKey {
  const t = label.toLowerCase();
  if (t.includes("scan") || t.includes("pay")) return "payment";
  if (t.includes("mobile") || t.includes("phone")) return "payment";
  if (t.includes("bank")) return "wallet";
  if (t.includes("transfer")) return "payment";
  if (t.includes("lite")) return "wallet";
  if (t.includes("balance")) return "wallet";
  if (t.includes("recharge")) return "payment";
  return "activity";
}

/** Rounded icon badge — tinted background + centered glyph. */
export function iconBadge(
  ctx: IconBuildCtx,
  parentId: string,
  name: string,
  x: number,
  y: number,
  size: number,
  key: RichIconKey,
  bg: string,
  fg: string,
): string {
  const radius = Math.round(size / 2);
  const id = `icon-${ctx.nextId()}`;
  ctx.nodes[id] = {
    id,
    parentId,
    type: "rectangle",
    name: `${name} icon`,
    x,
    y,
    width: size,
    height: size,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: bg,
    cornerRadius: radius,
    strokeWidth: 0,
  };
  if (!ctx.childOrder[parentId]) ctx.childOrder[parentId] = [];
  ctx.childOrder[parentId]!.push(id);

  const glyph = iconGlyph(key);
  const fontSize = key === "back" ? Math.round(size * 0.62) : Math.round(size * 0.48);
  const textId = `icon-t-${ctx.nextId()}`;
  ctx.nodes[textId] = {
    id: textId,
    parentId,
    type: "text",
    name: `${name} glyph`,
    x,
    y,
    width: size,
    height: size,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content: glyph,
    fill: fg,
    fontSize,
    fontWeight: key === "back" ? 700 : 500,
    fontFamily: ctx.tokens.fontFamily,
    lineHeight: 1,
    textAlign: "center",
    verticalAlign: "middle",
    textResizeMode: "fixed",
    autoResize: "none",
  };
  ctx.childOrder[parentId]!.push(textId);
  return id;
}
