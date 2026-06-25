import type { EditorNode } from "@/stores/useEditorStore";
import {
  cloneEditorSubtree,
  detachInstanceTree,
  findInstanceRoot,
  resolveMasterRootId,
  stripComponentFields,
} from "@/lib/componentModel";
import { collectSubtreeIds } from "@/lib/editorGraph";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  preserveOverridesOnSwap,
  resolveVariantMasterId,
} from "@/lib/components/resolveInstance";
import { pruneIncompatiblePropertyValues } from "@/lib/components/componentInstanceSwap";
import { pruneIncompatibleSlotOverrides, partitionSlotOverrides, slotPathExistsInMaster, writeSlotContentOverride } from "@/lib/components/componentSlots";
import {
  readInstanceOverrideMap,
  resetStableOverride,
  writeInstanceOverrideState,
} from "@/lib/components/overrides";
import {
  assignStableLayerIds,
  buildInstanceStableIdMap,
  buildNestedInstanceStableIdMap,
  remapStableIdMapThroughClone,
} from "@/lib/components/stableIds";
import { pushInstanceOverridesToMaster } from "@/lib/components/propagate";

function parentListKey(parentId: string | null): string {
  return parentId ?? EDITOR_ROOT_KEY;
}

/** After clone, nested instance roots need stable-id maps remapped with the full idMap. */
function repairNestedInstanceStableIdMaps(
  originalNodes: Record<string, EditorNode>,
  clonedNodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  idMap: Map<string, string>,
): Record<string, EditorNode> {
  let next = { ...clonedNodes };
  const reverse = new Map<string, string>();
  for (const [oldId, newId] of idMap) reverse.set(newId, oldId);

  for (const nodeId of collectSubtreeIds(instanceRootId, childOrder)) {
    const n = next[nodeId];
    if (!n?.sourceComponentId) continue;
    if (findInstanceRoot(next, nodeId) !== nodeId) continue;
    const oldRootId = reverse.get(nodeId);
    if (!oldRootId) continue;
    const oldRoot = originalNodes[oldRootId];
    let remapped = oldRoot?.instanceStableIdMap
      ? remapStableIdMapThroughClone(oldRoot.instanceStableIdMap, idMap)
      : {};
    if (Object.keys(remapped).length === 0 && n.sourceComponentId) {
      const nestedMasterId = resolveVariantMasterId(
        originalNodes,
        n.variantGroupId ?? "",
        n.selectedVariantProperties,
        n.sourceComponentId,
      );
      remapped = buildNestedInstanceStableIdMap(next, childOrder, nodeId, nestedMasterId);
    }
    if (Object.keys(remapped).length > 0) {
      next[nodeId] = { ...next[nodeId]!, instanceStableIdMap: remapped };
    }
  }
  return next;
}

export function buildInstanceFromMaster(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterId: string,
  parentId: string | null,
  localX: number,
  localY: number,
  selectedVariant?: Record<string, string>,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; newRootId: string } | null {
  const master = nodes[masterId];
  if (!master?.isComponent || !master.componentId) return null;

  const masterStableIds =
    master.componentLayerStableIds ?? assignStableLayerIds(nodes, childOrder, masterId);
  const parentKey = parentListKey(parentId);
  const idMap = new Map<string, string>();

  const res = cloneEditorSubtree(
    nodes,
    childOrder,
    masterId,
    parentId,
    parentKey,
    (root) => ({
      ...root,
      x: localX,
      y: localY,
      sourceComponentId: masterId,
      componentId: master.componentId,
      variantGroupId: master.variantGroupId,
      selectedVariantProperties: selectedVariant ?? master.variantProperties,
      componentVersionAtInsert: master.componentVersion ?? 1,
      instanceStableIdMap: {},
      instanceOverrides: {},
      instanceOverridesByStableId: {},
      isComponent: undefined,
    }),
    (_old, fresh) => {
      idMap.set(_old.id, fresh.id);
      let next = stripComponentFields(fresh);
      if (_old.sourceComponentId) {
        const nestedMaster = nodes[_old.sourceComponentId];
        next = {
          ...next,
          sourceComponentId: _old.sourceComponentId,
          componentId: _old.componentId,
          variantGroupId: _old.variantGroupId,
          selectedVariantProperties: _old.selectedVariantProperties,
          componentVersionAtInsert: nestedMaster?.componentVersion ?? 1,
          instanceStableIdMap: {},
          instanceOverrides: {},
          instanceOverridesByStableId: {},
        };
      }
      return next;
    },
  );
  if (!res) return null;

  res.nodes = repairNestedInstanceStableIdMaps(nodes, res.nodes, res.childOrder, res.newRootId, idMap);

  const stableMap = buildInstanceStableIdMap(masterStableIds, idMap);
  res.nodes[res.newRootId] = {
    ...res.nodes[res.newRootId]!,
    instanceStableIdMap: stableMap,
  };

  return res;
}

