import type { EditorNode } from "@/stores/useEditorStore";

/** Groups and frames with children can be ungrouped (children reparented, container removed). */
export function isUngroupableContainer(node: EditorNode | undefined): boolean {
  if (!node || !node.visible || node.locked) return false;
  return node.type === "group" || node.type === "frame";
}

export function canUngroupSelection(s: {
  selectedIds: string[];
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
}): boolean {
  if (s.selectedIds.length !== 1) return false;
  const id = s.selectedIds[0]!;
  const container = s.nodes[id];
  if (!isUngroupableContainer(container)) return false;
  return (s.childOrder[id] ?? []).length > 0;
}
