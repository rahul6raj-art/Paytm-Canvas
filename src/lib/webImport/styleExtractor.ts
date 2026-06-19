import { newNodeEffectId } from "@/lib/nodeEffects";
import type { NodeEffect } from "@/lib/nodeEffects";
import type { FillGradient } from "@/lib/fillGradient";
import { defaultFillGradient, newGradientStopId } from "@/lib/gradient";
import type {
  DomSnapshotNode,
  DomSnapshotStyles,
  DomPseudoElement,
  ExtractedTypography,
  ExtractedVisualStyle,
  EditorImageFit,
} from "@/lib/webImport/types";
import {
  fontWeightNum,
  mapTextAlign,
  parseBorder,
  mergeColorOpacity,
  parseColor,
  parseColorWithOpacity,
  parseCornerRadii,
  parseLetterSpacing,
  parseLineHeight,
  parseOpacity,
  parsePx,
  resolveImportFontFamily,
} from "@/lib/webImport/cssParseUtils";

export function extractVisualStyle(styles: DomSnapshotStyles): ExtractedVisualStyle {
  const bg = parseColorWithOpacity(styles.backgroundColor);
  const fill = bg.color;
  const gradient = parseBackgroundGradient(styles);
  const border = parseBorder(styles);
  const ring = parseRingOrOutlineStroke(styles);
  const effects = [
    ...parseBoxShadowEffects(styles.boxShadow),
    ...parseCssFilterEffects(styles.filter, styles.backdropFilter),
  ];
  const opacity = mergeColorOpacity(parseOpacity(styles.opacity), bg.opacity);

  const strokeWidth = border.strokeWidth ?? ring.strokeWidth;
  const strokeColor = border.strokeColor ?? ring.strokeColor;

  const out: ExtractedVisualStyle = {
    fill: gradient?.fill ?? fill,
    fillEnabled: Boolean(gradient?.fill ?? fill),
    fillOpacity: opacity,
    fillType: gradient?.fillType,
    fillGradient: gradient?.fillGradient,
    strokeColor,
    strokeWidth,
    strokeEnabled: Boolean(strokeWidth && strokeWidth > 0 && strokeColor),
    opacity,
    blendMode: styles.mixBlendMode && styles.mixBlendMode !== "normal" ? styles.mixBlendMode : undefined,
    effects: effects.length ? effects : undefined,
    imageFitMode: mapObjectFit(styles.objectFit),
    ...parseCornerRadii(styles),
  };
  return out;
}

export function extractTypography(styles: DomSnapshotStyles): ExtractedTypography {
  const fontSize = parsePx(styles.fontSize, 14) ?? 14;
  const textColor = parseColorWithOpacity(styles.color);
  return {
    fontFamily: resolveImportFontFamily(styles.fontFamily),
    fontSize: Math.max(8, Math.round(fontSize)),
    fontWeight: fontWeightNum(styles.fontWeight),
    fontStyle: styles.fontStyle && styles.fontStyle !== "normal" ? styles.fontStyle : undefined,
    lineHeight: parseLineHeight(styles.lineHeight, fontSize),
    letterSpacing: parseLetterSpacing(styles.letterSpacing, fontSize),
    textAlign: mapTextAlign(styles.textAlign),
    textDecoration:
      styles.textDecoration && styles.textDecoration !== "none" ? styles.textDecoration : undefined,
    textTransform:
      styles.textTransform && styles.textTransform !== "none" ? styles.textTransform : undefined,
    verticalAlign: mapVerticalAlign(styles.verticalAlign),
    color: textColor.color,
  };
}

export function extractTextStyle(styles: DomSnapshotStyles): ExtractedVisualStyle {
  const textFill = parseColor(styles.color) ?? "#111111";
  const opacity = parseOpacity(styles.opacity);
  return {
    fill: textFill,
    fillEnabled: true,
    fillOpacity: opacity,
    opacity,
  };
}

