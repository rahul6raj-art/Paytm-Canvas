"use client";

import { resolveAutoLayoutHandleFrameId } from "@/lib/autoLayout/resolveHandleFrame";
import { useEditorStore } from "@/stores/useEditorStore";

/** Show auto-layout spacing/padding handles for a selected frame or flow child inside one. */
export function useAutoLayoutHandlesGate() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editorMode = useEditorStore((s) => s.editorMode);
  const transformInteractionMode = useEditorStore((s) => s.transformInteractionMode);
  const nodes = useEditorStore((s) => s.nodes);

  const id = resolveAutoLayoutHandleFrameId(selectedIds, nodes);
  const node = id ? nodes[id] : null;
  const show =
    editorMode === "design" &&
    transformInteractionMode === "none" &&
    id != null &&
    node != null &&
    !node.locked;

  return { show, id, node };
}
