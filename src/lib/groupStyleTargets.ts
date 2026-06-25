import type { EditorNode } from "@/stores/useEditorStore";

/** Layers that accept fill/stroke edits from the design panel. */
export function nodeCanReceiveFillStroke(node: EditorNode): boolean {
  return (
    node.type === "rectangle" ||
    node.type === "frame" ||
    node.type === "ellipse" ||
    node.type === "polygon" ||
    node.type === "path" ||
    node.type === "text" ||
    Boolean(node.isBooleanGroup)
  );
}

/** Visible, unlocked fill/stroke targets inside a group/frame (skips nested groups). */
export function collectContainerStyleTargets(
  containerId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): EditorNode[] {
  const out: EditorNode[] = [];
  const walk = (id: string) => {
    const n = nodes[id];
    if (!n || !n.visible || n.locked) return;
    if (n.type === "group") {
      for (const cid of childOrder[id] ?? []) walk(cid);
      return;
    }
    if (nodeCanReceiveFillStroke(n)) out.push(n);
  };
  for (const cid of childOrder[containerId] ?? []) walk(cid);
  return out;
}

/** Whether a container's children can be styled together (e.g. outlined text vectors). */
export function containerSupportsAggregateFillStroke(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  if (node.type !== "group" && node.type !== "frame") return false;
  if (node.isBooleanGroup) return false;
  return collectContainerStyleTargets(node.id, nodes, childOrder).length > 0;
}

/** Expand a selected container to the layers that should receive fill/stroke edits. */
export function expandStyleTargetIds(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  const n = nodes[nodeId];
  if (!n || !n.visible || n.locked) return [];
  if (containerSupportsAggregateFillStroke(n, nodes, childOrder)) {
    return collectContainerStyleTargets(n.id, nodes, childOrder).map((t) => t.id);
  }
  if (nodeCanReceiveFillStroke(n)) return [nodeId];
  return [];
}
