import type { EditorNode } from "@/stores/useEditorStore";
import { collectSubtreeIds } from "@/lib/editorGraph";
import { findMasterRootForNode } from "@/lib/components/propagate";
import { assignStableLayerIds, newStableLayerId } from "@/lib/components/stableIds";

/** Assign stable ids to newly added layers inside a component master subtree. */
export function assignStableIdsToNewMasterLayers(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterRootId: string,
  addedNodeIds: string[],
): Record<string, EditorNode> {
  const master = nodes[masterRootId];
  if (!master?.isComponent) return nodes;

  let stableIds = { ...(master.componentLayerStableIds ?? {}) };
  let next = { ...nodes };

  for (const nodeId of addedNodeIds) {
    if (stableIds[nodeId]) continue;
    const n = nodes[nodeId];
    if (!n) continue;
    if (findMasterRootForNode(nodes, nodeId) !== masterRootId) continue;
    stableIds = { ...stableIds, [nodeId]: newStableLayerId(n.type) };
  }

  if (Object.keys(stableIds).length > 0) {
    next[masterRootId] = { ...master, componentLayerStableIds: stableIds };
  }
  return next;
}

/** Remove stable ids for deleted layers; optionally rebuild full map from subtree. */
export function removeStableIdsForDeletedMasterLayers(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterRootId: string,
  removedNodeIds: string[],
): Record<string, EditorNode> {
  const master = nodes[masterRootId];
  if (!master?.isComponent || !master.componentLayerStableIds) return nodes;

  const stableIds = { ...master.componentLayerStableIds };
  let changed = false;
  for (const id of removedNodeIds) {
    if (stableIds[id]) {
      delete stableIds[id];
      changed = true;
    }
  }
  if (!changed) return nodes;

  return {
    ...nodes,
    [masterRootId]: { ...master, componentLayerStableIds: stableIds },
  };
}

/** Ensure every node in a master subtree has a stable layer id. */
export function ensureMasterStableIds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterRootId: string,
): Record<string, EditorNode> {
  const master = nodes[masterRootId];
  if (!master?.isComponent) return nodes;

  const existing = master.componentLayerStableIds ?? {};
  const full = assignStableLayerIds(nodes, childOrder, masterRootId);
  const merged: Record<string, string> = { ...existing };

  for (const [nodeId, stableId] of Object.entries(full)) {
    if (!merged[nodeId]) merged[nodeId] = stableId;
  }

  return {
    ...nodes,
    [masterRootId]: { ...master, componentLayerStableIds: merged },
  };
}

export function collectMasterRootsAffectedByNodeIds(
  nodes: Record<string, EditorNode>,
  nodeIds: string[],
): string[] {
  const roots = new Set<string>();
  for (const nodeId of nodeIds) {
    const root = findMasterRootForNode(nodes, nodeId);
    if (root) roots.add(root);
  }
  return [...roots];
}

export function isStructuralMasterChildOrderChange(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterRootId: string,
  prevChildOrder: Record<string, string[]>,
): boolean {
  for (const nodeId of collectSubtreeIds(masterRootId, childOrder)) {
    const prev = prevChildOrder[nodeId] ?? [];
    const cur = childOrder[nodeId] ?? [];
    if (prev.length !== cur.length) return true;
    for (let i = 0; i < prev.length; i++) {
      if (prev[i] !== cur[i]) return true;
    }
  }
  return false;
}
