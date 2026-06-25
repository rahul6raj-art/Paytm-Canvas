import type { EditorNode } from "@/stores/useEditorStore";
import {
  buildParentMapFromChildOrder,
  getNodeWorldMatrixFromChildOrder,
} from "@/lib/editorGraph";
import { applyMatrixToPoint, getNodeLocalMatrix, invertMatrix } from "@/lib/transformMath";
import { RESIZE_MIN_DIMENSION } from "@/lib/resize";
import { screenPxToWorld } from "@/lib/canvasVisual";
import { constrainLineEndpointTo45Degrees } from "./shapeCreation";

export type LineEndpoints = { x1: number; y1: number; x2: number; y2: number };

export const LINE_HIT_SCREEN_PX = 8;
export const LINE_BOX_PADDING_PX = 8;

const MIN_LEN = RESIZE_MIN_DIMENSION;

/** Distance from point P to segment AB. */
export function distancePointToLineSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-12) return Math.hypot(apx, apy);
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const qx = a.x + abx * t;
  const qy = a.y + aby * t;
  return Math.hypot(p.x - qx, p.y - qy);
}

export function lineLength(ep: LineEndpoints): number {
  return Math.hypot(ep.x2 - ep.x1, ep.y2 - ep.y1);
}

/** Angle in degrees (0° = east, clockwise), normalized 0–360. */
export function lineAngleDegrees(ep: LineEndpoints): number {
  const deg = (Math.atan2(ep.y2 - ep.y1, ep.x2 - ep.x1) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function lineMidpoint(ep: LineEndpoints): { x: number; y: number } {
  return { x: (ep.x1 + ep.x2) / 2, y: (ep.y1 + ep.y2) / 2 };
}

/** Map local geometry point to the node's parent coordinate space. */
export function nodeLocalToParent(
  node: Pick<EditorNode, "x" | "y" | "width" | "height" | "rotation" | "flipHorizontal" | "flipVertical">,
  local: { x: number; y: number },
): { x: number; y: number } {
  return applyMatrixToPoint(getNodeLocalMatrix(node as EditorNode), local);
}

/** Endpoints in parent-local absolute coordinates (Figma-style x1,y1,x2,y2). */
export function lineEndpointsFromLayout(
  node: Pick<EditorNode, "x" | "y" | "width" | "height" | "rotation" | "flipHorizontal" | "flipVertical">,
): LineEndpoints {
  const h = Math.max(0, node.height);
  const w = Math.max(1, node.width);
  const midY = h / 2;
  const a = nodeLocalToParent(node, { x: 0, y: midY });
  const b = nodeLocalToParent(node, { x: w, y: midY });
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

export function lineEndpointsFromNode(
  node: Pick<
    EditorNode,
    "lineX1" | "lineY1" | "lineX2" | "lineY2" | "x" | "y" | "width" | "height" | "rotation"
  >,
): LineEndpoints {
  if (
    node.lineX1 != null &&
    node.lineY1 != null &&
    node.lineX2 != null &&
    node.lineY2 != null
  ) {
    return { x1: node.lineX1, y1: node.lineY1, x2: node.lineX2, y2: node.lineY2 };
  }
  return lineEndpointsFromLayout(node);
}

export function linePadding(strokeWidth = 2): number {
  return Math.max(LINE_BOX_PADDING_PX, strokeWidth + 4);
}

/** Box + rotation from parent-local endpoints (start-anchored, Figma-style). */
export function layoutFromLineEndpoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth = 2,
  minLength = MIN_LEN,
): Pick<EditorNode, "x" | "y" | "width" | "height" | "rotation" | "lineX1" | "lineY1" | "lineX2" | "lineY2"> {
  const h = 0;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(minLength, Math.hypot(dx, dy));
  const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  return {
    lineX1: x1,
    lineY1: y1,
    lineX2: x2,
    lineY2: y2,
    x: x1,
    y: y1,
    width: length,
    height: h,
    rotation,
  };
}

/** Merge endpoint + layout fields after editing endpoints. */
export function linePatchFromEndpoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  node: Pick<EditorNode, "strokeWidth">,
  minLength = MIN_LEN,
): Pick<EditorNode, "x" | "y" | "width" | "height" | "rotation" | "lineX1" | "lineY1" | "lineX2" | "lineY2"> {
  return layoutFromLineEndpoints(x1, y1, x2, y2, node.strokeWidth ?? 2, minLength);
}

/** Keep stored endpoints aligned with box after move / rotate / resize. */
export function lineEndpointsPatchFromLayout(
  node: Pick<
    EditorNode,
    "x" | "y" | "width" | "height" | "rotation" | "flipHorizontal" | "flipVertical"
  >,
): Pick<EditorNode, "lineX1" | "lineY1" | "lineX2" | "lineY2"> {
  const ep = lineEndpointsFromLayout(node);
  return { lineX1: ep.x1, lineY1: ep.y1, lineX2: ep.x2, lineY2: ep.y2 };
}

type LineBoxFields = Pick<
  EditorNode,
  | "x"
  | "y"
  | "width"
  | "height"
  | "rotation"
  | "flipHorizontal"
  | "flipVertical"
  | "lineX1"
  | "lineY1"
  | "lineX2"
  | "lineY2"
>;

/** Transform stored endpoints when the line box changes (resize, move, rotate). */
export function lineEndpointsPatchFromBoxResize(
  before: LineBoxFields,
  after: Pick<
    EditorNode,
    "x" | "y" | "width" | "height" | "rotation" | "flipHorizontal" | "flipVertical"
  >,
): Pick<EditorNode, "lineX1" | "lineY1" | "lineX2" | "lineY2"> {
  const ep = lineEndpointsFromNode(before);
  const sx = before.width > 0 ? after.width / before.width : 1;
  const sy = before.height > 0 ? after.height / before.height : 1;
  const invBefore = invertMatrix(getNodeLocalMatrix(before as EditorNode));
  if (!invBefore) return lineEndpointsPatchFromLayout(after);
  const afterMatrix = getNodeLocalMatrix({ ...(before as EditorNode), ...after });
  const mapEndpoint = (px: number, py: number) => {
    const local = applyMatrixToPoint(invBefore, { x: px, y: py });
    const scaled = { x: local.x * sx, y: local.y * sy };
    return applyMatrixToPoint(afterMatrix, scaled);
  };
  const a = mapEndpoint(ep.x1, ep.y1);
  const b = mapEndpoint(ep.x2, ep.y2);
  return { lineX1: a.x, lineY1: a.y, lineX2: b.x, lineY2: b.y };
}

/** Local render coords for SVG line inside the node box. */
export function lineLocalRenderPoints(
  node: Pick<EditorNode, "x" | "y" | "lineX1" | "lineY1" | "lineX2" | "lineY2" | "width" | "height" | "rotation">,
): { x1: number; y1: number; x2: number; y2: number } {
  const ep = lineEndpointsFromNode(node);
  return {
    x1: ep.x1 - node.x,
    y1: ep.y1 - node.y,
    x2: ep.x2 - node.x,
    y2: ep.y2 - node.y,
  };
}

/** World-space endpoints for hit testing / bounds. */
export function lineEndpointsWorld(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): LineEndpoints {
  const n = nodes[nodeId];
  if (!n || (n.type !== "line" && n.type !== "arrow")) return { x1: 0, y1: 0, x2: 0, y2: 0 };
  const ep = lineEndpointsFromNode(n);
  const parentOf = buildParentMapFromChildOrder(childOrder);
  const parentId = parentOf.get(nodeId) ?? null;
  if (!parentId) return ep;
  const wm = getNodeWorldMatrixFromChildOrder(parentId, nodes, childOrder);
  if (!wm) return ep;
  const a = applyMatrixToPoint(wm, { x: ep.x1, y: ep.y1 });
  const b = applyMatrixToPoint(wm, { x: ep.x2, y: ep.y2 });
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

export function lineHitToleranceWorld(
  node: Pick<EditorNode, "strokeWidth">,
  zoom: number,
): number {
  const sw = node.strokeWidth ?? 2;
  return Math.max(sw / 2, screenPxToWorld(LINE_HIT_SCREEN_PX, zoom));
}

export function hitTestLineWorld(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  zoom: number,
): boolean {
  const n = nodes[nodeId];
  if (!n || (n.type !== "line" && n.type !== "arrow") || !n.visible) return false;
  const ep = lineEndpointsWorld(nodeId, nodes, childOrder);
  const tol = lineHitToleranceWorld(n, zoom);
  return (
    distancePointToLineSegment(
      { x: worldX, y: worldY },
      { x: ep.x1, y: ep.y1 },
      { x: ep.x2, y: ep.y2 },
    ) <= tol
  );
}

/** Minimum axis-aligned bounds that contain the stroked line (round caps ≈ strokeWidth/2 inset). */
export function lineStrokeWorldBounds(
  ep: LineEndpoints,
  strokeWidth = 1,
): { x: number; y: number; width: number; height: number } {
  const half = Math.max(0, strokeWidth) / 2;
  const minX = Math.min(ep.x1, ep.x2) - half;
  const minY = Math.min(ep.y1, ep.y2) - half;
  const maxX = Math.max(ep.x1, ep.x2) + half;
  const maxY = Math.max(ep.y1, ep.y2) + half;
  return {
    x: minX,
    y: minY,
    width: Math.max(MIN_LEN, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

/** Axis-aligned world bounds for selection outlines and layout (matches visible stroke, not frame height). */
export function lineRenderedWorldBounds(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number; width: number; height: number } {
  const n = nodes[nodeId];
  if (!n || (n.type !== "line" && n.type !== "arrow")) return { x: 0, y: 0, width: 0, height: 0 };
  const ep = lineEndpointsWorld(nodeId, nodes, childOrder);
  return lineStrokeWorldBounds(ep, n.strokeWidth ?? 1);
}

/** Snap moving endpoint when Shift is held (45° from the fixed endpoint). */
export function lineEndpointWithShiftSnap(
  fixed: { x: number; y: number },
  moving: { x: number; y: number },
  shiftKey: boolean,
): { x: number; y: number } {
  if (!shiftKey) return moving;
  return constrainLineEndpointTo45Degrees(fixed, moving);
}

/** Rotate both endpoints around center by delta degrees. */
export function rotateLineEndpoints(
  ep: LineEndpoints,
  deltaDeg: number,
): LineEndpoints {
  if (Math.abs(deltaDeg) < 1e-9) return ep;
  const c = lineMidpoint(ep);
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rot = (p: { x: number; y: number }) => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
  };
  const a = rot({ x: ep.x1, y: ep.y1 });
  const b = rot({ x: ep.x2, y: ep.y2 });
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}
