import type { EditorNode } from "@/stores/useEditorStore";
import { collectSubtreeIds } from "@/lib/editorGraph";
import { stripComponentFields } from "@/lib/componentModel";
import { cloneEditorSubtree } from "@/lib/componentModel";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { readInstanceOverrideMap } from "@/lib/components/overrides";
import { buildNestedInstanceStableIdMap, masterNodeIdForStableId } from "@/lib/components/stableIds";
import {
  resolveInstanceSubtree,
  resolveVariantMasterId,
} from "@/lib/components/resolveInstance";
import { effectiveVariantValuesForInstance } from "@/lib/components/componentInteractions";
import { nestedInstanceRootsInSubtree } from "@/lib/components/stablePaths";
import { applyInstanceSwapProperties } from "@/lib/components/componentInstanceSwap";
import { applySlotProperties } from "@/lib/components/componentSlots";

export type ResolveComponentInstanceResult = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  appliedOverrideCount: number;
  droppedOverrides: string[];
  relayoutKeys: string[];
  cacheStatus: "hit" | "miss" | "dirty";
  stale: boolean;
};

const INSTANCE_ROOT_GEOM_KEYS = new Set<keyof EditorNode>([
  "x",
  "y",
  "width",
  "height",
  "rotation",
]);

function parentListKey(parentId: string | null): string {
  return parentId ?? EDITOR_ROOT_KEY;
}

function syncChildOrderFromMaster(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  masterRootId: string,
  instanceStableIdMap: Record<string, string>,
  masterStableIds: Record<string, string>,
): Record<string, string[]> {
  const nextOrder = { ...childOrder };
  const masterToInstance = new Map<string, string>();
  for (const [instanceNodeId, stableId] of Object.entries(instanceStableIdMap)) {
    masterToInstance.set(stableId, instanceNodeId);
  }

  const syncRec = (masterId: string, instanceId: string) => {
    const masterKids = childOrder[masterId] ?? [];
    const masterStable = masterStableIds;
    const instanceKids: string[] = [];
    for (const mk of masterKids) {
      const sid = masterStable[mk];
      if (!sid) continue;
      const ik = masterToInstance.get(sid);
      if (ik) instanceKids.push(ik);
    }
    if (instanceKids.length > 0 || (childOrder[instanceId] ?? []).length > 0) {
      nextOrder[instanceId] = instanceKids;
    }
    for (let i = 0; i < masterKids.length; i++) {
      const mk = masterKids[i]!;
      const sid = masterStable[mk];
      if (!sid) continue;
      const ik = masterToInstance.get(sid);
      if (ik) syncRec(mk, ik);
    }
  };

  syncRec(masterRootId, instanceRootId);
  return nextOrder;
}

/** Add master layers missing from an instance (structural sync). */
function syncMissingLayersFromMaster(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  masterRootId: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; added: string[] } {
  const instanceRoot = nodes[instanceRootId];
  const master = nodes[masterRootId];
  if (!instanceRoot || !master) return { nodes, childOrder, added: [] };

  const masterStable = master.componentLayerStableIds ?? {};
  const instanceStable = instanceRoot.instanceStableIdMap ?? {};
  const knownStable = new Set(Object.values(instanceStable));
  const added: string[] = [];
  let nextNodes = { ...nodes };
  let nextOrder = { ...childOrder };

  const masterToInstance = new Map<string, string>();
  for (const [instanceNodeId, stableId] of Object.entries(instanceStable)) {
    masterToInstance.set(stableId, instanceNodeId);
  }

  for (const [masterNodeId, stableId] of Object.entries(masterStable)) {
    if (knownStable.has(stableId)) continue;
    const masterNode = nodes[masterNodeId];
    if (!masterNode) continue;

    const masterParentId = masterNode.parentId ?? masterRootId;
    const instanceParentId =
      masterParentId === masterRootId
        ? instanceRootId
        : masterToInstance.get(masterStable[masterParentId] ?? "") ?? instanceRootId;

    const res = cloneEditorSubtree(
      nextNodes,
      nextOrder,
      masterNodeId,
      instanceParentId,
      parentListKey(instanceParentId),
      (root) => {
        if (masterNode.sourceComponentId && masterNode.componentId) {
          const nestedMaster = nodes[masterNode.sourceComponentId];
          return {
            ...root,
            sourceComponentId: masterNode.sourceComponentId,
            componentId: masterNode.componentId,
            variantGroupId: masterNode.variantGroupId,
            selectedVariantProperties: masterNode.selectedVariantProperties,
            componentVersionAtInsert: nestedMaster?.componentVersion ?? 1,
            instanceStableIdMap: {},
            instanceOverrides: {},
            instanceOverridesByStableId: {},
            isComponent: undefined,
          };
        }
        return {
          ...root,
          sourceComponentId: undefined,
          componentId: undefined,
          instanceStableIdMap: undefined,
          instanceOverrides: undefined,
          instanceOverridesByStableId: undefined,
        };
      },
      (_old, fresh) => stripComponentFields(fresh),
    );
    if (!res) continue;

    nextNodes = res.nodes;
    nextOrder = res.childOrder;
    const newId = res.newRootId;
    if (masterNode.sourceComponentId && masterNode.componentId) {
      const nestedMasterId = resolveVariantMasterId(
        nodes,
        masterNode.variantGroupId ?? "",
        masterNode.selectedVariantProperties,
        masterNode.sourceComponentId,
      );
      const nestedMap = buildNestedInstanceStableIdMap(
        nextNodes,
        nextOrder,
        newId,
        nestedMasterId,
      );
      if (Object.keys(nestedMap).length > 0) {
        nextNodes[newId] = { ...nextNodes[newId]!, instanceStableIdMap: nestedMap };
      }
    }
    const root = nextNodes[instanceRootId]!;
    nextNodes[instanceRootId] = {
      ...root,
      instanceStableIdMap: {
        ...(root.instanceStableIdMap ?? {}),
        [newId]: stableId,
      },
    };
    masterToInstance.set(stableId, newId);
    added.push(stableId);
  }

  return { nodes: nextNodes, childOrder: nextOrder, added };
}

