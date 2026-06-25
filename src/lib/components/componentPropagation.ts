import type { EditorNode } from "@/stores/useEditorStore";
import { collectSubtreeIds } from "@/lib/editorGraph";
import { findInstanceRoot } from "@/lib/componentModel";
import {
  cascadeMasterRootsForComponentChange,
  listInstanceRootsForComponentId,
} from "@/lib/components/componentDependencies";
import {
  collapseTransactionMutations,
  endComponentUpdateTransaction,
  type ComponentUpdateTransaction,
} from "@/lib/components/componentUpdateTransaction";
import {
  findMasterRootForNode,
  incrementComponentVersion,
  propagateMasterLayerToInstances,
} from "@/lib/components/propagate";
import {
  collectInstanceRelayoutKeys,
  resolveComponentInstance,
} from "@/lib/components/resolveComponentInstance";

let lastPropagationMeta: ComponentPropagationResult | null = null;

export function setLastComponentPropagationMeta(meta: ComponentPropagationResult | null): void {
  lastPropagationMeta = meta;
}

export function getLastComponentPropagationMeta(): ComponentPropagationResult | null {
  return lastPropagationMeta;
}

export type ComponentPropagationResult = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  relayoutKeys: Set<string>;
  affectedInstanceRoots: string[];
  changedStableIds: string[];
  droppedOverrides: string[];
  masterVersions: Record<string, number>;
  reason: string;
  nestedDependencyPath: string[];
};

const TEXT_LAYOUT_KEYS = new Set<string>([
  "content",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textResizeMode",
]);

const LAYOUT_CONTAINER_KEYS = new Set<string>([
  "layoutMode",
  "layoutGap",
  "layoutGapAuto",
  "layoutWrap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "primaryAxisAlign",
  "counterAxisAlign",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "layoutGrow",
  "visible",
]);

function markLayoutDirtyOnNodes(
  nodes: Record<string, EditorNode>,
  keys: Iterable<string>,
): Record<string, EditorNode> {
  let next = { ...nodes };
  for (const id of keys) {
    const n = next[id];
    if (!n) continue;
    next[id] = { ...n, layoutDirty: true };
  }
  return next;
}

function invalidateLayoutForPropagation(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootIds: string[],
  changedKeys: (keyof EditorNode)[],
): Set<string> {
  const relayoutKeys = new Set<string>();
  for (const instRootId of instanceRootIds) {
    for (const k of collectInstanceRelayoutKeys(nodes, childOrder, instRootId)) {
      relayoutKeys.add(k);
    }
  }

  const keys = changedKeys.map(String);
  if (keys.some((k) => TEXT_LAYOUT_KEYS.has(k))) {
    for (const instRootId of instanceRootIds) {
      for (const nodeId of collectSubtreeIds(instRootId, childOrder)) {
        const n = nodes[nodeId];
        if (n?.type === "text" && n.parentId) relayoutKeys.add(n.parentId);
      }
    }
  }

  if (keys.some((k) => LAYOUT_CONTAINER_KEYS.has(k))) {
    for (const instRootId of instanceRootIds) {
      for (const nodeId of collectSubtreeIds(instRootId, childOrder)) {
        const n = nodes[nodeId];
        if (n && (n.layoutMode ?? "none") !== "none") relayoutKeys.add(nodeId);
      }
    }
  }

  return relayoutKeys;
}

function resolveAffectedInstances(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootIds: string[],
  force: boolean,
): {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  droppedOverrides: string[];
  relayoutKeys: Set<string>;
} {
  let nextNodes = nodes;
  let nextOrder = childOrder;
  const dropped: string[] = [];
  const relayoutKeys = new Set<string>();

  for (const instanceRootId of instanceRootIds) {
    if (findInstanceRoot(nextNodes, instanceRootId) !== instanceRootId) continue;
    const resolved = resolveComponentInstance(nextNodes, nextOrder, instanceRootId, {
      force,
      debug: process.env.NODE_ENV !== "production",
    });
    nextNodes = resolved.nodes;
    nextOrder = resolved.childOrder;
    dropped.push(...resolved.droppedOverrides);
    for (const k of resolved.relayoutKeys) relayoutKeys.add(k);
  }

  return { nodes: nextNodes, childOrder: nextOrder, droppedOverrides: dropped, relayoutKeys };
}

