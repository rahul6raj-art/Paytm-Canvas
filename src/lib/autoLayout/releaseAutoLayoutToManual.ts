import type { EditorNode } from "@/stores/useEditorStore";

/** Turn off auto layout while keeping children at their current parent-local positions. */
export function releaseAutoLayoutContainerToManual(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  containerId: string,
): Record<string, EditorNode> {
  const parent = nodes[containerId];
  if (!parent || (parent.layoutMode ?? "none") === "none") return nodes;

  const next: Record<string, EditorNode> = { ...nodes };
  for (const kidId of childOrder[containerId] ?? []) {
    const kid = next[kidId];
    if (!kid || kid.visible === false) continue;
    next[kidId] = {
      ...kid,
      layoutPositioning: "absolute",
      layoutSizingHorizontal: kid.layoutSizingHorizontal ?? "fixed",
      layoutSizingVertical: kid.layoutSizingVertical ?? "fixed",
      layoutDirty: false,
    };
  }

  next[containerId] = {
    ...parent,
    layoutMode: "none",
    layoutGap: 0,
    layoutGapAuto: false,
    layoutDirty: false,
  };
  return next;
}
