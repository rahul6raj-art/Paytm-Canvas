import { useEditorStore } from "@/stores/useEditorStore";

/** Enter inline text editing for a layer. */
export function enterTextEditMode(nodeId: string): void {
  const st = useEditorStore.getState();
  const n = st.nodes[nodeId];
  if (!n || n.type !== "text" || n.locked || !n.visible) return;
  st.pushHistory();
  st.setEditingTextId(nodeId);
}

/** Exit inline text editing. */
export function exitTextEditMode(): void {
  useEditorStore.getState().setEditingTextId(null);
}
