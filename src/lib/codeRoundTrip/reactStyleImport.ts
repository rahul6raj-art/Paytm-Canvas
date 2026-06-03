import type { LayoutMode, PrimaryAxisAlign, CrossAxisAlign } from "@/lib/autoLayout";
import type { CornerRadii } from "@/lib/cornerRadius";
import type { EditorNode } from "@/stores/useEditorStore";
import type { ReactStyleRecord } from "./reactStyle";

function parseBorderRadius(
  v: string | number | undefined,
): Pick<EditorNode, "cornerRadius" | "cornerRadii"> {
  if (v === undefined) return {};
  if (typeof v === "number") return { cornerRadius: v };
  const parts = String(v)
    .trim()
    .split(/\s+/)
    .map((p) => parsePxValue(p))
    .filter((n): n is number => n !== undefined);
  if (parts.length === 0) return {};
  let tl: number;
  let tr: number;
  let br: number;
  let bl: number;
  if (parts.length === 1) {
    return { cornerRadius: parts[0] };
  }
  if (parts.length === 2) {
    tl = br = parts[0]!;
    tr = bl = parts[1]!;
  } else if (parts.length === 3) {
    tl = parts[0]!;
    tr = br = parts[1]!;
    bl = parts[2]!;
  } else {
    tl = parts[0]!;
    tr = parts[1]!;
    br = parts[2]!;
    bl = parts[3]!;
  }
  if (tl === tr && tr === br && br === bl) return { cornerRadius: tl };
  return { cornerRadii: [tl, tr, br, bl] as CornerRadii };
}

function parsePxValue(v: string | number | undefined): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const s = String(v).trim();
  if (s.endsWith("%")) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseColor(css: string | undefined): string | undefined {
  if (!css || css === "transparent" || css === "rgba(0, 0, 0, 0)") return undefined;
  return css;
}

function parseFontWeight(w: string | number | undefined): number | undefined {
  if (w === undefined) return undefined;
  if (typeof w === "number") return w;
  const n = parseInt(w, 10);
  if (Number.isFinite(n)) return n;
  if (w === "bold" || w === "bolder") return 700;
  if (w === "lighter") return 300;
  return 400;
}

function inferFlexLayout(style: ReactStyleRecord): Partial<EditorNode> {
  const display = String(style.display ?? "").toLowerCase();
  if (display !== "flex" && display !== "inline-flex") return {};
  const dir = String(style.flexDirection ?? "row").toLowerCase();
  const layoutMode: LayoutMode = dir.startsWith("column") ? "vertical" : "horizontal";
  const jc = String(style.justifyContent ?? "");
  const ai = String(style.alignItems ?? "");
  const primaryAxisAlign: PrimaryAxisAlign =
    jc === "center"
      ? "center"
      : jc === "flex-end" || jc === "end"
        ? "end"
        : jc === "space-between"
          ? "space-between"
          : "start";
  const counterAxisAlign: CrossAxisAlign =
    ai === "center"
      ? "center"
      : ai === "flex-end" || ai === "end"
        ? "end"
        : ai === "stretch"
          ? "stretch"
          : "start";
  const patch: Partial<EditorNode> = {
    layoutMode,
    layoutGap: parsePxValue(style.gap as string | number | undefined),
    primaryAxisAlign,
    counterAxisAlign,
  };
  const pad = style.padding;
  if (typeof pad === "number") {
    patch.paddingTop = pad;
    patch.paddingRight = pad;
    patch.paddingBottom = pad;
    patch.paddingLeft = pad;
  } else if (typeof pad === "string") {
    const parts = pad.split(/\s+/).map((p) => parsePxValue(p) ?? 0);
    if (parts.length === 1) {
      patch.paddingTop = patch.paddingRight = patch.paddingBottom = patch.paddingLeft = parts[0];
    } else if (parts.length === 2) {
      patch.paddingTop = patch.paddingBottom = parts[0];
      patch.paddingRight = patch.paddingLeft = parts[1];
    } else if (parts.length >= 4) {
      patch.paddingTop = parts[0];
      patch.paddingRight = parts[1];
      patch.paddingBottom = parts[2];
      patch.paddingLeft = parts[3];
    }
  }
  patch.paddingTop = patch.paddingTop ?? parsePxValue(style.paddingTop as string | number | undefined);
  patch.paddingRight = patch.paddingRight ?? parsePxValue(style.paddingRight as string | number | undefined);
  patch.paddingBottom = patch.paddingBottom ?? parsePxValue(style.paddingBottom as string | number | undefined);
  patch.paddingLeft = patch.paddingLeft ?? parsePxValue(style.paddingLeft as string | number | undefined);
  return patch;
}

