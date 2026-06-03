import { layoutAutoNodeDeep } from "./layoutAutoNode";
import { isAutoLayoutContainer, type LayoutEngineNode } from "./types";

/**
 * Mark a node and every auto-layout ancestor dirty so relayoutDirtyTree can
 * recompute only affected branches.
 */
export function markLayoutDirty(
  nodes: Record<string, LayoutEngineNode>,
  nodeId: string,
): Record<string, LayoutEngineNode> {
  let next = { ...nodes };
  let cur: string | null = nodeId;
  while (cur) {
    const n: LayoutEngineNode | undefined = next[cur];
    if (!n) break;
    if (!n.layoutDirty) {
      next[cur] = { ...n, layoutDirty: true };
    }
    cur = n.parentId ?? null;
  }
  return next;
}

/** Collect auto-layout container ids that are dirty (or contain dirty descendants). */
export function collectDirtyAutoLayoutRoots(
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
): string[] {
  const dirty = new Set<string>();
  for (const id of Object.keys(nodes)) {
    if (nodes[id]?.layoutDirty) dirty.add(id);
  }
  if (dirty.size === 0) return [];

  const roots: string[] = [];
  for (const id of dirty) {
    let cur: string | null = id;
    let alAncestor: string | null = null;
    while (cur) {
      const n: LayoutEngineNode | undefined = nodes[cur];
      if (!n) break;
      if (isAutoLayoutContainer(n)) alAncestor = cur;
      cur = n.parentId ?? null;
    }
    if (alAncestor) roots.push(alAncestor);
  }

  // Keep only topmost dirty AL roots
  const rootSet = new Set(roots);
  return [...rootSet].filter((id) => {
    let p = nodes[id]?.parentId ?? null;
    while (p) {
      const pn: LayoutEngineNode | undefined = nodes[p];
      if (pn && rootSet.has(p) && isAutoLayoutContainer(pn)) return false;
      p = pn?.parentId ?? null;
    }
    return true;
  });
}

/** Depth of node for bottom-up relayout (deeper first). */
function depthOf(
  nodeId: string,
  nodes: Record<string, LayoutEngineNode>,
): number {
  let d = 0;
  let cur = nodes[nodeId]?.parentId ?? null;
  while (cur) {
    d++;
    cur = nodes[cur]?.parentId ?? null;
  }
  return d;
}

/**
 * Relayout only dirty auto-layout subtrees (deepest roots first).
 * Falls back to relayouting all provided root ids when none are marked dirty.
 */
export function relayoutDirtyTree(
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
  hintRootIds?: Iterable<string>,
): Record<string, LayoutEngineNode> {
  let roots = collectDirtyAutoLayoutRoots(nodes, childOrder);
  if (roots.length === 0 && hintRootIds) {
    roots = [...hintRootIds].filter((id) => isAutoLayoutContainer(nodes[id]));
  }
  if (roots.length === 0) return nodes;

  roots.sort((a, b) => depthOf(b, nodes) - depthOf(a, nodes));

  let next = { ...nodes };
  for (const rootId of roots) {
    if (!isAutoLayoutContainer(next[rootId])) continue;
    next = layoutAutoNodeDeep(next, childOrder, rootId);
    // Clear dirty flags in subtree
    next = clearDirtyInSubtree(next, childOrder, rootId);
  }
  return next;
}

function clearDirtyInSubtree(
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
  rootId: string,
): Record<string, LayoutEngineNode> {
  let next = { ...nodes };
  const walk = (id: string) => {
    const n = next[id];
    if (n?.layoutDirty) next[id] = { ...n, layoutDirty: false };
    for (const c of childOrder[id] ?? []) walk(c);
  };
  walk(rootId);
  return next;
}
