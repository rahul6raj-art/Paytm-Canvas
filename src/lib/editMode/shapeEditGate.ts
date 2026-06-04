import type { EditorNode } from "@/stores/useEditorStore";
import { isPolygonNode } from "@/lib/shapes/polygonGeometry";
import { isStarNode } from "@/lib/shapes/starGeometry";
import { supportsCornerRadiusHandles } from "@/lib/cornerRadius";

export type ShapeEditGateState = {
  editorMode: string;
  tool: string;
  penDrawingNodeId: string | null;
  pencilDrawingNodeId: string | null;
  isPlacingComment: boolean;
  shapeEditModeNodeId: string | null;
  pathEditModeNodeId: string | null;
};

/** True when the canvas is in parametric shape edit for `nodeId`. */
export function isShapeParametricEditActive(
  state: ShapeEditGateState,
  nodeId: string | null,
): boolean {
  if (!nodeId || state.editorMode !== "design" || state.tool !== "move") return false;
  if (state.penDrawingNodeId || state.pencilDrawingNodeId || state.isPlacingComment) {
    return false;
  }
  return state.shapeEditModeNodeId === nodeId;
}

export function canEnterParametricShapeEdit(
  node: EditorNode | null | undefined,
): boolean {
  if (!node || node.locked || node.visible === false) return false;
  if (node.type === "text") return false;
  if (node.type === "ellipse" || node.type === "line" || node.type === "arrow") return true;
  if (node.type === "frame" || node.type === "rectangle") {
    return supportsCornerRadiusHandles(node);
  }
  if (supportsCornerRadiusHandles(node)) return true;
  if (isPolygonNode(node) || isStarNode(node)) return true;
  return false;
}

export function shouldEnterPathEditOnEdit(node: EditorNode | null | undefined): boolean {
  if (!node || node.locked || node.visible === false) return false;
  if (node.type !== "path") return false;
  if (isPolygonNode(node) || isStarNode(node)) return false;
  return true;
}
