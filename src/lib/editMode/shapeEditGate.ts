import type { EditorNode } from "@/stores/useEditorStore";
import { isCanvasBgCreationTool } from "@/lib/canvasInteractionGuards";
import { isPolygonNode } from "@/lib/shapes/polygonGeometry";
import { isStarNode } from "@/lib/shapes/starGeometry";
import { supportsCornerRadiusHandles } from "@/lib/cornerRadius";

export type EllipseArcCanvasGateState = {
  editorMode: string;
  tool: string;
  penDrawingNodeId: string | null;
  pencilDrawingNodeId: string | null;
  isPlacingComment: boolean;
  selectedIds: readonly string[];
  transformInteractionMode: string;
  dragActive: boolean;
};

/** True when sweep/ratio arc handles should render on the canvas. */
export function shouldShowEllipseArcHandlesOnCanvas(
  state: EllipseArcCanvasGateState,
  node: Pick<EditorNode, "type" | "visible" | "locked"> | null | undefined,
): boolean {
  if (!node || node.type !== "ellipse" || node.visible === false || node.locked) return false;
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
