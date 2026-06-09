import type { EditorNode } from "@/stores/useEditorStore";
import {
  arrowHeadSizeForNode,
  getArrowAngle,
  isArrowNode,
  resolveArrowEndKind,
  resolveArrowStartKind,
} from "@/lib/shapes/arrowGeometry";
import { lineEndpointsFromNode } from "@/lib/shapes/lineGeometry";

/** Offset cap control along the shaft near the start tip. */
type ArrowLineNode = Pick<
  EditorNode,
  | "type"
  | "width"
  | "height"
  | "x"
  | "y"
  | "rotation"
  | "lineX1"
  | "lineY1"
  | "lineX2"
  | "lineY2"
  | "arrowHeadSize"
  | "strokeWidth"
>;

export function arrowStartCapHandleLocal(node: ArrowLineNode): { x: number; y: number } {
  const ep = lineEndpointsFromNode(node);
  const t = 0.15;
  return {
    x: ep.x1 + (ep.x2 - ep.x1) * t,
    y: ep.y1 + (ep.y2 - ep.y1) * t,
  };
}

/** Offset cap control along the shaft near the end tip. */
export function arrowEndCapHandleLocal(node: ArrowLineNode): { x: number; y: number } {
  const ep = lineEndpointsFromNode(node);
  const t = 0.85;
  return {
    x: ep.x1 + (ep.x2 - ep.x1) * t,
    y: ep.y1 + (ep.y2 - ep.y1) * t,
  };
}

/** Perpendicular offset handle for arrowhead size (mid-shaft). */
export function arrowHeadSizeHandleLocal(node: ArrowLineNode): { x: number; y: number } {
  const ep = lineEndpointsFromNode(node);
  const mx = (ep.x1 + ep.x2) / 2;
  const my = (ep.y1 + ep.y2) / 2;
  const angle = getArrowAngle(ep);
  const size = arrowHeadSizeForNode(node);
  const off = Math.max(8, size * 0.6);
  return {
    x: mx + Math.cos(angle + Math.PI / 2) * off,
    y: my + Math.sin(angle + Math.PI / 2) * off,
  };
}

export function arrowHeadSizeFromLocalPoint(
  localX: number,
  localY: number,
  node: ArrowLineNode,
): number {
  const ep = lineEndpointsFromNode(node);
  const mx = (ep.x1 + ep.x2) / 2;
  const my = (ep.y1 + ep.y2) / 2;
  const angle = getArrowAngle(ep);
  const nx = Math.cos(angle + Math.PI / 2);
  const ny = Math.sin(angle + Math.PI / 2);
  const dist = Math.abs((localX - mx) * nx + (localY - my) * ny);
  return Math.max(4, Math.min(80, Math.round(dist * 1.2)));
}

export { isArrowNode, resolveArrowStartKind, resolveArrowEndKind };