/** Map inline React style object → partial EditorNode geometry & appearance. */
export function reactStyleToNodePatch(style: ReactStyleRecord): Partial<EditorNode> {
  const patch: Partial<EditorNode> = {};

  const w = parsePxValue(style.width as string | number | undefined);
  const h = parsePxValue(style.height as string | number | undefined);
  const minW = parsePxValue(style.minWidth as string | number | undefined);
  const minH = parsePxValue(style.minHeight as string | number | undefined);
  if (w !== undefined) patch.width = Math.max(1, w);
  else if (minW !== undefined) patch.width = Math.max(1, minW);
  if (h !== undefined) patch.height = Math.max(1, h);
  else if (minH !== undefined) patch.height = Math.max(1, minH);

  const left = parsePxValue(style.left as string | number | undefined);
  const top = parsePxValue(style.top as string | number | undefined);
  if (left !== undefined) patch.x = left;
  if (top !== undefined) patch.y = top;

  const pos = String(style.position ?? "");
  if (pos === "relative" || pos === "static") {
    patch.x = patch.x ?? 0;
    patch.y = patch.y ?? 0;
  }

  const rot = style.transform;
  if (typeof rot === "string") {
    const m = rot.match(/rotate\(([-\d.]+)deg\)/);
    if (m) patch.rotation = parseFloat(m[1]) ?? 0;
  }

  if (style.opacity !== undefined) {
    const o = typeof style.opacity === "number" ? style.opacity : parseFloat(String(style.opacity));
    if (Number.isFinite(o)) patch.opacity = o;
  }

  const color = parseColor(String(style.color ?? ""));
  const bg = parseColor(String(style.background ?? style.backgroundColor ?? ""));
  if (color) {
    patch.textColor = color;
    patch.fill = color;
  }
  if (bg) {
    patch.fill = bg;
    patch.fillEnabled = true;
  }

  if (style.fontFamily) patch.fontFamily = String(style.fontFamily);
  const fs = parsePxValue(style.fontSize as string | number | undefined);
  if (fs !== undefined) patch.fontSize = fs;
  const fw = parseFontWeight(style.fontWeight as string | number | undefined);
  if (fw !== undefined) patch.fontWeight = fw;
  if (style.lineHeight !== undefined) {
    const lh = typeof style.lineHeight === "number" ? style.lineHeight : parseFloat(String(style.lineHeight));
    if (Number.isFinite(lh)) patch.lineHeight = lh;
  }
  if (style.letterSpacing !== undefined) {
    const ls = parsePxValue(style.letterSpacing as string | number | undefined);
    if (ls !== undefined) patch.letterSpacing = ls;
  }
  if (style.textAlign === "center" || style.textAlign === "right" || style.textAlign === "left") {
    patch.textAlign = style.textAlign;
  }

  Object.assign(patch, parseBorderRadius(style.borderRadius as string | number | undefined));

  const border = style.border;
  if (typeof border === "string") {
    const parts = border.split(/\s+/);
    const width = parsePxValue(parts[0]);
    const color = parts.length >= 3 ? parts.slice(2).join(" ") : parts[1];
    if (width !== undefined) patch.strokeWidth = width;
    if (color && !color.includes("solid") && !color.includes("dashed")) {
      patch.strokeColor = color;
    }
  }

  Object.assign(patch, inferFlexLayout(style));
  return patch;
}