/** Remove instance layers whose stable id no longer exists on the master. */
function removeOrphanInstanceLayers(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  masterRootId: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; removed: string[] } {
  const instanceRoot = nodes[instanceRootId];
  const master = nodes[masterRootId];
  if (!instanceRoot || !master) return { nodes, childOrder, removed: [] };

  const masterStableIds = new Set(Object.values(master.componentLayerStableIds ?? {}));
  const instanceStable = { ...(instanceRoot.instanceStableIdMap ?? {}) };
  const removed: string[] = [];
  let nextNodes = { ...nodes };
  let nextOrder = { ...childOrder };
  const toRemove = new Set<string>();

  for (const [instanceNodeId, stableId] of Object.entries(instanceStable)) {
    if (instanceNodeId === instanceRootId) continue;
    if (masterStableIds.has(stableId)) continue;
    removed.push(stableId);
    delete instanceStable[instanceNodeId];
    for (const tid of collectSubtreeIds(instanceNodeId, nextOrder)) {
      toRemove.add(tid);
    }
  }

  for (const id of toRemove) delete nextNodes[id];
  for (const [pk, list] of Object.entries(nextOrder)) {
    nextOrder[pk] = list.filter((id) => !toRemove.has(id));
  }

  if (removed.length > 0) {
    nextNodes[instanceRootId] = {
      ...nextNodes[instanceRootId]!,
      instanceStableIdMap: instanceStable,
    };
  }

  return { nodes: nextNodes, childOrder: nextOrder, removed };
}

/**
 * Resolve a component instance from its master + variant + property values + stable overrides.
 * Preserves instance root transform and per-layer overrides.
 */
