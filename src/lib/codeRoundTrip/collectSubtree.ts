import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";

/** Collect nodes and childOrder for one or more roots (inclusive). */
export function collectSubtreeForExport(
  rootIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  exportRootIds: string[];
} {
  const ids = new Set<string>();
  const queue = [...rootIds];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (ids.has(id) || !nodes[id]) continue;
    ids.add(id);
    for (const c of childOrder[id] ?? []) queue.push(c);
  }

  const outNodes: Record<string, EditorNode> = {};
  for (const id of ids) outNodes[id] = nodes[id]!;

  const outOrder: Record<string, string[]> = {};
  for (const id of ids) {
    outOrder[id] = (childOrder[id] ?? []).filter((c) => ids.has(c));
  }
  const exportRootIds = rootIds.filter((id) => ids.has(id));
  outOrder[EDITOR_ROOT_KEY] = exportRootIds;

  return { nodes: outNodes, childOrder: outOrder, exportRootIds };
}
