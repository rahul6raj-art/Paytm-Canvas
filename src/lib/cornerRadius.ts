import { isCanvasBgCreationTool } from "@/lib/canvasInteractionGuards";
import { isPolygonNode } from "@/lib/shapes/polygonGeometry";
import { isStarNode } from "@/lib/shapes/starGeometry";
import type { EditorMode, EditorNode, Tool } from "@/stores/useEditorStore";

/** Top-left, top-right, bottom-right, bottom-left (Figma / CSS 4-value order). */
export type CornerRadii = [number, number, number, number];

export function getNodeCornerRadii(
  node: Pick<EditorNode, "cornerRadius" | "cornerRadii">,
): CornerRadii {
  if (node.cornerRadii?.length === 4) {
    return [
      Math.max(0, node.cornerRadii[0] ?? 0),
      Math.max(0, node.cornerRadii[1] ?? 0),
      Math.max(0, node.cornerRadii[2] ?? 0),
      Math.max(0, node.cornerRadii[3] ?? 0),
    ];
  }
  const r = Math.max(0, node.cornerRadius ?? 0);
  return [r, r, r, r];
}

export function resizeCornerRadiiForCount(
  radii: readonly number[] | undefined,
  vertexCount: number,
  fallback: number,
): number[] {
  const uniform = Math.max(0, fallback);
  const out = Array.from({ length: vertexCount }, () => uniform);
  if (!radii?.length) return out;
  for (let i = 0; i < vertexCount; i++) {
    out[i] = Math.max(0, radii[i] ?? radii[i % radii.length] ?? uniform);
  }
  return out;
}

export function hasIndependentVertexCornerRadii(
  radii: readonly number[],
): boolean {
  if (radii.length <= 1) return false;
  const first = radii[0] ?? 0;
  return !radii.every((r) => r === first);
}

export function hasIndependentCornerRadii(
  node: Pick<EditorNode, "cornerRadius" | "cornerRadii">,
): boolean {
  if (!node.cornerRadii?.length) return false;
  return hasIndependentVertexCornerRadii(node.cornerRadii);
}

/** True when the node stores an explicit per-corner radius array (unlinked mode). */
export function isPerCornerRadiusMode(
  node: Pick<EditorNode, "cornerRadii">,
): boolean {
  return (node.cornerRadii?.length ?? 0) > 0;
}

export function isUniformCornerRadii(radii: CornerRadii): boolean {
  const [tl, tr, br, bl] = radii;
  return tl === tr && tr === br && br === bl;
}

export function cornerRadiiMax(radii: CornerRadii): number {
  return Math.max(...radii);
}

/** Rectangle / frame layers that show on-canvas corner radius handles. */
export function supportsCornerRadiusHandles(
  node: Pick<EditorNode, "type" | "visible" | "locked">,
): boolean {
  if (!node.visible || node.locked) return false;
  return node.type === "rectangle" || node.type === "frame";
}

/** Polygon / star layers with draggable corner-radius handles on canvas selection. */
export function supportsParametricShapeCornerRadiusHandles(
  node: Pick<EditorNode, "type" | "visible" | "locked" | "polygonSides" | "starPoints">,
): boolean {
  if (!node.visible || node.locked) return false;
  return isPolygonNode(node) || isStarNode(node);
}

export type CornerRadiusCanvasGateState = {
  editorMode: EditorMode;
  tool: Tool;
  penDrawingNodeId: string | null;
  pencilDrawingNodeId: string | null;
  isPlacingComment: boolean;
  selectedIds: readonly string[];
  transformInteractionMode: "none" | "resize" | "rotate";
  /** True while selected layer(s) are being moved on canvas. */
  dragActive: boolean;
  /** When set, parametric edit handles replace selection corner handles. */
  shapeEditModeNodeId?: string | null;
};

function passesCornerRadiusCanvasGate(
  state: CornerRadiusCanvasGateState,
): boolean {
  if (state.editorMode !== "design" || state.tool !== "move") return false;
  if (state.penDrawingNodeId || state.pencilDrawingNodeId || state.isPlacingComment) {
    return false;
  }
  if (isCanvasBgCreationTool(state.tool, state.editorMode, { isPlacingComment: state.isPlacingComment })) {
    return false;
  }
  if (state.selectedIds.length !== 1) return false;
  if (state.transformInteractionMode === "resize" || state.transformInteractionMode === "rotate") {
    return false;
  }
  if (state.dragActive) return false;
  return true;
}

/** Figma-style corner radius dots on single-selected rectangle / frame (no edit mode required). */
export function shouldShowCornerRadiusHandlesOnCanvas(
  state: CornerRadiusCanvasGateState,
  node: Pick<EditorNode, "type" | "visible" | "locked"> | null | undefined,
): boolean {
  if (!node || !supportsCornerRadiusHandles(node)) return false;
  return passesCornerRadiusCanvasGate(state);
}

