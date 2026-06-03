import type { EditorNode } from "@/stores/useEditorStore";
import { getNodeWorldMatrixFromChildOrder } from "@/lib/editorGraph";
import { applyMatrixToPoint, invertMatrix } from "@/lib/transformMath";
import type { StrokeEndpoint } from "@/lib/strokeEndpoints";
import {
  resolveStrokeEndPoint,
  resolveStrokeStartPoint,
  strokeEndpointUsesMarker,
} from "@/lib/strokeEndpoints";
import {
  distancePointToLineSegment,
  lineAngleDegrees,
  lineEndpointsFromNode,
  lineEndpointsWorld,
  lineHitToleranceWorld,
  lineLength,
  lineLocalRenderPoints,
  lineMidpoint,
  linePadding,
  linePatchFromEndpoints,
  lineRenderedWorldBounds,
  rotateLineEndpoints,
  type LineEndpoints,
} from "@/lib/shapes/lineGeometry";
import { RESIZE_MIN_DIMENSION } from "@/lib/resize";

export type ArrowHeadKind = "none" | "triangle" | "line" | "circle" | "diamond";

export const DEFAULT_ARROW_END: ArrowHeadKind = "triangle";
export const DEFAULT_ARROW_START: ArrowHeadKind = "none";
export const ARROW_WING_ANGLE = Math.PI / 7;

export type ArrowEndpoints = LineEndpoints;

export function isArrowNode(
  node: Pick<EditorNode, "type"> | null | undefined,
): node is EditorNode & { type: "arrow" } {
  return node?.type === "arrow";
}

export function isLinearNode(
  node: Pick<EditorNode, "type"> | null | undefined,
): boolean {
  return node?.type === "line" || node?.type === "arrow";
}

export function arrowHeadToStrokeEndpoint(kind: ArrowHeadKind): StrokeEndpoint {
  switch (kind) {
    case "triangle":
      return "triangle-arrow";
    case "line":
      return "line-arrow";
    case "circle":
      return "circle-arrow";
    case "diamond":
      return "diamond-arrow";
    default:
      return "none";
  }
}

export function strokeEndpointToArrowHead(ep: StrokeEndpoint): ArrowHeadKind {
  switch (ep) {
    case "triangle-arrow":
    case "reversed-triangle":
      return "triangle";
    case "line-arrow":
      return "line";
    case "circle-arrow":
      return "circle";
    case "diamond-arrow":
      return "diamond";
    default:
      return "none";
  }
}

export function resolveArrowStartKind(
  node: Pick<EditorNode, "type" | "startArrow" | "strokeStartPoint" | "arrowHead">,
): ArrowHeadKind {
  if (node.type === "arrow" && node.startArrow) return node.startArrow;
  return strokeEndpointToArrowHead(resolveStrokeStartPoint(node));
}

export function resolveArrowEndKind(
  node: Pick<EditorNode, "type" | "endArrow" | "strokeEndPoint" | "arrowHead">,
): ArrowHeadKind {
  if (node.type === "arrow" && node.endArrow) return node.endArrow;
  if (node.type === "arrow" && !node.endArrow) return DEFAULT_ARROW_END;
  return strokeEndpointToArrowHead(resolveStrokeEndPoint(node));
}

/** Persisted arrowhead fields + stroke endpoint markers kept in sync. */
export function arrowEndpointStylePatch(
  partial: Partial<{ startArrow: ArrowHeadKind; endArrow: ArrowHeadKind; arrowHeadSize: number }>,
): Pick<EditorNode, "startArrow" | "endArrow" | "strokeStartPoint" | "strokeEndPoint" | "arrowHeadSize"> {
  const patch: Pick<
    EditorNode,
    "startArrow" | "endArrow" | "strokeStartPoint" | "strokeEndPoint" | "arrowHeadSize" | "arrowHead"
  > = { ...partial, arrowHead: false };
  if (partial.startArrow != null) {
    patch.strokeStartPoint = arrowHeadToStrokeEndpoint(partial.startArrow);
  }
  if (partial.endArrow != null) {
    patch.strokeEndPoint = arrowHeadToStrokeEndpoint(partial.endArrow);
  }
  return patch;
}