export function resolveComponentInstance(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  opts?: { force?: boolean; debug?: boolean },
): ResolveComponentInstanceResult {
  const instanceRoot = nodes[instanceRootId];
  if (!instanceRoot?.sourceComponentId || instanceRoot.instanceDetached) {
    return {
      nodes,
      childOrder,
      appliedOverrideCount: 0,
      droppedOverrides: [],
      relayoutKeys: [],
      cacheStatus: "hit",
      stale: false,
    };
  }

  const masterId = resolveVariantMasterId(
    nodes,
    instanceRoot.variantGroupId ?? "",
    effectiveVariantValuesForInstance(instanceRoot),
    instanceRoot.sourceComponentId,
  );
  const master = nodes[masterId];
  if (!master?.isComponent) {
    return {
      nodes,
      childOrder,
      appliedOverrideCount: 0,
      droppedOverrides: [],
      relayoutKeys: [],
      cacheStatus: "hit",
      stale: false,
    };
  }

  const masterVersion = master.componentVersion ?? 1;
  const instanceVersion = instanceRoot.componentVersionAtInsert ?? 0;
  const stale = instanceVersion < masterVersion;
  const force = opts?.force === true;

  if (!stale && !force && instanceRoot.resolvedTreeCacheVersion === masterVersion) {
    return {
      nodes,
      childOrder,
      appliedOverrideCount: 0,
      droppedOverrides: [],
      relayoutKeys: [],
      cacheStatus: "hit",
      stale: false,
    };
  }

  let nextNodes = { ...nodes };
  let nextOrder = { ...childOrder };
  let dropped: string[] = [];
  let applied = 0;

  const removed = removeOrphanInstanceLayers(nextNodes, nextOrder, instanceRootId, masterId);
  nextNodes = removed.nodes;
  nextOrder = removed.childOrder;
  dropped.push(...removed.removed);

  const added = syncMissingLayersFromMaster(nextNodes, nextOrder, instanceRootId, masterId);
  nextNodes = added.nodes;
  nextOrder = added.childOrder;

  const swapResult = applyInstanceSwapProperties(nextNodes, nextOrder, instanceRootId);
  nextNodes = swapResult.nodes;
  nextOrder = swapResult.childOrder;
  dropped.push(...swapResult.droppedPropertyValues);
  if (swapResult.appliedSwaps.length > 0) applied += swapResult.appliedSwaps.length;

  for (const nestedId of nestedInstanceRootsInSubtree(nextNodes, nextOrder, instanceRootId)) {
    const nested = resolveComponentInstance(nextNodes, nextOrder, nestedId, { force: true, debug: opts?.debug });
    nextNodes = nested.nodes;
    nextOrder = nested.childOrder;
    applied += nested.appliedOverrideCount;
    dropped.push(...nested.droppedOverrides);
  }

  const rootStableId = master.componentLayerStableIds?.[masterId];
  const rootOverride = rootStableId
    ? readInstanceOverrideMap(nextNodes[instanceRootId]!)[rootStableId]
    : undefined;
  const preserveGeom: Partial<EditorNode> = {};
  for (const key of INSTANCE_ROOT_GEOM_KEYS) {
    if (rootOverride && key in rootOverride) continue;
    if (key === "x" || key === "y" || key === "rotation") continue;
    const val = instanceRoot[key];
    if (val !== undefined) preserveGeom[key] = val as never;
  }

  const resolved = resolveInstanceSubtree(nextNodes, nextOrder, instanceRootId);
  nextNodes = resolved.nodes;
  applied += resolved.appliedOverrideCount;
  dropped.push(...resolved.droppedOverrides);

  const stableMap = nextNodes[instanceRootId]?.instanceStableIdMap ?? {};
  nextOrder = syncChildOrderFromMaster(
    nextNodes,
    nextOrder,
    instanceRootId,
    masterId,
    stableMap,
    master.componentLayerStableIds ?? {},
  );

  const rootOverrideMap = readInstanceOverrideMap(nextNodes[instanceRootId]!);
  const rootSid = master.componentLayerStableIds?.[masterId];
  const rootPaths = rootSid ? rootOverrideMap[rootSid] : undefined;
  const rootW = rootPaths?.width !== undefined ? instanceRoot.width : master.width;
  const rootH = rootPaths?.height !== undefined ? instanceRoot.height : master.height;

  nextNodes[instanceRootId] = {
    ...nextNodes[instanceRootId]!,
    ...preserveGeom,
    width: rootW,
    height: rootH,
    currentInteractiveVariantValues: instanceRoot.currentInteractiveVariantValues,
    interactionState: instanceRoot.interactionState,
    componentVersionAtInsert: masterVersion,
    resolvedTreeCacheVersion: masterVersion,
  };

  const slotResult = applySlotProperties(nextNodes, nextOrder, instanceRootId);
  nextNodes = slotResult.nodes;
  nextOrder = slotResult.childOrder;
  dropped.push(...slotResult.droppedSlotOverrides);
  if (slotResult.appliedSlots.length > 0) applied += slotResult.appliedSlots.length;

  const relayoutKeys = collectInstanceRelayoutKeys(nextNodes, nextOrder, instanceRootId);
  for (const nestedId of nestedInstanceRootsInSubtree(nextNodes, nextOrder, instanceRootId)) {
    nextNodes[nestedId] = { ...nextNodes[nestedId]!, layoutDirty: true };
    for (const k of collectInstanceRelayoutKeys(nextNodes, nextOrder, nestedId)) {
      relayoutKeys.push(k);
    }
  }

  if (opts?.debug && dropped.length > 0) {
    console.debug("[component] dropped overrides during resolve", instanceRootId, dropped);
  }

  return {
    nodes: nextNodes,
    childOrder: nextOrder,
    appliedOverrideCount: applied,
    droppedOverrides: [...new Set(dropped)],
    relayoutKeys,
    cacheStatus: dropped.length > 0 ? "dirty" : stale ? "miss" : "hit",
    stale,
  };
}

export function collectInstanceRelayoutKeys(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
): string[] {
  const keys = new Set<string>();
  keys.add(instanceRootId);
  const parentId = nodes[instanceRootId]?.parentId;
  if (parentId) keys.add(parentId);

  for (const nodeId of collectSubtreeIds(instanceRootId, childOrder)) {
    const n = nodes[nodeId];
    if (!n?.visible) continue;
    if ((n.layoutMode ?? "none") !== "none") keys.add(nodeId);
    if (n.type === "text" && n.parentId) keys.add(n.parentId);
  }

  let cur = nodes[instanceRootId]?.parentId ?? null;
  while (cur) {
    const n = nodes[cur];
    if (n?.sourceComponentId) keys.add(cur);
    cur = n.parentId ?? null;
  }

  return [...keys];
}

export function isInstanceStale(
  nodes: Record<string, EditorNode>,
  instanceRootId: string,
): boolean {
  const instanceRoot = nodes[instanceRootId];
  if (!instanceRoot?.sourceComponentId) return false;
  const master = nodes[instanceRoot.sourceComponentId];
  if (!master) return true;
  return (instanceRoot.componentVersionAtInsert ?? 0) < (master.componentVersion ?? 1);
}
