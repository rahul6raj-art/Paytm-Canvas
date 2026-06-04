"use client";

import { useEditorStore } from "@/stores/useEditorStore";
import { isShapeParametricEditActive } from "@/lib/editMode/shapeEditGate";

/** Shared gate: parametric edit handles for the sole selected node in shape edit mode. */
export function useShapeEditHandlesGate() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editorMode = useEditorStore((s) => s.editorMode);
  const tool = useEditorStore((s) => s.tool);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const pencilDrawingNodeId = useEditorStore((s) => s.pencilDrawingNodeId);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const shapeEditModeNodeId = useEditorStore((s) => s.shapeEditModeNodeId);
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);

  const id = selectedIds.length === 1 ? selectedIds[0]! : null;
  const show =
    isShapeParametricEditActive(
      {
        editorMode,
        tool,
        penDrawingNodeId,
        pencilDrawingNodeId,
        isPlacingComment,
        shapeEditModeNodeId,
        pathEditModeNodeId,
      },
      id,
    ) && id != null;

  return { show, id };
}
