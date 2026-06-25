import type { EditorNode } from "@/stores/useEditorStore";

export function newStableLayerId(prefix = "layer"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Assign stable internal ids to every node in a component master subtree. */
export function assignStableLayerIds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  rootId: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  const walk = (id: string) => {
    const n = nodes[id];
    if (!n) return;
    map[id] = newStableLayerId(n.type);
    for (const cid of childOrder[id] ?? []) walk(cid);
  };
  walk(rootId);
  return map;
}

/** Build instance nodeId → stableLayerId map from clone id mapping + master stable ids. */
/** Remap instance stable-id bindings after a subtree clone (nested component instances). */
export function remapStableIdMapThroughClone(
  instanceStableIdMap: Record<string, string>,
  cloneIdMap: Map<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [oldNodeId, stableId] of Object.entries(instanceStableIdMap)) {
    const newNodeId = cloneIdMap.get(oldNodeId);
    if (newNodeId) out[newNodeId] = stableId;
  }
  return out;
}

export function buildNestedInstanceStableIdMap(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nestedInstanceRootId: string,
  nestedMasterRootId: string,
): Record<string, string> {
  const nestedMaster = nodes[nestedMasterRootId];
  const masterStableIds = nestedMaster?.componentLayerStableIds;
  if (!masterStableIds) return {};

  const out: Record<string, string> = {};

  const walkParallel = (masterId: string, instanceId: string) => {
    const stableId = masterStableIds[masterId];
    if (stableId) out[instanceId] = stableId;
    const masterKids = childOrder[masterId] ?? [];
    const instanceKids = childOrder[instanceId] ?? [];
    const len = Math.min(masterKids.length, instanceKids.length);
    for (let i = 0; i < len; i++) {
      walkParallel(masterKids[i]!, instanceKids[i]!);
    }
  };

  walkParallel(nestedMasterRootId, nestedInstanceRootId);
  return out;
}

export function buildInstanceStableIdMap(
  masterStableIds: Record<string, string>,
  cloneIdMap: Map<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [masterNodeId, stableId] of Object.entries(masterStableIds)) {
    const instanceNodeId = cloneIdMap.get(masterNodeId);
    if (instanceNodeId) out[instanceNodeId] = stableId;
  }
  return out;
}

export function stableIdForInstanceNode(
  instanceRoot: EditorNode,
  instanceNodeId: string,
): string | null {
  return instanceRoot.instanceStableIdMap?.[instanceNodeId] ?? null;
}

export function instanceNodeIdForStableId(
  instanceRoot: EditorNode,
  stableId: string,
): string | null {
  const map = instanceRoot.instanceStableIdMap;
  if (!map) return null;
  for (const [nodeId, sid] of Object.entries(map)) {
    if (sid === stableId) return nodeId;
  }
  return null;
}

export function masterNodeIdForStableId(
  master: EditorNode,
  stableId: string,
): string | null {
  const map = master.componentLayerStableIds;
  if (!map) return null;
  for (const [nodeId, sid] of Object.entries(map)) {
    if (sid === stableId) return nodeId;
  }
  return null;
}
