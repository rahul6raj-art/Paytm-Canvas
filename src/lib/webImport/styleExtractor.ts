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
  const effects = parseBoxShadowEffects(styles.boxShadow);
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

function parseBackgroundGradient(styles: DomSnapshotStyles): {
  fill?: string;
  fillType?: "gradient";
  fillGradient?: FillGradient;
} | null {
  const bg = styles.backgroundImage ?? "";
  if (!bg || bg === "none") return null;

  const linear = bg.match(/linear-gradient\(([^)]+)\)/i);
  if (linear) {
    const stops = parseGradientStops(linear[1]!);
    if (stops.length >= 2) {
      const g = defaultFillGradient(stops[0]!.color, "linear");
      g.stops = stops.map((s) => ({
        id: newGradientStopId(),
        color: s.color,
        opacity: 1,
        position: Math.round(s.position * 100),
      }));
      return { fill: stops[0]!.color, fillType: "gradient", fillGradient: g };
    }
  }

  const radial = bg.match(/radial-gradient\(([^)]+)\)/i);
  if (radial) {
    const stops = parseGradientStops(radial[1]!);
    if (stops.length >= 2) {
      const g = defaultFillGradient(stops[0]!.color, "radial");
      g.stops = stops.map((s) => ({
        id: newGradientStopId(),
        color: s.color,
        opacity: 1,
        position: Math.round(s.position * 100),
      }));
      return { fill: stops[0]!.color, fillType: "gradient", fillGradient: g };
    }
  }

  return null;
}

function parseGradientStops(inner: string): Array<{ position: number; color: string }> {
  const parts = inner.split(",").map((p) => p.trim());
  const colorParts = parts.filter((p) => !p.endsWith("deg") && !p.startsWith("to "));
  const stops: Array<{ position: number; color: string }> = [];
  for (let i = 0; i < colorParts.length; i++) {
    const part = colorParts[i]!;
    const pct = part.match(/([\d.]+)%\s*$/);
    const color = pct ? part.replace(pct[0], "").trim() : part.split(/\s+/)[0]!;
    const position = pct ? parseFloat(pct[1]!) / 100 : i / Math.max(1, colorParts.length - 1);
    if (color && color !== "transparent") {
      stops.push({
        position: Math.max(0, Math.min(1, position)),
        color: parseColor(color) ?? color,
      });
    }
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