export function commitComponentUpdateTransaction(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  tx: ComponentUpdateTransaction,
): ComponentPropagationResult {
  const collapsed = collapseTransactionMutations(tx);
  let nextNodes = { ...nodes };
  let nextOrder = { ...childOrder };
  const relayoutKeys = new Set<string>();
  const affectedInstanceRoots = new Set<string>();
  const changedStableIds: string[] = [];
  const droppedOverrides: string[] = [];
  const masterVersions: Record<string, number> = {};
  const nestedDependencyPath: string[] = [];

  for (const [masterRootId, bucket] of collapsed) {
    const cascadeOrder = cascadeMasterRootsForComponentChange(nextNodes, nextOrder, masterRootId);
    nestedDependencyPath.push(...cascadeOrder);

    for (const cascadeMasterId of cascadeOrder) {
      const master = nextNodes[cascadeMasterId];
      if (!master?.isComponent || !master.componentId) continue;

      nextNodes = incrementComponentVersion(nextNodes, cascadeMasterId);
      masterVersions[cascadeMasterId] = nextNodes[cascadeMasterId]?.componentVersion ?? 1;

      if (cascadeMasterId === masterRootId) {
        for (const layerNodeId of bucket.layerNodeIds) {
          const stableId = master.componentLayerStableIds?.[layerNodeId];
          if (stableId) changedStableIds.push(stableId);
          nextNodes = propagateMasterLayerToInstances(
            nextNodes,
            layerNodeId,
            [...bucket.changedKeys],
          );
        }
      }

      const instanceRoots = listInstanceRootsForComponentId(nextNodes, master.componentId);
      for (const ir of instanceRoots) affectedInstanceRoots.add(ir);

      const resolved = resolveAffectedInstances(
        nextNodes,
        nextOrder,
        instanceRoots,
        bucket.structural || cascadeMasterId !== masterRootId,
      );
      nextNodes = resolved.nodes;
      nextOrder = resolved.childOrder;
      droppedOverrides.push(...resolved.droppedOverrides);
      for (const k of resolved.relayoutKeys) relayoutKeys.add(k);

      const layoutKeys = invalidateLayoutForPropagation(
        nextNodes,
        nextOrder,
        instanceRoots,
        [...bucket.changedKeys],
      );
      for (const k of layoutKeys) relayoutKeys.add(k);
    }
  }

  nextNodes = markLayoutDirtyOnNodes(nextNodes, relayoutKeys);

  const result: ComponentPropagationResult = {
    nodes: nextNodes,
    childOrder: nextOrder,
    relayoutKeys,
    affectedInstanceRoots: [...affectedInstanceRoots],
    changedStableIds: [...new Set(changedStableIds)],
    droppedOverrides: [...new Set(droppedOverrides)],
    masterVersions,
    reason: tx.reason,
    nestedDependencyPath: [...new Set(nestedDependencyPath)],
  };
  setLastComponentPropagationMeta(result);
  return result;
}

/** Single master-layer edit (used when no active transaction). */
export function commitMasterLayerMutation(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  layerNodeId: string,
  changedKeys: (keyof EditorNode)[],
  opts?: { structural?: boolean; reason?: string },
): ComponentPropagationResult {
  const masterRootId = findMasterRootForNode(nodes, layerNodeId);
  if (!masterRootId) {
    return {
      nodes,
      childOrder,
      relayoutKeys: new Set(),
      affectedInstanceRoots: [],
      changedStableIds: [],
      droppedOverrides: [],
      masterVersions: {},
      reason: opts?.reason ?? "none",
      nestedDependencyPath: [],
    };
  }

  const stableId = nodes[masterRootId]?.componentLayerStableIds?.[layerNodeId] ?? null;
  const tx: ComponentUpdateTransaction = {
    reason: opts?.reason ?? "master-edit",
    mutations: [
      {
        masterRootId,
        layerNodeId,
        stableId,
        changedKeys,
        structural: opts?.structural ?? false,
      },
    ],
  };
  return commitComponentUpdateTransaction(nodes, childOrder, tx);
}

export function applyComponentPropagationToStoreResult(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  refresh: Set<string>,
  layerNodeId: string,
  changedKeys: (keyof EditorNode)[],
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  if (findInstanceRoot(nodes, layerNodeId)) return { nodes, childOrder };

  const pendingTx = endComponentUpdateTransaction();
  if (pendingTx && pendingTx.mutations.length > 0) {
    const result = commitComponentUpdateTransaction(nodes, childOrder, pendingTx);
    for (const k of result.relayoutKeys) refresh.add(k);
    return { nodes: result.nodes, childOrder: result.childOrder };
  }

  const result = commitMasterLayerMutation(nodes, childOrder, layerNodeId, changedKeys);
  for (const k of result.relayoutKeys) refresh.add(k);
  return { nodes: result.nodes, childOrder: result.childOrder };
}

export function isMasterComponentEdit(
  nodes: Record<string, EditorNode>,
  nodeId: string,
): boolean {
  if (findInstanceRoot(nodes, nodeId)) return false;
  return findMasterRootForNode(nodes, nodeId) !== null;
}
