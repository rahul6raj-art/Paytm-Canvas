import type { EditorNode } from "@/stores/useEditorStore";
import type { ComponentDebugInfo } from "@/lib/components/types";
import { getLastComponentPropagationMeta } from "@/lib/components/componentPropagation";
import { readInstanceOverrideMap } from "@/lib/components/overrides";
import { masterNodeIdForStableId } from "@/lib/components/stableIds";
import { buildComponentDefinition, resolveInstanceSubtree } from "@/lib/components/resolveInstance";
import { isInstanceStale } from "@/lib/components/resolveComponentInstance";
import {
  collectNestedInstancePaths,
} from "@/lib/components/stablePaths";
import { collectSlotDebugInfo } from "@/lib/components/componentSlots";

export function buildComponentDebugInfo(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
): ComponentDebugInfo | null {
  const instanceRoot = nodes[instanceRootId];
  if (!instanceRoot?.sourceComponentId) return null;

  const definition = buildComponentDefinition(nodes, instanceRoot.sourceComponentId);
  const overrideMap = readInstanceOverrideMap(instanceRoot);
  const resolved = resolveInstanceSubtree(nodes, childOrder, instanceRootId);
  const master = nodes[instanceRoot.sourceComponentId];
  const masterVersion = master?.componentVersion ?? definition?.version ?? 1;
  const instanceVersion = instanceRoot.componentVersionAtInsert ?? 0;
  const stale = isInstanceStale(nodes, instanceRootId);
  const lastPropagationMeta = getLastComponentPropagationMeta();

  const matchedLayers: ComponentDebugInfo["matchedLayers"] = [];
  for (const [instanceNodeId, stableId] of Object.entries(instanceRoot.instanceStableIdMap ?? {})) {
    matchedLayers.push({
      stableId,
      instanceNodeId,
      masterNodeId: master ? (masterNodeIdForStableId(master, stableId) ?? "") : "",
      stablePath: stableId,
    });
  }

  const nestedInstances = collectNestedInstancePaths(nodes, childOrder, instanceRootId);
  const slots = collectSlotDebugInfo(nodes, childOrder, instanceRootId);

  return {
    instanceRootId,
    componentId: instanceRoot.componentId ?? "",
    masterNodeId: instanceRoot.sourceComponentId,
    selectedVariant: instanceRoot.selectedVariantProperties,
    componentPropertyValues: { ...(instanceRoot.componentPropertyValues ?? {}) },
    overrideMap,
    componentVersion: instanceVersion,
    detached: Boolean(instanceRoot.instanceDetached),
    exposedProperties: definition?.exposedProperties ?? [],
    matchedLayers,
    resolvedTreeSource: instanceRoot.instanceDetached ? "detached-clone" : "master+overrides",
    cacheStatus:
      resolved.droppedOverrides.length > 0 ? "dirty" : stale ? "miss" : "hit",
    appliedOverrideCount: resolved.appliedOverrideCount,
    droppedOverrides: resolved.droppedOverrides,
    masterVersion,
    instanceComponentVersion: instanceVersion,
    stale,
    lastPropagationReason: lastPropagationMeta?.reason,
    changedStableIds: lastPropagationMeta?.changedStableIds,
    layoutInvalidationReason: lastPropagationMeta
      ? `${lastPropagationMeta.relayoutKeys.size} layout roots`
      : undefined,
    nestedDependencyPath: lastPropagationMeta?.nestedDependencyPath,
    nestedInstances,
    slots,
  };
}
