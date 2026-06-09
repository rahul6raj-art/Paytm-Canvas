import { clampCornerRadii, cornerRadiiToCss, getNodeCornerRadii } from "@/lib/cornerRadius";
import { effectiveStrokeType } from "@/lib/fillGradient";
import { resolveStrokeStyle } from "@/lib/stroke";
import type { StrokePosition, EditorNode } from "@/stores/useEditorStore";

export type StrokeSidesMode = "all" | "top" | "bottom" | "left" | "right" | "custom";

/** Per-side on/off (boolean) or explicit stroke width in px (number). `true` = use layer strokeWidth. */
export type StrokeSidesCustom = {
  top?: boolean | number;
  right?: boolean | number;
  bottom?: boolean | number;
  left?: boolean | number;
};

export type ResolvedStrokeSides = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

export type ResolvedStrokeSideWidths = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

function resolveCustomSideWidth(
  value: boolean | number | undefined,
  base: number,
): number {
  if (typeof value === "number") return Math.max(0, value);
  if (value === false) return 0;
  return base;
}

/** Per-side stroke weights in px (0 = side off). */
export function resolveStrokeSideWidths(
  node: Pick<EditorNode, "strokeWidth" | "strokeSides" | "strokeSidesCustom">,
): ResolvedStrokeSideWidths {
  const base = Math.max(0, node.strokeWidth ?? 0);
  const mode = node.strokeSides ?? "all";
  if (mode === "top") return { top: base, right: 0, bottom: 0, left: 0 };
  if (mode === "bottom") return { top: 0, right: 0, bottom: base, left: 0 };
  if (mode === "left") return { top: 0, right: 0, bottom: 0, left: base };
  if (mode === "right") return { top: 0, right: base, bottom: 0, left: 0 };
  if (mode === "custom") {
    const c = node.strokeSidesCustom ?? {};
    return {
      top: resolveCustomSideWidth(c.top, base),
      right: resolveCustomSideWidth(c.right, base),
      bottom: resolveCustomSideWidth(c.bottom, base),
      left: resolveCustomSideWidth(c.left, base),
    };
  }
  return { top: base, right: base, bottom: base, left: base };
}

export function strokeSideWidthsAreUniform(widths: ResolvedStrokeSideWidths): boolean {
  return (
    widths.top === widths.right &&
    widths.right === widths.bottom &&
    widths.bottom === widths.left
  );
}

export type StrokeEdgeRect = { x: number; y: number; width: number; height: number };

export function supportsStrokeSides(node: Pick<EditorNode, "type">): boolean {
  return node.type === "rectangle" || node.type === "frame";
}

export function resolveStrokeSides(
  node: Pick<EditorNode, "strokeWidth" | "strokeSides" | "strokeSidesCustom">,
): ResolvedStrokeSides {
  const mode = node.strokeSides ?? "all";
  if (mode === "top") return { top: true, right: false, bottom: false, left: false };
  if (mode === "bottom") return { top: false, right: false, bottom: true, left: false };
  if (mode === "left") return { top: false, right: false, bottom: false, left: true };
  if (mode === "right") return { top: false, right: true, bottom: false, left: false };
  if (mode === "custom") {
    const w = resolveStrokeSideWidths(node);
    return {
      top: w.top > 0,
      right: w.right > 0,
      bottom: w.bottom > 0,
      left: w.left > 0,
    };
  }
  return { top: true, right: true, bottom: true, left: true };
}

/** Preset → per-side weights when entering custom mode. */
export function strokeSidesCustomFromPreset(
  mode: StrokeSidesMode,
  strokeWidth: number,
): StrokeSidesCustom {
  const w = Math.max(0, strokeWidth);
  if (mode === "top") return { top: w, right: 0, bottom: 0, left: 0 };
  if (mode === "bottom") return { top: 0, right: 0, bottom: w, left: 0 };
  if (mode === "left") return { top: 0, right: 0, bottom: 0, left: w };
  if (mode === "right") return { top: 0, right: w, bottom: 0, left: 0 };
  if (mode === "custom") return { top: w, right: w, bottom: w, left: w };
  return { top: w, right: w, bottom: w, left: w };
}