export function getArrowAngle(ep: ArrowEndpoints): number {
  return Math.atan2(ep.y2 - ep.y1, ep.x2 - ep.x1);
}

export function getArrowLength(ep: ArrowEndpoints): number {
  return lineLength(ep);
}

export function getArrowAngleDegrees(ep: ArrowEndpoints): number {
  return lineAngleDegrees(ep);
}

export function arrowHeadSizeForNode(
  node: Pick<EditorNode, "arrowHeadSize" | "strokeWidth">,
): number {
  const sw = Math.max(1, node.strokeWidth ?? 2);
  const custom = node.arrowHeadSize;
  if (custom != null && Number.isFinite(custom) && custom > 0) return custom;
  return Math.max(10, sw * 3);
}

export function arrowHeadInset(kind: ArrowHeadKind, size: number): number {
  if (kind === "none") return 0;
  if (kind === "circle") return size * 0.5;
  if (kind === "line") return size * 0.15;
  return size * 0.85;
}

type Point2 = { x: number; y: number };

function wingPoints(
  tip: Point2,
  baseAngle: number,
  size: number,
): { left: Point2; right: Point2 } {
  return {
    left: {
      x: tip.x - Math.cos(baseAngle - ARROW_WING_ANGLE) * size,
      y: tip.y - Math.sin(baseAngle - ARROW_WING_ANGLE) * size,
    },
    right: {
      x: tip.x - Math.cos(baseAngle + ARROW_WING_ANGLE) * size,
      y: tip.y - Math.sin(baseAngle + ARROW_WING_ANGLE) * size,
    },
  };
}

/** Polygon vertices for filled/open arrowheads (local coords). */
export function getArrowHeadPolygon(
  tip: Point2,
  baseAngle: number,
  kind: ArrowHeadKind,
  size: number,
): Point2[] {
  const { left, right } = wingPoints(tip, baseAngle, size);
  switch (kind) {
    case "triangle":
      return [tip, left, right];
    case "diamond": {
      const back = {
        x: tip.x - Math.cos(baseAngle) * size,
        y: tip.y - Math.sin(baseAngle) * size,
      };
      return [tip, left, back, right];
    }
    default:
      return [];
  }
}

