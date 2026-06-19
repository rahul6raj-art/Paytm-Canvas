import type { EditorNode } from "@/stores/useEditorStore";
import { lineEndpointsFromNode } from "./lineGeometry";

/** True when a layer has no drawable area yet (live drag at the click anchor). */
export function isZeroAreaDraftNode(
  node: Pick<
    EditorNode,
    | "type"
    | "width"
    | "height"
    | "lineX1"
    | "lineY1"
    | "lineX2"
    | "lineY2"
    | "x"
    | "y"
    | "rotation"
  >,
): boolean {
  if (node.type === "line" || node.type === "arrow") {
    const ep = lineEndpointsFromNode({
      ...node,
      x: node.x ?? 0,
      y: node.y ?? 0,
      rotation: node.rotation ?? 0,
    });
    return Math.hypot(ep.x2 - ep.x1, ep.y2 - ep.y1) < 0.5;
  }
  return node.width <= 0 && node.height <= 0;
}

/** @deprecated Use isZeroAreaDraftNode */
export const isZeroAreaShapeNode = isZeroAreaDraftNode;
