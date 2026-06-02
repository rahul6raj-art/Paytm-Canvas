import { useEditorStore } from "@/stores/useEditorStore";

/**
 * Option/Alt + drag: clone selection in place, then drag the clone (Figma-style).
 * Returns false when the caller should handle the gesture (e.g. component instance spawn).
 */
export function prepareAltDragDuplicate(clickedNodeId: string): boolean {
  const st = useEditorStore.getState();
  const node = st.nodes[clickedNodeId];
  if (
    node?.isComponent &&
    (node.type === "frame" || node.type === "group") &&
    st.tool === "move"
  ) {
    return false;
  }
  const newIds = st.cloneSelectionInPlace();
  return newIds.length > 0;
}