/** Corner radius dots on polygon / star during normal selection (not parametric edit mode). */
export function shouldShowParametricShapeCornerRadiusHandlesOnCanvas(
  state: CornerRadiusCanvasGateState,
  node: Pick<EditorNode, "type" | "visible" | "locked" | "polygonSides" | "starPoints"> | null | undefined,
): boolean {
  if (!node || !supportsParametricShapeCornerRadiusHandles(node)) return false;
  if (!passesCornerRadiusCanvasGate(state)) return false;
  const id = state.selectedIds[0];
  if (id && state.shapeEditModeNodeId === id) return false;
  return true;
}

/** CSS `border-radius` for canvas / export. */
export function cornerRadiiToCss(radii: CornerRadii): string | number {
  if (isUniformCornerRadii(radii)) return radii[0];
  const [tl, tr, br, bl] = radii;
  return `${tl}px ${tr}px ${br}px ${bl}px`;
}

/** Max radius for one corner while other corners stay fixed. */
export function maxCornerRadiusForIndex(
  cornerIndex: 0 | 1 | 2 | 3,
  radii: CornerRadii,
  w: number,
  h: number,
): number {
  const width = Math.max(0, w);
  const height = Math.max(0, h);
  const [tl, tr, br, bl] = radii;
  switch (cornerIndex) {
    case 0:
      return Math.max(0, Math.min(width - tr, height - bl));
    case 1:
      return Math.max(0, Math.min(width - tl, height - br));
    case 2:
      return Math.max(0, Math.min(width - bl, height - tr));
    case 3:
      return Math.max(0, Math.min(width - br, height - tl));
    default:
      return 0;
  }
}

/** Upper bound while dragging one corner (linked or independent). */
export function resolveCornerRadiusDragMax(
  cornerIndex: 0 | 1 | 2 | 3,
  startRadii: CornerRadii,
  linkCorners: boolean,
  w: number,
  h: number,
): number {
  if (linkCorners) return Math.min(Math.max(0, w), Math.max(0, h)) / 2;
  return maxCornerRadiusForIndex(cornerIndex, startRadii, w, h);
}

/** Scale radii so adjacent corners do not overlap (CSS corner overlap). */
export function clampCornerRadii(radii: CornerRadii, w: number, h: number): CornerRadii {
  const width = Math.max(0, w);
  const height = Math.max(0, h);
  if (width <= 0 || height <= 0) return [0, 0, 0, 0];

  let [tl, tr, br, bl] = radii.map((r) => Math.max(0, r)) as CornerRadii;
  const top = tl + tr;
  const bottom = bl + br;
  const left = tl + bl;
  const right = tr + br;
  let f = 1;
  if (top > width) f = Math.min(f, width / top);
  if (bottom > width) f = Math.min(f, width / bottom);
  if (left > height) f = Math.min(f, height / left);
  if (right > height) f = Math.min(f, height / right);
  if (f < 1) {
    tl *= f;
    tr *= f;
    br *= f;
    bl *= f;
  }
  return [tl, tr, br, bl];
}

/** Adaptive quarter-arc segment count (~0.75px chord error on canvas). */
export function segmentsForCornerArc(radius: number): number {
  const r = Math.max(0, radius);
  if (r <= 0) return 4;
  const quarterArc = (r * Math.PI) / 2;
  return Math.max(16, Math.ceil(quarterArc / 0.75));
}

/** SVG path for a rounded rectangle with per-corner radii (local ox,oy–ox+w,oy+h). */
export function roundedRectPathD(
  w: number,
  h: number,
  radii: CornerRadii,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): string {
  const width = Math.max(0, w);
  const height = Math.max(0, h);
  const ox = origin.x;
  const oy = origin.y;
  if (width <= 0 || height <= 0) return "";
  const [tl, tr, br, bl] = clampCornerRadii(radii, width, height);
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    return `M ${ox} ${oy} H ${ox + width} V ${oy + height} H ${ox} Z`;
  }

  const edgeEps = 0.001;
  const parts: string[] = [`M ${ox + tl} ${oy}`];
  if (width - tl - tr > edgeEps) parts.push(`H ${ox + width - tr}`);

  if (tr > 0) parts.push(`A ${tr} ${tr} 0 0 1 ${ox + width} ${oy + tr}`);
  if (height - tr - br > edgeEps) parts.push(`V ${oy + height - br}`);

  if (br > 0) parts.push(`A ${br} ${br} 0 0 1 ${ox + width - br} ${oy + height}`);
  if (width - br - bl > edgeEps) parts.push(`H ${ox + bl}`);

  if (bl > 0) parts.push(`A ${bl} ${bl} 0 0 1 ${ox} ${oy + height - bl}`);
  if (height - bl - tl > edgeEps) parts.push(`V ${oy + tl}`);

  if (tl > 0) parts.push(`A ${tl} ${tl} 0 0 1 ${ox + tl} ${oy}`);
  parts.push("Z");
  return parts.join(" ");
}