export function getArrowHeadPathD(
  tip: Point2,
  baseAngle: number,
  kind: ArrowHeadKind,
  size: number,
): string {
  const pts = getArrowHeadPolygon(tip, baseAngle, kind, size);
  if (pts.length < 3) return "";
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i]!.x} ${pts[i]!.y}`;
  }
  return `${d} Z`;
}

function pointInTriangle(px: number, py: number, a: Point2, b: Point2, c: Point2): boolean {
  const sign = (p1: Point2, p2: Point2, p3: Point2) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = sign({ x: px, y: py }, a, b);
  const d2 = sign({ x: px, y: py }, b, c);
  const d3 = sign({ x: px, y: py }, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function hitTestArrowHeadLocal(
  localX: number,
  localY: number,
  tip: Point2,
  baseAngle: number,
  kind: ArrowHeadKind,
  size: number,
  strokeWidth: number,
): boolean {
  if (kind === "none") return false;
  const tol = Math.max(strokeWidth / 2, 4);

  if (kind === "circle") {
    const center = {
      x: tip.x - Math.cos(baseAngle) * size * 0.5,
      y: tip.y - Math.sin(baseAngle) * size * 0.5,
    };
    const r = size * 0.35;
    return Math.hypot(localX - center.x, localY - center.y) <= r + tol;
  }

  if (kind === "line") {
    const { left, right } = wingPoints(tip, baseAngle, size);
    return (
      distancePointToLineSegment({ x: localX, y: localY }, tip, left) <= tol ||
      distancePointToLineSegment({ x: localX, y: localY }, tip, right) <= tol
    );
  }

  const poly = getArrowHeadPolygon(tip, baseAngle, kind, size);
  if (poly.length >= 3) {
    if (typeof Path2D !== "undefined") {
      try {
        const d = getArrowHeadPathD(tip, baseAngle, kind, size);
        const path = new Path2D(d);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx?.isPointInPath(path, localX, localY)) return true;
      } catch {
        /* fallback */
      }
    }
    return pointInTriangle(localX, localY, poly[0]!, poly[1]!, poly[2]!);
  }
  return false;
}

export function arrowEndpointsFromNode(
  node: Pick<
    EditorNode,
    "type" | "lineX1" | "lineY1" | "lineX2" | "lineY2" | "x" | "y" | "width" | "height" | "rotation"
  >,
): ArrowEndpoints {
  return lineEndpointsFromNode(node);
}

export function arrowPatchFromEndpoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  node: Pick<EditorNode, "strokeWidth">,
) {
  return linePatchFromEndpoints(x1, y1, x2, y2, node);
}

export function arrowRenderedWorldBounds(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number; width: number; height: number } {
  const base = lineRenderedWorldBounds(nodeId, nodes, childOrder);
  const n = nodes[nodeId];
  if (!n || n.type !== "arrow") return base;
  const size = arrowHeadSizeForNode(n);
  const extra = Math.max(size, linePadding(n.strokeWidth ?? 2));
  return {
    x: base.x - extra,
    y: base.y - extra,
    width: Math.max(RESIZE_MIN_DIMENSION, base.width + extra * 2),
    height: Math.max(1, base.height + extra * 2),
  };
}

export function hitTestArrowWorld(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  zoom: number,
): boolean {
  const n = nodes[nodeId];
  if (!n || n.type !== "arrow" || !n.visible) return false;

  const ep = lineEndpointsWorld(nodeId, nodes, childOrder);
  const tol = lineHitToleranceWorld(n, zoom);
  if (
    distancePointToLineSegment(
      { x: worldX, y: worldY },
      { x: ep.x1, y: ep.y1 },
      { x: ep.x2, y: ep.y2 },
    ) <= tol
  ) {
    return true;
  }

  const localEp = lineLocalRenderPoints(n);
  const angle = getArrowAngle(localEp);
  const size = arrowHeadSizeForNode(n);
  const sw = n.strokeWidth ?? 2;
  const startKind = resolveArrowStartKind(n);
  const endKind = resolveArrowEndKind(n);

  const wm = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  let localX = worldX;
  let localY = worldY;
  if (wm) {
    const inv = invertMatrix(wm);
    if (inv) {
      const p = applyMatrixToPoint(inv, { x: worldX, y: worldY });
      localX = p.x;
      localY = p.y;
    }
  } else {
    localX = worldX - n.x;
    localY = worldY - n.y;
  }

  const endTip = { x: localEp.x2, y: localEp.y2 };
  const startTip = { x: localEp.x1, y: localEp.y1 };

  if (hitTestArrowHeadLocal(localX, localY, endTip, angle, endKind, size, sw)) return true;
  if (hitTestArrowHeadLocal(localX, localY, startTip, angle + Math.PI, startKind, size, sw)) {
    return true;
  }
  return false;
}

export function moveArrowEndpoints(ep: ArrowEndpoints, dx: number, dy: number): ArrowEndpoints {
  return {
    x1: ep.x1 + dx,
    y1: ep.y1 + dy,
    x2: ep.x2 + dx,
    y2: ep.y2 + dy,
  };
}

export { lineMidpoint as arrowMidpoint, rotateLineEndpoints as rotateArrowEndpoints };

/** Marker scale for SVG defs (Figma-style head size). */
export function arrowMarkerScale(
  node: Pick<EditorNode, "arrowHeadSize" | "strokeWidth">,
): number {
  const sw = Math.max(1, node.strokeWidth ?? 2);
  const base = sw * 1.8;
  return arrowHeadSizeForNode(node) / base;
}

export function arrowUsesMarker(node: Pick<EditorNode, "type" | "startArrow" | "endArrow" | "strokeStartPoint" | "strokeEndPoint">): boolean {
  const start = resolveArrowStartKind(node);
  const end = resolveArrowEndKind(node);
  return (
    strokeEndpointUsesMarker(arrowHeadToStrokeEndpoint(start)) ||
    strokeEndpointUsesMarker(arrowHeadToStrokeEndpoint(end))
  );
}