/** Partial side selection, or custom mode with different per-side widths. */
export function usesPerEdgeStroke(
  node: Pick<EditorNode, "type" | "strokeWidth" | "strokeSides" | "strokeSidesCustom">,
): boolean {
  if (!supportsStrokeSides(node)) return false;
  const sides = resolveStrokeSides(node);
  const allOn = sides.top && sides.right && sides.bottom && sides.left;
  if (!allOn) return true;
  if ((node.strokeSides ?? "all") === "custom") {
    return !strokeSideWidthsAreUniform(resolveStrokeSideWidths(node));
  }
  return false;
}

/**
 * Figma individual strokes on rectangles/frames use the CSS border model
 * (per-side widths + border-radius), not open SVG path strokes.
 */
export function strokeUsesCssIndividualBorders(
  node: Pick<
    EditorNode,
    | "type"
    | "strokeWidth"
    | "strokeSides"
    | "strokeSidesCustom"
    | "strokePosition"
    | "strokeStyle"
    | "strokeType"
    | "strokeGradient"
    | "cornerRadius"
    | "cornerRadii"
  >,
): boolean {
  if (!supportsStrokeSides(node) || !usesPerEdgeStroke(node)) return false;
  if (effectiveStrokeType(node) === "gradient") return false;
  if (resolveStrokeStyle(node) !== "solid") return false;
  // Figma individual strokes render as inset side bands (CSS border model).
  const pos = node.strokePosition ?? "center";
  return pos === "inside" || pos === "center";
}

export type IndividualBorderStrokeStyle = {
  position: "absolute";
  inset: 0;
  boxSizing: "border-box";
  borderRadius: string | number;
  borderStyle: "solid";
  borderColor: string;
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  background: "transparent";
  pointerEvents: "none";
};

export function individualBorderStrokeStyle(
  node: Pick<
    EditorNode,
    | "type"
    | "width"
    | "height"
    | "strokeWidth"
    | "strokeSides"
    | "strokeSidesCustom"
    | "strokeColor"
    | "strokeOpacity"
    | "cornerRadius"
    | "cornerRadii"
  >,
  strokeColor: string,
): IndividualBorderStrokeStyle {
  const sideWidths = resolveStrokeSideWidths(node);
  const sides = resolveStrokeSides(node);
  const radii = cornerRadiiToCss(
    clampCornerRadii(getNodeCornerRadii(node), node.width, node.height),
  );
  return {
    position: "absolute",
    inset: 0,
    boxSizing: "border-box",
    borderRadius: radii,
    borderStyle: "solid",
    borderColor: strokeColor,
    borderTopWidth: sides.top ? sideWidths.top : 0,
    borderRightWidth: sides.right ? sideWidths.right : 0,
    borderBottomWidth: sides.bottom ? sideWidths.bottom : 0,
    borderLeftWidth: sides.left ? sideWidths.left : 0,
    background: "transparent",
    pointerEvents: "none",
  };
}

/** Axis-aligned fill rects for partial sides — only on sharp (non-rounded) rectangles. */
export function strokeUsesAxisAlignedRects(
  node: Pick<
    EditorNode,
    | "type"
    | "strokeSides"
    | "strokeSidesCustom"
    | "strokePosition"
    | "strokeStyle"
    | "cornerRadius"
    | "cornerRadii"
  >,
  width: number,
  height: number,
): boolean {
  if (strokeUsesCssIndividualBorders(node)) return false;
  if (effectiveStrokeType(node) === "gradient") return false;
  if (!usesPerEdgeStroke(node)) return false;
  const [tl, tr, br, bl] = clampCornerRadii(
    getNodeCornerRadii(node),
    width,
    height,
  );
  return tl === 0 && tr === 0 && br === 0 && bl === 0;
}

