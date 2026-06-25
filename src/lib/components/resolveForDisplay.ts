import type { EditorNode } from "@/stores/useEditorStore";
import { mergeInstanceOverrides, findInstanceRoot } from "@/lib/componentModel";
import { resolveComponentInstance, isInstanceStale } from "@/lib/components/resolveComponentInstance";

/**
 * Resolve a node for display/layout/hit-testing.
 * Instances are views over master + overrides — not independent clones.
 * Materialized nodes in the store are a cache; overrides merge at read time.
 */
export function resolveNodeForDisplay(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeId: string,
): EditorNode | null {
  const base = nodes[nodeId];
  if (!base) return null;

  const instanceRootId = findInstanceRoot(nodes, nodeId);
  if (!instanceRootId) return base;

  const instanceRoot = nodes[instanceRootId];
  if (!instanceRoot?.sourceComponentId || instanceRoot.instanceDetached) {
    return mergeInstanceOverrides(base, nodes);
  }

  return mergeInstanceOverrides(base, nodes);
}

/** Resolve stale instance subtrees before layout/render passes. */
export function ensureInstancesResolved(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootIds?: string[],
): {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  resolved: string[];
} {
  let nextNodes = nodes;
  let nextOrder = childOrder;
  const resolved: string[] = [];

  const roots =
    instanceRootIds ??
    Object.values(nodes)
      .filter((n) => n.sourceComponentId && findInstanceRoot(nodes, n.id) === n.id)
      .map((n) => n.id);

  for (const rootId of roots) {
    if (!isInstanceStale(nextNodes, rootId) && nextNodes[rootId]?.resolvedTreeCacheVersion) continue;
    const result = resolveComponentInstance(nextNodes, nextOrder, rootId, { force: true });
    nextNodes = result.nodes;
    nextOrder = result.childOrder;
    resolved.push(rootId);
  }

  return { nodes: nextNodes, childOrder: nextOrder, resolved };
}

export function isResolvedInstanceCacheFresh(
  nodes: Record<string, EditorNode>,
  instanceRootId: string,
): boolean {
  return !isInstanceStale(nodes, instanceRootId);
}
