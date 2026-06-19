import { getCursorPositionFromPoint } from "@/lib/text/textCursor";
import { worldToLocalForNode } from "@/lib/tree";
import { useEditorStore } from "@/stores/useEditorStore";

export type TextEditSelection = { anchor: number; focus: number };

/** Map a world click to a caret index inside a text layer. */
export function resolveTextCaretAtWorldPoint(
  nodeId: string,
  worldX: number,
  worldY: number,
): number | null {
  const st = useEditorStore.getState();
  const node = st.nodes[nodeId];
  if (!node || node.type !== "text") return null;
  const local = worldToLocalForNode(worldX, worldY, nodeId, st.nodes, st.childOrder);
  if (!local) return null;
  return getCursorPositionFromPoint(local.x, local.y, node);
}

/** Enter inline text editing for a layer. */
export function enterTextEditMode(
  nodeId: string,
  selection?: TextEditSelection,
): void {
  const st = useEditorStore.getState();
  const n = st.nodes[nodeId];
  if (!n || n.type !== "text" || n.locked || !n.visible) return;
  st.select(nodeId);
  st.setEditingTextId(nodeId, selection);
}

/** Enter inline text editing with the caret at a world-space click. */
export function enterTextEditModeAtWorldPoint(
  nodeId: string,
  worldX: number,
  worldY: number,
): void {
  const st = useEditorStore.getState();
  const n = st.nodes[nodeId];
  if (!n || n.type !== "text" || n.locked || !n.visible) return;
  const index = resolveTextCaretAtWorldPoint(nodeId, worldX, worldY) ?? (n.content?.length ?? 0);
  st.select(nodeId);
  st.setEditingTextId(nodeId, { anchor: index, focus: index });
}

/** Exit inline text editing. */
export function exitTextEditMode(): void {
  useEditorStore.getState().setEditingTextId(null);
}
