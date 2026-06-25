import { clampCornerRadii, cornerRadiiToCss, getNodeCornerRadii } from "@/lib/cornerRadius";
import { effectiveStrokeType } from "@/lib/fillGradient";
import { effectColorToRgba } from "@/lib/nodeEffects";
import { resolveStrokeStyle } from "@/lib/stroke";
import { pathHasCurveHandles } from "@/lib/shapes/shapeToPath";
import { resolveStrokeEndPoint, resolveStrokeStartPoint } from "@/lib/strokeEndpoints";
import { resolveStrokeTaperActive } from "@/lib/taperedStrokePath";
import type { StrokePosition, EditorNode } from "@/stores/useEditorStore";

export type StrokeSidesMode = "all" | "top" | "bottom" | "left" | "right" | "custom";

/** Per-side on/off (boolean) or explicit stroke width in px (number). `true` = use layer strokeWidth. */
export type StrokeSidesCustom = {
  top?: boolean | number;
  right?: boolean | number;
  bottom?: boolean | number;
  left?: boolean | number;
};

/** Per-side stroke color overrides (custom mode). Falls back to `strokeColor`. */
export type StrokeSidesCustomColors = {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
};

export type StrokeSideKey = keyof StrokeSidesCustom;

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

/** True when active sides (width > 0) have different stroke weights. */
export function strokeSideWeightsAreMixed(
  node: Pick<EditorNode, "strokeWidth" | "strokeSides" | "strokeSidesCustom">,
): boolean {
  const sides = resolveStrokeSides(node);
  const widths = resolveStrokeSideWidths(node);
  const active: number[] = [];
  if (sides.top && widths.top > 0) active.push(widths.top);
  if (sides.right && widths.right > 0) active.push(widths.right);
  if (sides.bottom && widths.bottom > 0) active.push(widths.bottom);
  if (sides.left && widths.left > 0) active.push(widths.left);
  if (active.length < 2) return false;
  const first = active[0]!;
  return !active.every((w) => w === first);
}

export function resolveStrokeSideColor(
  node: Pick<EditorNode, "strokeColor" | "strokeSidesCustomColors">,
  side: StrokeSideKey,
): string {
  const override = node.strokeSidesCustomColors?.[side];
  if (override) return override;
  return node.strokeColor ?? "#000000";
}

export function resolveStrokeSidePaint(
  node: Pick<EditorNode, "strokeColor" | "strokeOpacity" | "strokeSidesCustomColors">,
  side: StrokeSideKey,
): string {
  return effectColorToRgba(resolveStrokeSideColor(node, side), node.strokeOpacity ?? 1);
}

/** True when active sides (width > 0) have different stroke colors. */
export function strokeSideColorsAreMixed(
  node: Pick<
    EditorNode,
    "strokeWidth" | "strokeSides" | "strokeSidesCustom" | "strokeColor" | "strokeSidesCustomColors"
  >,
): boolean {
  const sides = resolveStrokeSides(node);
  const widths = resolveStrokeSideWidths(node);
  const colors: string[] = [];
  if (sides.top && widths.top > 0) colors.push(resolveStrokeSideColor(node, "top"));
  if (sides.right && widths.right > 0) colors.push(resolveStrokeSideColor(node, "right"));
  if (sides.bottom && widths.bottom > 0) colors.push(resolveStrokeSideColor(node, "bottom"));
  if (sides.left && widths.left > 0) colors.push(resolveStrokeSideColor(node, "left"));
  if (colors.length < 2) return false;
  const first = colors[0]!;
  return !colors.every((c) => c === first);
}

export type StrokeEdgeRect = {
  side: StrokeSideKey;
  x: number;
  y: number;
  width: number;
  height: number;
};

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
  node: Pick<
    EditorNode,
    | "type"
    | "strokeWidth"
    | "strokeSides"
    | "strokeSidesCustom"
    | "strokeColor"
    | "strokeSidesCustomColors"
  >,
): boolean {
  if (!supportsStrokeSides(node)) return false;
  const sides = resolveStrokeSides(node);
  const allOn = sides.top && sides.right && sides.bottom && sides.left;
  if (!allOn) return true;
  if ((node.strokeSides ?? "all") === "custom") {
    if (!strokeSideWidthsAreUniform(resolveStrokeSideWidths(node))) return true;
    if (strokeSideColorsAreMixed(node)) return true;
  }
  return false;
}

/**
 * Figma individual strokes on sharp rectangles/frames use the CSS border model
 * (per-side widths). Rounded shapes use geometry-based side stroke paths.
 */