export function extractPseudoStyle(pseudo: DomPseudoElement): ExtractedVisualStyle {
  return extractVisualStyle(pseudo.styles);
}

function mapVerticalAlign(v: string | undefined): "top" | "middle" | "bottom" | undefined {
  if (v === "middle") return "middle";
  if (v === "bottom" || v === "sub") return "bottom";
  if (v === "top" || v === "baseline") return "top";
  return undefined;
}

function mapObjectFit(v: string | undefined): EditorImageFit | undefined {
  if (!v) return undefined;
  if (v === "contain") return "fit";
  if (v === "cover") return "crop";
  if (v === "fill") return "fill";
  if (v === "none" || v === "scale-down") return "fit";
  return undefined;
}

function parseRingOrOutlineStroke(styles: DomSnapshotStyles): {
  strokeColor?: string;
  strokeWidth?: number;
} {
  const outlineW = parsePx(styles.outlineWidth, 0) ?? 0;
  const outlineColor = parseColor(styles.outlineColor);
  if (outlineW > 0 && outlineColor && styles.outlineStyle !== "none") {
    return { strokeWidth: outlineW, strokeColor: outlineColor };
  }
  const shadow = styles.boxShadow ?? "";
  if (!shadow || shadow === "none") return {};
  const layers = shadow.split(/,(?![^(]*\))/).map((s) => s.trim());
  for (const layer of layers) {
    const trailingColor = layer.match(
      /0px?\s+0px?\s+0px?\s+([\d.]+)px\s+(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/i,
    );
    if (trailingColor) {
      return {
        strokeWidth: parseFloat(trailingColor[1]!),
        strokeColor: parseColor(trailingColor[2]) ?? trailingColor[2],
      };
    }
    const leadingColor = layer.match(
      /^(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})\s+0px?\s+0px?\s+0px?\s+([\d.]+)px/i,
    );
    if (leadingColor) {
      return {
        strokeWidth: parseFloat(leadingColor[2]!),
        strokeColor: parseColor(leadingColor[1]) ?? leadingColor[1],
      };
    }
  }
  return {};
}

function extractCssGradientInner(bg: string, kind: "linear" | "radial"): string | null {
  const prefix = `${kind}-gradient(`;
  const start = bg.toLowerCase().indexOf(prefix);
  if (start < 0) return null;
  let depth = 0;
  let innerStart = -1;
  for (let i = start; i < bg.length; i++) {
    const ch = bg[i];
    if (ch === "(") {
      depth++;
      if (depth === 1) innerStart = i + 1;
    } else if (ch === ")") {
      if (depth === 1) return bg.slice(innerStart, i);
      depth--;
    }
  }
  return null;
}

function parseBackgroundGradient(styles: DomSnapshotStyles): {
  fill?: string;
  fillType?: "gradient";
  fillGradient?: FillGradient;
} | null {
  const bg = styles.backgroundImage ?? "";
  if (!bg || bg === "none") return null;

  for (const kind of ["linear", "radial"] as const) {
    const inner = extractCssGradientInner(bg, kind);
    if (!inner) continue;
    const stops = parseGradientStops(inner);
    if (stops.length >= 2) {
      const g = defaultFillGradient(stops[0]!.color, kind);
      g.stops = stops.map((s) => ({
        id: newGradientStopId(),
        color: s.color,
        opacity: s.opacity,
        position: Math.round(s.position * 100),
      }));
      return { fill: stops[0]!.color, fillType: "gradient", fillGradient: g };
    }
  }

  return null;
}

const GRADIENT_SHAPE_TOKENS = new Set([
  "circle",
  "ellipse",
  "closest-side",
  "closest-corner",
  "farthest-side",
  "farthest-corner",
  "center",
  "top",
  "bottom",
  "left",
  "right",
]);

function isGradientShapeToken(part: string): boolean {
  const t = part.trim().toLowerCase();
  if (GRADIENT_SHAPE_TOKENS.has(t)) return true;
  if (t.startsWith("at ")) return true;
  return false;
}

