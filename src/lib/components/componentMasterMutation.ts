import type { EditorNode } from "@/stores/useEditorStore";
import { findInstanceRoot } from "@/lib/componentModel";
import {
  beginComponentUpdateTransaction,
  endComponentUpdateTransaction,
  recordMasterMutation,
} from "@/lib/components/componentUpdateTransaction";
import {
  commitComponentUpdateTransaction,
  type ComponentPropagationResult,
} from "@/lib/components/componentPropagation";
import { findMasterRootForNode } from "@/lib/components/propagate";
import {
  assignStableIdsToNewMasterLayers,
  collectMasterRootsAffectedByNodeIds,
  ensureMasterStableIds,
  removeStableIdsForDeletedMasterLayers,
} from "@/lib/components/stableIdLifecycle";
import { collectSubtreeIds } from "@/lib/editorGraph";

export type MasterDocumentMutation = {
  changedNodeIds: string[];
  changedKeysByNode?: Record<string, (keyof EditorNode)[]>;
  addedNodeIds?: string[];
  removedNodeIds?: string[];
  structural?: boolean;
  reason?: string;
};

const DEFAULT_CHANGED_KEYS: (keyof EditorNode)[] = [
  "content",
  "fill",
  "fillEnabled",
  "fillOpacity",
  "strokeColor",
  "strokeEnabled",
  "strokeWidth",
  "visible",
  "opacity",
  "width",
  "height",
  "x",
  "y",
  "layoutMode",
  "layoutGap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
];

function keysForNode(nodeId: string, mutation: MasterDocumentMutation): (keyof EditorNode)[] {
  return mutation.changedKeysByNode?.[nodeId] ?? DEFAULT_CHANGED_KEYS;
}

function isMasterLayerEdit(nodes: Record<string, EditorNode>, nodeId: string): boolean {
  return !findInstanceRoot(nodes, nodeId) && findMasterRootForNode(nodes, nodeId) !== null;
}

/** Sync stable ids and commit component propagation for master document edits. */
export function applyMasterComponentDocumentChanges(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  refresh: Set<string>,
  mutation: MasterDocumentMutation,
): {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  result?: ComponentPropagationResult;
} {
  const changedNodeIds = (mutation.changedNodeIds ?? []).filter((id) => isMasterLayerEdit(nodes, id));
  const removedNodeIds = mutation.removedNodeIds ?? [];
  const addedNodeIds = (mutation.addedNodeIds ?? []).filter((id) => isMasterLayerEdit(nodes, id));

  const hasStructural =
    mutation.structural === true || removedNodeIds.length > 0 || addedNodeIds.length > 0;

  if (changedNodeIds.length === 0 && !hasStructural) {
    return { nodes, childOrder };
  }

  let nextNodes = { ...nodes };
  const masterRoots = new Set(
    collectMasterRootsAffectedByNodeIds(nextNodes, [
      ...changedNodeIds,
      ...addedNodeIds,
    ]),
  );
  for (const m of Object.values(nextNodes)) {
    if (!m?.isComponent || !m.componentLayerStableIds) continue;
    for (const removedId of removedNodeIds) {
      if (m.componentLayerStableIds[removedId]) masterRoots.add(m.id);
    }
  }
  const masterRootList = [...masterRoots];

  for (const masterRootId of masterRootList) {
    nextNodes = removeStableIdsForDeletedMasterLayers(
      nextNodes,
      childOrder,
      masterRootId,
      removedNodeIds,
    );
    nextNodes = assignStableIdsToNewMasterLayers(
      nextNodes,
      childOrder,
      masterRootId,
      addedNodeIds,
    );
    if (hasStructural) {
      nextNodes = ensureMasterStableIds(nextNodes, childOrder, masterRootId);
    }
  }

  const existingTx = endComponentUpdateTransaction();
  if (existingTx && existingTx.mutations.length > 0) {
    beginComponentUpdateTransaction(existingTx.reason);
    for (const m of existingTx.mutations) {
      recordMasterMutation(m.masterRootId, m.layerNodeId, m.stableId, m.changedKeys, m.structural);
    }
  } else {
    beginComponentUpdateTransaction(mutation.reason ?? "document-mutation");
  }

  for (const nodeId of changedNodeIds) {
    const masterRootId = findMasterRootForNode(nextNodes, nodeId);
    if (!masterRootId) continue;
    recordMasterMutation(
      masterRootId,
      nodeId,
      nextNodes[masterRootId]?.componentLayerStableIds?.[nodeId] ?? null,
      keysForNode(nodeId, mutation),
      hasStructural,
    );
  }

  if (changedNodeIds.length === 0 && hasStructural) {
    for (const masterRootId of masterRootList) {
      recordMasterMutation(
        masterRootId,
        masterRootId,
        nextNodes[masterRootId]?.componentLayerStableIds?.[masterRootId] ?? null,
        ["layoutMode"],
        true,
      );
    }
  }

  const tx = endComponentUpdateTransaction();
  if (!tx || tx.mutations.length === 0) {
    return { nodes: nextNodes, childOrder };
  }

  const result = commitComponentUpdateTransaction(nextNodes, childOrder, tx);
  for (const k of result.relayoutKeys) refresh.add(k);
  return { nodes: result.nodes, childOrder: result.childOrder, result };
}

export function collectRemovedSubtreeIds(
  rootIds: string[],
  childOrder: Record<string, string[]>,
): string[] {
  const out = new Set<string>();
  for (const rootId of rootIds) {
    for (const id of collectSubtreeIds(rootId, childOrder)) out.add(id);
  }
  return [...out];
}