export function strokeEdgeRects(
  width: number,
  height: number,
  position: StrokePosition,
  sides: ResolvedStrokeSides,
  sideWidths: ResolvedStrokeSideWidths,
): StrokeEdgeRect[] {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const rects: StrokeEdgeRect[] = [];

  if (sides.top && sideWidths.top > 0) {
    const sw = sideWidths.top;
    if (position === "inside") rects.push({ x: 0, y: 0, width: w, height: sw });
    else if (position === "outside") rects.push({ x: 0, y: -sw, width: w, height: sw });
    else rects.push({ x: 0, y: -sw / 2, width: w, height: sw });
  }
  if (sides.bottom && sideWidths.bottom > 0) {
    const sw = sideWidths.bottom;
    if (position === "inside") rects.push({ x: 0, y: h - sw, width: w, height: sw });
    else if (position === "outside") rects.push({ x: 0, y: h, width: w, height: sw });
    else rects.push({ x: 0, y: h - sw / 2, width: w, height: sw });
  }
  if (sides.left && sideWidths.left > 0) {
    const sw = sideWidths.left;
    if (position === "inside") rects.push({ x: 0, y: 0, width: sw, height: h });
    else if (position === "outside") rects.push({ x: -sw, y: 0, width: sw, height: h });
    else rects.push({ x: -sw / 2, y: 0, width: sw, height: h });
  }
  if (sides.right && sideWidths.right > 0) {
    const sw = sideWidths.right;
    if (position === "inside") rects.push({ x: w - sw, y: 0, width: sw, height: h });
    else if (position === "outside") rects.push({ x: w, y: 0, width: sw, height: h });
    else rects.push({ x: w - sw / 2, y: 0, width: sw, height: h });
  }
  return rects;
}

/** Use clip/layer technique for inside/outside on closed paths (not per-edge rects). */
export function shouldUseAlignedPathStroke(
  node: Pick<EditorNode, "type" | "strokeSides" | "strokePosition">,
  closed: boolean,
): boolean {
  if (!closed) return false;
  if (usesPerEdgeStroke(node)) return false;
  return (node.strokePosition ?? "center") !== "center";
}

export function fullEllipsePathD(width: number, height: number): string {
  const rx = Math.max(0, width) / 2;
  const ry = Math.max(0, height) / 2;
  const cx = rx;
  const cy = ry;
  const h = Math.max(0, height);
  return `M ${cx} 0 A ${rx} ${ry} 0 1 1 ${cx} ${h} A ${rx} ${ry} 0 1 1 ${cx} 0 Z`;
}

/** CSS border sides for HTML/React export (rectangles / frames). */
export function strokeSidesToReactStyle(
  node: Pick<
    EditorNode,
    | "type"
    | "strokeWidth"
    | "strokeColor"
    | "strokeOpacity"
    | "strokeEnabled"
    | "strokePosition"
    | "strokeSides"
    | "strokeSidesCustom"
  >,
): Record<string, string> {
  const sw = node.strokeWidth ?? 0;
  if (sw <= 0 || node.strokeEnabled === false || !node.strokeColor) return {};
  if (!usesPerEdgeStroke(node)) {
    const pos = node.strokePosition ?? "center";
    if (pos === "center") {
      return { border: `${sw}px solid ${node.strokeColor}` };
    }
    return {};
  }
  const sides = resolveStrokeSides(node);
  const sideWidths = resolveStrokeSideWidths(node);
  const color = node.strokeColor;
  const style: Record<string, string> = { boxSizing: "border-box" };
  if (sides.top && sideWidths.top > 0) style.borderTop = `${sideWidths.top}px solid ${color}`;
  if (sides.right && sideWidths.right > 0) style.borderRight = `${sideWidths.right}px solid ${color}`;
  if (sides.bottom && sideWidths.bottom > 0) style.borderBottom = `${sideWidths.bottom}px solid ${color}`;
  if (sides.left && sideWidths.left > 0) style.borderLeft = `${sideWidths.left}px solid ${color}`;
  return style;
}

export function alignedPathStrokeWidth(
  position: StrokePosition,
  strokeWidth: number,
): number {
  const sw = Math.max(0, strokeWidth);
  const pos = position ?? "center";
  if (pos === "inside" || pos === "outside") return sw * 2;
  return sw;
}