function splitGradientParts(inner: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseGradientStops(
  inner: string,
): Array<{ position: number; color: string; opacity: number }> {
  const parts = splitGradientParts(inner);
  const colorParts = parts.filter(
    (p) => !p.endsWith("deg") && !p.startsWith("to ") && !isGradientShapeToken(p),
  );
  const stops: Array<{ position: number; color: string; opacity: number }> = [];
  for (let i = 0; i < colorParts.length; i++) {
    const part = colorParts[i]!;
    const pct = part.match(/([\d.]+)%\s*$/);
    const colorRaw = pct ? part.replace(pct[0], "").trim() : part;
    const position = pct ? parseFloat(pct[1]!) / 100 : i / Math.max(1, colorParts.length - 1);
    if (!colorRaw || colorRaw === "transparent" || isGradientShapeToken(colorRaw)) continue;
    const parsed = parseColorWithOpacity(colorRaw);
    if (!parsed.color) continue;
    stops.push({
      position: Math.max(0, Math.min(1, position)),
      color: parsed.color,
      opacity: parsed.opacity ?? 1,
    });
  }
  return stops;
}

function parseBoxShadowEffects(boxShadow: string | undefined): NodeEffect[] {
  if (!boxShadow || boxShadow === "none") return [];
  const effects: NodeEffect[] = [];
  for (const layer of splitBoxShadowLayers(boxShadow)) {
    const inner = layer.trim().startsWith("inset");
    const cleaned = inner ? layer.replace(/^inset\s+/i, "").trim() : layer.trim();
    const rgba = cleaned.match(/(rgba?\([^)]+\))/);
    const color = parseColor(rgba?.[1]) ?? "#000000";
    const nums = cleaned
      .replace(rgba?.[0] ?? "", "")
      .trim()
      .split(/\s+/)
      .map((v) => parseFloat(v))
      .filter((n) => Number.isFinite(n));
    if (nums.length < 2) continue;
    const [x, y, blur = 0, spread = 0] = nums;
    const opacityMatch = color.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
    effects.push({
      id: newNodeEffectId(),
      type: inner ? "inner-shadow" : "drop-shadow",
      visible: true,
      x,
      y,
      blur,
      spread,
      color: color.startsWith("rgb") ? "#000000" : color,
      opacity: opacityMatch ? parseFloat(opacityMatch[1]!) : 0.25,
    });
  }
  return effects;
}

function parseCssFilterEffects(
  filter?: string,
  backdropFilter?: string,
): NodeEffect[] {
  const effects: NodeEffect[] = [];
  if (filter && filter !== "none") {
    const blurMatch = filter.match(/blur\(([\d.]+)px\)/i);
    if (blurMatch) {
      effects.push({
        id: newNodeEffectId(),
        type: "layer-blur",
        visible: true,
        blur: parseFloat(blurMatch[1]!),
      });
    }
  }
  if (backdropFilter && backdropFilter !== "none") {
    const blurMatch = backdropFilter.match(/blur\(([\d.]+)px\)/i);
    if (blurMatch) {
      const satMatch = backdropFilter.match(/saturate\(([\d.]+)%?\)/i);
      effects.push({
        id: newNodeEffectId(),
        type: "background-blur",
        visible: true,
        blur: parseFloat(blurMatch[1]!),
        saturation: satMatch ? parseFloat(satMatch[1]!) : 100,
      });
    }
  }
  return effects;
}

function splitBoxShadowLayers(raw: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      layers.push(raw.slice(start, i));
      start = i + 1;
    }
  }
  layers.push(raw.slice(start));
  return layers;
}

export function mergeNodeStyle(
  node: DomSnapshotNode,
  isText: boolean,
): { style: ExtractedVisualStyle; typography?: ExtractedTypography } {
  if (isText) {
    return {
      style: { ...extractTextStyle(node.styles), ...parseCornerRadii(node.styles) },
      typography: extractTypography(node.styles),
    };
  }
  return { style: extractVisualStyle(node.styles), typography: undefined };
}
