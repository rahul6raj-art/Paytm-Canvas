import type { EditorNode } from "@/stores/useEditorStore";
import { collectSubtreeIds } from "@/lib/editorGraph";
import type { ComponentDefinition, ComponentPropertyDef, OverrideMap } from "@/lib/components/types";
import { applyPathOverridesToNode, readInstanceOverrideMap } from "@/lib/components/overrides";
import { masterNodeIdForStableId } from "@/lib/components/stableIds";
import { listComponentMasters, resolveMasterRootId, findInstanceRoot } from "@/lib/componentModel";
import { resolveVariantMasterIdWithFallback as resolveVariantMasterId } from "@/lib/components/componentSet";
import { effectiveVariantValuesForInstance } from "@/lib/components/componentInteractions";
import {
  isDescendantOfNestedInstanceRoot,
  partitionOverrideMap,
  parentOverridesForNestedLayer,
} from "@/lib/components/stablePaths";

export { resolveVariantMasterId };

export function buildComponentDefinition(
  nodes: Record<string, EditorNode>,
  masterNodeId: string,
): ComponentDefinition | null {
  const master = nodes[masterNodeId];
  if (!master?.isComponent || !master.componentId) return null;
  return {
    id: master.componentId,
    name: master.name,
    description: master.componentDescription,
    masterNodeId,
    layerStableIds: { ...(master.componentLayerStableIds ?? {}) },
    exposedProperties: [...(master.componentPropertyDefs ?? [])],
    variantGroupId: master.variantGroupId,
    variantProperties: master.variantProperties ? { ...master.variantProperties } : undefined,
    version: master.componentVersion ?? 1,
    libraryId: master.libraryId,
    publishStatus: master.publishStatus ?? "local",
  };
}

/** Merge master subtree values with instance stable overrides for read/display. */
export function resolveInstanceSubtree(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
): {
  nodes: Record<string, EditorNode>;
  appliedOverrideCount: number;
  droppedOverrides: string[];
} {
  const instanceRoot = nodes[instanceRootId];
  if (!instanceRoot?.sourceComponentId) {
    return { nodes, appliedOverrideCount: 0, droppedOverrides: [] };
  }

  const masterId = resolveVariantMasterId(
    nodes,
    instanceRoot.variantGroupId ?? "",
    effectiveVariantValuesForInstance(instanceRoot),
    instanceRoot.sourceComponentId,
  );
  const master = nodes[masterId];
  if (!master) return { nodes, appliedOverrideCount: 0, droppedOverrides: [] };

  const overrideMap = readInstanceOverrideMap(instanceRoot);
  const { local: localOverrideMap } = partitionOverrideMap(overrideMap);
  const stableToInstance = instanceRoot.instanceStableIdMap ?? {};
  const masterStable = master.componentLayerStableIds ?? {};
  const dropped: string[] = [];
  let applied = 0;

  const nextNodes = { ...nodes };
  const instanceIds = collectSubtreeIds(instanceRootId, childOrder);

  for (const instanceNodeId of instanceIds) {
    const stableId = stableToInstance[instanceNodeId];
    if (!stableId) continue;

    if (isDescendantOfNestedInstanceRoot(nodes, childOrder, instanceRootId, instanceNodeId)) {
      const paths = localOverrideMap[stableId];
      if (paths) {
        nextNodes[instanceNodeId] = applyPathOverridesToNode(nextNodes[instanceNodeId]!, paths);
        applied += Object.keys(paths).length;
      }
      continue;
    }

    const masterNodeId = masterNodeIdForStableId(master, stableId);
    if (!masterNodeId) {
      dropped.push(stableId);
      continue;
    }
    const masterNode = nodes[masterNodeId];
    if (!masterNode) {
      dropped.push(stableId);
      continue;
    }
    const paths = localOverrideMap[stableId];
    const prevInstance = nextNodes[instanceNodeId];
    const isInstanceRoot = instanceNodeId === instanceRootId;
    const instanceParentId =
      prevInstance != null ? (prevInstance.parentId ?? null) : masterNode.parentId;
    const merged = applyPathOverridesToNode(
      {
        ...masterNode,
        id: instanceNodeId,
        parentId: instanceParentId,
        x: prevInstance?.x ?? masterNode.x,
        y: prevInstance?.y ?? masterNode.y,
        width: prevInstance?.width ?? masterNode.width,
        height: prevInstance?.height ?? masterNode.height,
        rotation: prevInstance?.rotation ?? masterNode.rotation,
      },
      paths,
    );
    if (paths) applied += Object.keys(paths).length;
    if (isInstanceRoot && prevInstance) {
      nextNodes[instanceNodeId] = {
        ...merged,
        isComponent: undefined,
        componentLayerStableIds: undefined,
        componentPropertyDefs: undefined,
        componentVersion: undefined,
        sourceComponentId: prevInstance.sourceComponentId,
        componentId: prevInstance.componentId,
        variantGroupId: prevInstance.variantGroupId,
        selectedVariantProperties: prevInstance.selectedVariantProperties,
        currentInteractiveVariantValues: prevInstance.currentInteractiveVariantValues,
        interactionState: prevInstance.interactionState,
        componentPropertyValues: prevInstance.componentPropertyValues,
        componentVersionAtInsert: prevInstance.componentVersionAtInsert,
        resolvedTreeCacheVersion: prevInstance.resolvedTreeCacheVersion,
        instanceStableIdMap: prevInstance.instanceStableIdMap,
        instanceOverrides: prevInstance.instanceOverrides,
        instanceOverridesByStableId: prevInstance.instanceOverridesByStableId,
        instanceDetached: prevInstance.instanceDetached,
        parentId: prevInstance.parentId ?? null,
        x: prevInstance.x,
        y: prevInstance.y,
        rotation: prevInstance.rotation,
      };
    } else if (prevInstance?.sourceComponentId && findInstanceRoot(nodes, instanceNodeId) === instanceNodeId) {
      const nestedSlotStableId = stableId;
      const nestedOverrideMap = readInstanceOverrideMap(prevInstance);
      const mergedNestedOverrides = { ...nestedOverrideMap };
      for (const [nestedNodeId, nestedLayerStableId] of Object.entries(
        prevInstance.instanceStableIdMap ?? {},
      )) {
        if (nestedNodeId === instanceNodeId) continue;
        const parentPaths = parentOverridesForNestedLayer(
          overrideMap,
          nestedSlotStableId,
          nestedLayerStableId,
        );
        if (!parentPaths) continue;
        mergedNestedOverrides[nestedLayerStableId] = {
          ...(mergedNestedOverrides[nestedLayerStableId] ?? {}),
          ...parentPaths,
        };
      }
      const slotMerged = applyPathOverridesToNode(
        {
          ...prevInstance,
          x: prevInstance.x,
          y: prevInstance.y,
          width: paths?.width !== undefined ? prevInstance.width : (masterNode.width ?? prevInstance.width),
          height: paths?.height !== undefined ? prevInstance.height : (masterNode.height ?? prevInstance.height),
          rotation: prevInstance.rotation ?? masterNode.rotation,
        },
        paths,
      );
      if (paths) applied += Object.keys(paths).length;
      nextNodes[instanceNodeId] = {
        ...slotMerged,
        isComponent: undefined,
        componentLayerStableIds: undefined,
        componentPropertyDefs: undefined,
        componentVersion: undefined,
        sourceComponentId: prevInstance.sourceComponentId,
        componentId: prevInstance.componentId,
        variantGroupId: prevInstance.variantGroupId,
        selectedVariantProperties: prevInstance.selectedVariantProperties,
        currentInteractiveVariantValues: prevInstance.currentInteractiveVariantValues,
        interactionState: prevInstance.interactionState,
        componentPropertyValues: prevInstance.componentPropertyValues,
        componentVersionAtInsert: prevInstance.componentVersionAtInsert,
        resolvedTreeCacheVersion: prevInstance.resolvedTreeCacheVersion,
        instanceStableIdMap: prevInstance.instanceStableIdMap,
        instanceOverrides: prevInstance.instanceOverrides,
        instanceOverridesByStableId: mergedNestedOverrides,
        instanceDetached: prevInstance.instanceDetached,
      };
      for (const [nestedNodeId, nestedLayerStableId] of Object.entries(
        prevInstance.instanceStableIdMap ?? {},
      )) {
        if (nestedNodeId === instanceNodeId) continue;
        const nestedPaths = mergedNestedOverrides[nestedLayerStableId];
        if (!nestedPaths) continue;
        const nestedNode = nextNodes[nestedNodeId];
        if (!nestedNode) continue;
        nextNodes[nestedNodeId] = applyPathOverridesToNode(nestedNode, nestedPaths);
        applied += Object.keys(nestedPaths).length;
      }
    } else {
      nextNodes[instanceNodeId] = merged;
    }
  }

  return { nodes: nextNodes, appliedOverrideCount: applied, droppedOverrides: dropped };
}