/**
 * Offset a rounded-rect contour uniformly (positive delta = outward in SVG y-down space).
 * Uses true arc geometry instead of polygon approximation.
 */
export function offsetRoundedRectPathD(
  width: number,
  height: number,
  radii: CornerRadii,
  delta: number,
): string {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  if (w <= 0 || h <= 0) return "";
  const clamped = clampCornerRadii(radii, w, h);
  if (Math.abs(delta) < 1e-9) {
    return roundedRectPathD(w, h, clamped);
  }

  const d = -delta;
  const ow = w - 2 * d;
  const oh = h - 2 * d;
  if (ow < 1e-6 || oh < 1e-6) return "";

  const shifted: CornerRadii = [
    Math.max(0, clamped[0] - d),
    Math.max(0, clamped[1] - d),
    Math.max(0, clamped[2] - d),
    Math.max(0, clamped[3] - d),
  ];
  const outRadii = clampCornerRadii(shifted, ow, oh);
  return roundedRectPathD(ow, oh, outRadii, { x: d, y: d });
}

export type StrokeBandAlign = "center" | "inside" | "outside";

/** Smooth evenodd stroke ring for a rounded rectangle (outline / aligned stroke). */
export function outlineRoundedRectRingPathD(
  width: number,
  height: number,
  radii: CornerRadii,
  strokeWidth: number,
  align: StrokeBandAlign,
): { pathD: string; fillRule: "evenodd" | "nonzero" } | null {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  if (w <= 0 || h <= 0 || strokeWidth < 1e-9) return null;
  const clamped = clampCornerRadii(radii, w, h);
  if (clamped.every((r) => r <= 0)) return null;

  const half = strokeWidth / 2;
  let outerD: string;
  let innerD: string | null = null;

  if (align === "center") {
    outerD = offsetRoundedRectPathD(w, h, clamped, half);
    innerD = offsetRoundedRectPathD(w, h, clamped, -half);
  } else if (align === "inside") {
    outerD = roundedRectPathD(w, h, clamped);
    innerD = offsetRoundedRectPathD(w, h, clamped, -strokeWidth);
  } else {
    outerD = offsetRoundedRectPathD(w, h, clamped, strokeWidth);
    innerD = roundedRectPathD(w, h, clamped);
  }

  if (!outerD) return null;
  if (!innerD) return { pathD: outerD, fillRule: "nonzero" };
  return { pathD: `${outerD} ${innerD}`, fillRule: "evenodd" };
}

function arcPoints(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  segments: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + (endAngle - startAngle) * t;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

/** Polygon approximation of a variable rounded rect (for boolean / hit tests). */
export function roundedRectPolygonPoints(
  w: number,
  h: number,
  radii: CornerRadii,
  segmentsPerCorner?: number,
): { x: number; y: number }[] {
  const width = Math.max(0, w);
  const height = Math.max(0, h);
  const [tl, tr, br, bl] = clampCornerRadii(radii, width, height);
  const segTl = segmentsPerCorner ?? segmentsForCornerArc(tl);
  const segTr = segmentsPerCorner ?? segmentsForCornerArc(tr);
  const segBr = segmentsPerCorner ?? segmentsForCornerArc(br);
  const segBl = segmentsPerCorner ?? segmentsForCornerArc(bl);
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
  }

  const pts: { x: number; y: number }[] = [{ x: tl, y: 0 }];
  if (tr > 0) {
    pts.push(...arcPoints(width - tr, tr, tr, -Math.PI / 2, 0, segTr).slice(1));
  } else {
    pts.push({ x: width, y: 0 });
  }
  if (br > 0) {
    pts.push(...arcPoints(width - br, height - br, br, 0, Math.PI / 2, segBr).slice(1));
  } else {
    pts.push({ x: width, y: height });
  }
  if (bl > 0) {
    pts.push(...arcPoints(bl, height - bl, bl, Math.PI / 2, Math.PI, segBl).slice(1));
  } else {
    pts.push({ x: 0, y: height });
  }
  if (tl > 0) {
    pts.push(...arcPoints(tl, tl, tl, Math.PI, (3 * Math.PI) / 2, segTl).slice(1));
  }
  return pts;
}

/** Uniform corner value for legacy `rx` on SVG `<rect>`. */
export function uniformCornerRadiusForRect(
  node: Pick<EditorNode, "cornerRadius" | "cornerRadii">,
  w: number,
  h: number,
): number {
  const radii = clampCornerRadii(getNodeCornerRadii(node), w, h);
  if (isUniformCornerRadii(radii)) return radii[0];
  return 0;
}
