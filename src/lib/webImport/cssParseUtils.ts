import { clamp01, parseCssColor } from "@/lib/color";
import type { CornerRadii } from "@/lib/cornerRadius";
import type { PrimaryAxisAlign, CrossAxisAlign } from "@/lib/autoLayout";
import type { DomSnapshotStyles } from "@/lib/webImport/types";

export function parsePx(v: string | undefined, fallback?: number): number | undefined {
  if (!v) return fallback;
  const s = v.trim();
  if (!s || s === "auto" || s === "none" || s.endsWith("%")) return fallback;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

export function parseOpacity(v: string | undefined): number {
  const n = parseFloat(v ?? "1");
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

/** Normalize CSS colors to #rrggbb for the scene graph / WASM renderer. */
export function parseColor(css: string | undefined): string | undefined {
  if (!css || css === "transparent" || css === "rgba(0, 0, 0, 0)") return undefined;
  const parsed = parseCssColor(css.trim());
  return parsed?.hex;
}

/** Parse a CSS color and return separate hex + alpha when rgba(). */
export function parseColorWithOpacity(
  css: string | undefined,
): { color?: string; opacity?: number } {
  if (!css || css === "transparent" || css === "rgba(0, 0, 0, 0)") return {};
  const parsed = parseCssColor(css.trim());
  if (!parsed) return {};
  return { color: parsed.hex, opacity: parsed.opacity };
}

export function mergeColorOpacity(
  baseOpacity: number | undefined,
  colorOpacity: number | undefined,
): number | undefined {
  if (colorOpacity == null) return baseOpacity;
  const merged = clamp01((baseOpacity ?? 1) * colorOpacity);
  return merged < 0.999 ? merged : baseOpacity;
}

const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "helvetica neue",
  "helvetica",
  "arial",
  "inherit",
  "initial",
  "default",
]);

const WEB_FONT_ALIASES: Record<string, string> = {
  "instrument sans": "Inter",
  "instrument sans fallback": "Inter",
};

import { preserveImportFontFamily } from "@/lib/text/textFontManager";

/** Preserve imported web font family names; use Inter only as fallback in the stack. */
export function resolveImportFontFamily(stack: string | undefined): string {
  if (!stack?.trim()) return "Inter, system-ui, sans-serif";
  const families = stack
    .split(",")
    .map((f) => f.replace(/['"]/g, "").trim())
    .filter(Boolean);
  for (const fam of families) {
    const key = fam.toLowerCase();
    if (!GENERIC_FONT_FAMILIES.has(key)) {
      return preserveImportFontFamily(fam);
    }
  }
  return "Inter, system-ui, sans-serif";
}

export function fontWeightNum(w: string | undefined): number {
  if (!w) return 400;
  const n = parseInt(w, 10);
  if (Number.isFinite(n)) return n;
  if (w === "bold" || w === "bolder") return 700;
  if (w === "lighter") return 300;
  return 400;
}

export function mapTextAlign(v: string | undefined): "left" | "center" | "right" {
  if (v === "center") return "center";
  if (v === "right" || v === "end") return "right";
  return "left";
}

export function mapPrimaryAxisAlign(v: string | undefined): PrimaryAxisAlign {
  if (v === "center") return "center";
  if (v === "flex-end" || v === "end") return "end";
  if (v === "space-between") return "space-between";
  return "start";
}

export function mapCounterAxisAlign(v: string | undefined): CrossAxisAlign {
  if (v === "center") return "center";
  if (v === "flex-end" || v === "end") return "end";
  if (v === "stretch" || v === "baseline") return "stretch";
  return "start";
}

export function parseCornerRadii(styles: DomSnapshotStyles): {
  cornerRadius?: number;
  cornerRadii?: CornerRadii;
} {
  const tl = parsePx(styles.borderTopLeftRadius);
  const tr = parsePx(styles.borderTopRightRadius);
  const br = parsePx(styles.borderBottomRightRadius);
  const bl = parsePx(styles.borderBottomLeftRadius);
  if (tl != null || tr != null || br != null || bl != null) {
    const radii: CornerRadii = [tl ?? 0, tr ?? 0, br ?? 0, bl ?? 0];
    if (radii[0] === radii[1] && radii[1] === radii[2] && radii[2] === radii[3]) {
      return { cornerRadius: radii[0] };
    }
    return { cornerRadii: radii };
  }
  const all = parsePx(styles.borderRadius);
  return all != null ? { cornerRadius: all } : {};
}

export function parseBorder(styles: DomSnapshotStyles): {
  strokeColor?: string;
  strokeWidth?: number;
} {
  const widths = [
    parsePx(styles.borderTopWidth),
    parsePx(styles.borderRightWidth),
    parsePx(styles.borderBottomWidth),
    parsePx(styles.borderLeftWidth),
  ].filter((n): n is number => n != null && n > 0);
  const colors = [
    parseColor(styles.borderTopColor),
    parseColor(styles.borderRightColor),
    parseColor(styles.borderBottomColor),
    parseColor(styles.borderLeftColor),
  ].filter(Boolean) as string[];
  if (widths.length > 0) {
    return {
      strokeWidth: Math.max(...widths),
      strokeColor: colors[0] ?? parseColorFromShorthand(styles.border),
    };
  }
  const shorthand = parseBorderShorthand(styles.border);
  return shorthand;
}

function parseColorFromShorthand(border: string | undefined): string | undefined {
  if (!border || border === "none" || border === "0") return undefined;
  const m = border.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/);
  return m?.[1] ? parseColor(m[1]) : undefined;
}

function parseBorderShorthand(border: string | undefined): {
  strokeColor?: string;
  strokeWidth?: number;
} {
  if (!border || border === "none" || border === "0") return {};
  const width = parsePx(border.split(/\s+/)[0]);
  const color = parseColorFromShorthand(border);
  return {
    strokeWidth: width,
    strokeColor: color,
  };
}

export function parseLineHeight(
  lineHeight: string | undefined,
  fontSize: number | undefined,
): number | undefined {
  if (!lineHeight || lineHeight === "normal") return undefined;
  const px = parsePx(lineHeight);
  if (px != null) {
    if (fontSize && fontSize > 0) return px / fontSize;
    return px;
  }
  const n = parseFloat(lineHeight);
  return Number.isFinite(n) ? n : undefined;
}

export function parseLetterSpacing(
  letterSpacing: string | undefined,
  fontSize: number | undefined,
): number | undefined {
  const px = parsePx(letterSpacing);
  if (px != null) return px;
  if (letterSpacing?.endsWith("em") && fontSize) {
    const n = parseFloat(letterSpacing);
    return Number.isFinite(n) ? n * fontSize : undefined;
  }
  return undefined;
}

export function isPercent(v: string | undefined): boolean {
  return Boolean(v?.trim().endsWith("%"));
}

export function isAuto(v: string | undefined): boolean {
  return !v || v.trim() === "auto";
}