export function findMasterForInstance(
  nodes: Record<string, EditorNode>,
  instanceRoot: EditorNode,
): EditorNode | null {
  if (!instanceRoot.sourceComponentId) return null;
  const masterId = resolveVariantMasterId(
    nodes,
    instanceRoot.variantGroupId ?? "",
    effectiveVariantValuesForInstance(instanceRoot),
    instanceRoot.sourceComponentId,
  );
  return nodes[masterId] ?? null;
}

export function listCompatibleMastersForSwap(
  nodes: Record<string, EditorNode>,
  currentMasterId: string,
): EditorNode[] {
  const current = nodes[currentMasterId];
  if (!current) return [];
  return listComponentMasters(nodes).filter(
    (m) => m.id !== currentMasterId && m.type === current.type,
  );
}

export function preserveOverridesOnSwap(
  oldInstanceRoot: EditorNode,
  newMaster: EditorNode,
  newStableIdMap: Record<string, string>,
): OverrideMap {
  const oldMap = readInstanceOverrideMap(oldInstanceRoot);
  const newMasterStable = newMaster.componentLayerStableIds ?? {};
  const preservedStableIds = new Set(Object.values(newMasterStable));
  const out: OverrideMap = {};
  for (const [stableId, paths] of Object.entries(oldMap)) {
    if (preservedStableIds.has(stableId)) out[stableId] = { ...paths };
  }
  void newStableIdMap;
  return out;
}

export function applyComponentPropertyDefs(
  instanceRoot: EditorNode,
  propertyValues: Record<string, string | boolean>,
  defs: ComponentPropertyDef[],
): OverrideMap {
  let overrideMap = readInstanceOverrideMap(instanceRoot);
  for (const def of defs) {
    const val = propertyValues[def.key];
    if (val === undefined) continue;
    if (def.kind === "boolean") {
      overrideMap = {
        ...overrideMap,
        [def.targetStableLayerId]: {
          ...(overrideMap[def.targetStableLayerId] ?? {}),
          visible: Boolean(val),
        },
      };
    } else if (def.kind === "text") {
      overrideMap = {
        ...overrideMap,
        [def.targetStableLayerId]: {
          ...(overrideMap[def.targetStableLayerId] ?? {}),
          content: String(val),
        },
      };
    }
  }
  return overrideMap;
}

export function resolveMasterRootIdFromKey(
  nodes: Record<string, EditorNode>,
  key: string,
): string | null {
  return resolveMasterRootId(nodes, key);
}