export function strokeUsesCssIndividualBorders(
  node: Pick<
    EditorNode,
    | "type"
    | "width"
    | "height"
    | "strokeWidth"
    | "strokeSides"
    | "strokeSidesCustom"
    | "strokeColor"
    | "strokeSidesCustomColors"
    | "strokePosition"
    | "strokeStyle"
    | "strokeType"
    | "strokeGradient"
    | "cornerRadius"
    | "cornerRadii"
  >,
): boolean {
  if (!supportsStrokeSides(node) || !usesPerEdgeStroke(node)) return false;
  if (strokeSideColorsAreMixed(node)) return false;
  if (effectiveStrokeType(node) === "gradient") return false;
  if (resolveStrokeStyle(node) !== "solid") return false;
  const [tl, tr, br, bl] = clampCornerRadii(
    getNodeCornerRadii(node),
    node.width,
    node.height,
  );
  if (tl > 0 || tr > 0 || br > 0 || bl > 0) return false;
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
  borderTopColor: string;
  borderRightColor: string;
  borderBottomColor: string;
  borderLeftColor: string;
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
    | "strokeSidesCustomColors"
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
  const topColor = resolveStrokeSidePaint(node, "top");
  const rightColor = resolveStrokeSidePaint(node, "right");
  const bottomColor = resolveStrokeSidePaint(node, "bottom");
  const leftColor = resolveStrokeSidePaint(node, "left");
  return {
    position: "absolute",
    inset: 0,
    boxSizing: "border-box",
    borderRadius: radii,
    borderStyle: "solid",
    borderColor: strokeColor,
    borderTopColor: topColor,
    borderRightColor: rightColor,
    borderBottomColor: bottomColor,
    borderLeftColor: leftColor,
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
    | "strokeType"
    | "strokeGradient"
    | "strokeColor"
    | "strokeOpacity"
    | "strokeEnabled"
    | "strokeWidth"
    | "cornerRadius"
    | "cornerRadii"
  >,
  width: number,
  height: number,
): boolean {
  if (strokeUsesCssIndividualBorders({ ...node, width, height, strokeWidth: node.strokeWidth ?? 0 })) return false;
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
    if (position === "inside") rects.push({ side: "top", x: 0, y: 0, width: w, height: sw });
    else if (position === "outside") rects.push({ side: "top", x: 0, y: -sw, width: w, height: sw });
    else rects.push({ side: "top", x: 0, y: -sw / 2, width: w, height: sw });
  }
  if (sides.bottom && sideWidths.bottom > 0) {
    const sw = sideWidths.bottom;
    if (position === "inside") rects.push({ side: "bottom", x: 0, y: h - sw, width: w, height: sw });
    else if (position === "outside") rects.push({ side: "bottom", x: 0, y: h, width: w, height: sw });
    else rects.push({ side: "bottom", x: 0, y: h - sw / 2, width: w, height: sw });
  }
  if (sides.left && sideWidths.left > 0) {
    const sw = sideWidths.left;
    if (position === "inside") rects.push({ side: "left", x: 0, y: 0, width: sw, height: h });
    else if (position === "outside") rects.push({ side: "left", x: -sw, y: 0, width: sw, height: h });
    else rects.push({ side: "left", x: -sw / 2, y: 0, width: sw, height: h });
  }
  if (sides.right && sideWidths.right > 0) {
    const sw = sideWidths.right;
    if (position === "inside") rects.push({ side: "right", x: w - sw, y: 0, width: sw, height: h });
    else if (position === "outside") rects.push({ side: "right", x: w, y: 0, width: sw, height: h });
    else rects.push({ side: "right", x: w - sw / 2, y: 0, width: sw, height: h });
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

/**
 * Closed shapes that need a filled even-odd stroke ring instead of native SVG stroke.
 * Center-aligned strokes on every closed shape (solid, gradient, image, video) use native
 * SVG stroke on the fill path. Filled rings are reserved for inside/outside alignment.
 */
export function shouldUseFilledStrokeRingForNode(
  node: Pick<
    EditorNode,
    | "type"
    | "strokePosition"
    | "strokeSides"
    | "strokeType"
    | "width"
    | "height"
    | "cornerRadius"
    | "cornerRadii"
    | "cornerSmoothing"
    | "pathPoints"
    | "pathClosed"
    | "polygonSides"
    | "starPoints"
    | "starInnerRadius"
    | "starOuterCornerRadius"
    | "starInnerCornerRadius"
  >,
  opts: { closed: boolean; showStroke?: boolean },
): boolean {
  if (opts.showStroke === false || !opts.closed) return false;
  if (usesPerEdgeStroke(node)) return false;
  if (shouldUseAlignedPathStroke(node, opts.closed)) return true;
  if ((node.strokePosition ?? "center") === "center") return false;
  if (effectiveStrokeType(node) !== "solid") return true;
  return false;
}

/**
 * Filled stroke-ring layer order (even-odd outline geometry).
 * Outside: ring below fill so fill covers the inner edge of the band.
 * Center/inside: ring above fill so the stroke stays visible on the shape edge.
 */
export function strokeRingLayersBeforeFill(
  position: EditorNode["strokePosition"] | undefined,
): boolean {
  return (position ?? "center") === "outside";
}

/** True when the fill path should paint below the stroke layer. */
export function strokeFillLayerBeforeStrokeLayer(
  position: EditorNode["strokePosition"] | undefined,
  usesFilledRing: boolean,
): boolean {
  if (usesFilledRing) return !strokeRingLayersBeforeFill(position);
  return (position ?? "center") !== "outside";
}

/** Expand SVG viewport so center/outside stroke bands are not clipped at node bounds. */
export function closedShapeStrokeViewport(
  width: number,
  height: number,
  strokeWidth: number,
  position: EditorNode["strokePosition"] | undefined,
): {
  viewBox: string;
  svgWidth: number;
  svgHeight: number;
  offsetLeft: number;
  offsetTop: number;
} | null {
  const sw = Math.max(0, strokeWidth);
  if (sw <= 1e-9) return null;
  const pos = position ?? "center";
  const pad = pos === "outside" ? sw : pos === "center" ? sw / 2 : 0;
  if (pad <= 1e-9) return null;
  const w = width + pad * 2;
  const h = height + pad * 2;
  return {
    viewBox: `${-pad} ${-pad} ${w} ${h}`,
    svgWidth: w,
    svgHeight: h,
    offsetLeft: -pad,
    offsetTop: -pad,
  };
}

/** Open vector paths with taper use filled outline geometry instead of native SVG stroke. */
export function shouldUseTaperedOpenPathStroke(
  node: Pick<
    EditorNode,
    | "type"
    | "strokeSides"
    | "strokeLinecap"
    | "strokeTaperStart"
    | "strokeTaperEnd"
    | "strokeWidthProfile"
    | "strokeStyle"
    | "strokeDashLength"
    | "strokeDashGap"
    | "strokeStartPoint"
    | "strokeEndPoint"
    | "arrowHead"
  >,
  closed: boolean,
): boolean {
  if (closed || node.type !== "path") return false;
  if (!resolveStrokeTaperActive(node)) return false;
  if (usesPerEdgeStroke(node)) return false;
  const style = node.strokeStyle ?? "solid";
  if (style !== "solid") return false;
  const start = resolveStrokeStartPoint(node);
  const end = resolveStrokeEndPoint(node);
  if (start !== "none" || end !== "none") return false;
  return true;
}

/** Open vector paths with inside/outside stroke use filled outline bands. */
export function shouldUseOutlinedOpenPathStroke(
  node: Pick<
    EditorNode,
    | "type"
    | "strokeSides"
    | "pathPoints"
    | "strokePosition"
    | "strokeStartPoint"
    | "strokeEndPoint"
    | "arrowHead"
  >,
  closed: boolean,
): boolean {
  if (closed || node.type !== "path") return false;
  if (usesPerEdgeStroke(node)) return false;
  // Pen paths with Bézier handles use native SVG stroke so curves match edit outline.
  if (pathHasCurveHandles(node.pathPoints)) return false;
  // SVG markers (arrow caps) require a centerline stroke, not a filled outline band.
  const start = resolveStrokeStartPoint(node);
  const end = resolveStrokeEndPoint(node);
  if (start !== "none" || end !== "none") return false;
  // Center strokes (default pen/line): native SVG for uniform width and round caps.
  if ((node.strokePosition ?? "center") === "center") return false;
  return true;
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
    | "strokeSidesCustomColors"
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
  const style: Record<string, string> = { boxSizing: "border-box" };
  if (sides.top && sideWidths.top > 0) {
    style.borderTop = `${sideWidths.top}px solid ${resolveStrokeSideColor(node, "top")}`;
  }
  if (sides.right && sideWidths.right > 0) {
    style.borderRight = `${sideWidths.right}px solid ${resolveStrokeSideColor(node, "right")}`;
  }
  if (sides.bottom && sideWidths.bottom > 0) {
    style.borderBottom = `${sideWidths.bottom}px solid ${resolveStrokeSideColor(node, "bottom")}`;
  }
  if (sides.left && sideWidths.left > 0) {
    style.borderLeft = `${sideWidths.left}px solid ${resolveStrokeSideColor(node, "left")}`;
  }
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
