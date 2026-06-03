import type { EditorNode } from "@/stores/useEditorStore";
import { getNodeTransformedWorldBounds, pointInNodeWorldBounds } from "@/lib/transformMath";
import { editorNodeToShape, type ShapeModel } from "./shapeModel";

export type Bounds = { x: number; y: number; width: number; height: number };

/** Axis-aligned world bounds for a shape node. */
export function getShapeBounds(node: EditorNode | ShapeModel, nodes?: Record<string, EditorNode>): Bounds {
  if ("shapeType" in node) {
    return { x: node.x, y: node.y, width: node.width, height: node.height };
  }
  const map = nodes ?? { [node.id]: node };
  return getNodeTransformedWorldBounds(node.id, map);
}

/** World-space hit test for shape selection. */
export function hitTestShape(
  worldX: number,
  worldY: number,
  shapeNode: EditorNode,
  nodes: Record<string, EditorNode>,
): boolean {
  if (!shapeNode.visible || shapeNode.locked) return false;
  return pointInNodeWorldBounds(worldX, worldY, shapeNode.id, nodes);
}