export function buildSwapInstanceComponentResult(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  newMasterKey: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; newRootId: string } | null {
  const instanceRoot = nodes[instanceRootId];
  if (!instanceRoot?.sourceComponentId) return null;
  const newMasterId = resolveMasterRootId(nodes, newMasterKey);
  if (!newMasterId) return null;
  const newMaster = nodes[newMasterId];
  if (!newMaster?.isComponent) return null;

  const oldOverrideMap = readInstanceOverrideMap(instanceRoot);
  const preserved = preserveOverridesOnSwap(instanceRoot, newMaster, instanceRoot.instanceStableIdMap ?? {});
  let mergedOverrides = preserved;
  const { slots } = partitionSlotOverrides(oldOverrideMap);
  for (const [path, snapshot] of slots) {
    if (slotPathExistsInMaster(nodes, newMasterId, path)) {
      mergedOverrides = writeSlotContentOverride(mergedOverrides, path, snapshot);
    }
  }
  const parentId = instanceRoot.parentId;
  const parentKey = parentListKey(parentId);
  const list = childOrder[parentKey] ?? [];
  const insertIdx = list.indexOf(instanceRootId);

  const built = buildInstanceFromMaster(
    nodes,
    childOrder,
    newMasterId,
    parentId,
    instanceRoot.x,
    instanceRoot.y,
    instanceRoot.selectedVariantProperties,
  );
  if (!built) return null;

  let nextNodes = { ...built.nodes };
  let nextOrder = { ...built.childOrder };

  const oldIds = collectSubtreeIds(instanceRootId, childOrder);
  for (const oid of oldIds) delete nextNodes[oid];

  const newList = (nextOrder[parentKey] ?? []).filter((id) => !oldIds.includes(id));
  if (insertIdx >= 0) newList.splice(insertIdx, 0, built.newRootId);
  else newList.push(built.newRootId);
  nextOrder = { ...nextOrder, [parentKey]: newList };

  nextNodes[built.newRootId] = writeInstanceOverrideState(nextNodes[built.newRootId]!, mergedOverrides);
  nextNodes[built.newRootId] = {
    ...nextNodes[built.newRootId]!,
    componentPropertyValues: instanceRoot.componentPropertyValues,
    selectedVariantProperties: instanceRoot.selectedVariantProperties,
  };

  return { nodes: nextNodes, childOrder: nextOrder, newRootId: built.newRootId };
}

export function buildResetInstanceOverridesResult(
  nodes: Record<string, EditorNode>,
  instanceRootId: string,
  stableId?: string,
  propertyPath?: string,
): Record<string, EditorNode> | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return null;
  const nextMap = resetStableOverride(readInstanceOverrideMap(root), stableId, propertyPath);
  return {
    ...nodes,
    [instanceRootId]: writeInstanceOverrideState(root, nextMap),
  };
}

export function buildSetInstanceVariantResult(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  variantProperties: Record<string, string>,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; newRootId: string } | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return null;
  const newMasterId = resolveVariantMasterId(
    nodes,
    root.variantGroupId ?? "",
    variantProperties,
    root.sourceComponentId,
  );
  const withVariant = {
    ...root,
    selectedVariantProperties: { ...variantProperties },
  };
  const nodesWithSelection = { ...nodes, [instanceRootId]: withVariant };
  if (newMasterId === root.sourceComponentId) {
    return { nodes: nodesWithSelection, childOrder, newRootId: instanceRootId };
  }
  const newMaster = nodes[newMasterId];
  const pruned = pruneIncompatiblePropertyValues(
    nodesWithSelection,
    newMasterId,
    root.componentPropertyValues,
    newMaster?.componentPropertyDefs ?? [],
  );
  const slotPruned = pruneIncompatibleSlotOverrides(
    nodesWithSelection,
    newMasterId,
    readInstanceOverrideMap(root),
    newMaster?.componentPropertyDefs ?? [],
  );
  const nodesWithPruned = {
    ...nodesWithSelection,
    [instanceRootId]: writeInstanceOverrideState(
      {
        ...withVariant,
        componentPropertyValues: pruned.values,
      },
      slotPruned.overrideMap,
    ),
  };
  return buildSwapInstanceComponentResult(nodesWithPruned, childOrder, instanceRootId, newMasterId);
}

export function buildGoToMainComponentSelection(
  nodes: Record<string, EditorNode>,
  instanceRootId: string,
): string | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return null;
  return resolveVariantMasterId(
    nodes,
    root.variantGroupId ?? "",
    root.selectedVariantProperties,
    root.sourceComponentId,
  );
}

export { detachInstanceTree, pushInstanceOverridesToMaster };
