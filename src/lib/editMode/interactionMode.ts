import type { CanvasInteractionMode } from "./types";

export type InteractionModeInput = {
  tool: string;
  editingTextId: string | null;
  shapeEditModeNodeId: string | null;
  pathEditModeNodeId: string | null;
  transformInteractionMode: "none" | "resize" | "rotate";
  isMovingSelection: boolean;
};

export function resolveCanvasInteractionMode(
  input: InteractionModeInput,
): CanvasInteractionMode {
  if (input.editingTextId) return "textEdit";
  if (input.shapeEditModeNodeId || input.pathEditModeNodeId) return "edit";
  if (input.transformInteractionMode === "resize") return "resize";
  if (input.transformInteractionMode === "rotate") return "rotate";
  if (input.isMovingSelection) return "move";
  return "select";
}

export function isInEditMode(input: InteractionModeInput): boolean {
  return resolveCanvasInteractionMode(input) === "edit";
}
