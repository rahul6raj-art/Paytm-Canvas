import type { EditorNode } from "@/stores/useEditorStore";
import { childIdsForNode, collectSubtreeIds } from "@/lib/editorGraph";
import {
  findInstanceRoot,
  listComponentMasters,
  resolveMasterRootId,
} from "@/lib/componentModel";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { ComponentPropertyDef } from "@/lib/components/types";
import { buildInstanceFromMaster } from "@/lib/components/componentActions";
import {
  preserveOverridesOnSwap,
  resolveVariantMasterId,
} from "@/lib/components/resolveInstance";
import { instanceNodeIdForStableId } from "@/lib/components/stableIds";
import { writeInstanceOverrideState } from "@/lib/components/overrides";
import { componentFolderPath } from "@/lib/components/folders";

function parentListKey(parentId: string | null): string {
  return parentId ?? EDITOR_ROOT_KEY;
}

/** Effective slot path for an instance swap property. */
export function swapTargetPath(def: ComponentPropertyDef): string {
  return def.targetStablePath ?? def.targetStableLayerId;
}

export function effectiveSwapComponentId(
  def: ComponentPropertyDef,
  propertyValues: Record<string, string | boolean> | undefined,
): string | undefined {
  const val = propertyValues?.[def.key];
  if (typeof val === "string" && val.length > 0) return val;
  return def.defaultComponentId;
}

export function isInstanceSwapPropertyOverridden(
  def: ComponentPropertyDef,
  propertyValues: Record<string, string | boolean> | undefined,
): boolean {
  const val = propertyValues?.[def.key];
  if (val === undefined || val === "") return false;
  if (!def.defaultComponentId) return true;
  return String(val) !== def.defaultComponentId;
}

export function resolveMasterIdForComponentKey(
  nodes: Record<string, EditorNode>,
  componentKey: string,
): string | null {
  const byMaster = resolveMasterRootId(nodes, componentKey);
  if (byMaster) return byMaster;
  const master = listComponentMasters(nodes).find((m) => m.componentId === componentKey);
  return master?.id ?? null;
}

/** Walk a slash-separated slot path from a parent instance root to a nested instance root. */
export function findNestedInstanceBySlotPath(
  nodes: Record<string, EditorNode>,
  parentInstanceRoot: EditorNode,
  parentInstanceRootId: string,
  slotPath: string,
): string | null {
  const segments = slotPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  let currentRoot = parentInstanceRoot;
  let currentRootId = parentInstanceRootId;

  for (const slotStableId of segments) {
    const nestedNodeId = instanceNodeIdForStableId(currentRoot, slotStableId);
    if (!nestedNodeId) return null;
    const n = nodes[nestedNodeId];
    if (!n?.sourceComponentId || findInstanceRoot(nodes, nestedNodeId) !== nestedNodeId) return null;
    currentRootId = nestedNodeId;
    currentRoot = n;
  }

  return currentRootId === parentInstanceRootId ? null : currentRootId;
}

/** Compute slot path for a nested instance root inside a main component master. */
export function computeSwapTargetSlotPath(
  nodes: Record<string, EditorNode>,
  masterRootId: string,
  nestedInstanceRootId: string,
): string | null {
  const nested = nodes[nestedInstanceRootId];
  if (!nested?.sourceComponentId) return null;
  if (findInstanceRoot(nodes, nestedInstanceRootId) !== nestedInstanceRootId) return null;

  const segments: string[] = [];
  let cur = nestedInstanceRootId;

  while (cur !== masterRootId) {
    const node = nodes[cur];
    if (!node?.parentId) return null;
    const parentId = node.parentId;

    let scopeMasterId: string;
    if (parentId === masterRootId) {
      scopeMasterId = masterRootId;
    } else {
      const parentInstRoot = findInstanceRoot(nodes, parentId);
      if (parentInstRoot && parentInstRoot !== masterRootId) {
        const parentInst = nodes[parentInstRoot];
        if (!parentInst?.sourceComponentId) return null;
        scopeMasterId = resolveVariantMasterId(
          nodes,
          parentInst.variantGroupId ?? "",
          parentInst.selectedVariantProperties,
          parentInst.sourceComponentId,
        );
      } else {
        scopeMasterId = masterRootId;
      }
    }

    const scopeMaster = nodes[scopeMasterId];
    const stableId = scopeMaster?.componentLayerStableIds?.[cur];
    if (!stableId) return null;
    segments.unshift(stableId);

    if (parentId === masterRootId) break;
    const parentInstRoot = findInstanceRoot(nodes, parentId);
    cur = parentInstRoot ?? parentId;
  }

  return segments.join("/");
}

export function slotPathExistsInMaster(
  nodes: Record<string, EditorNode>,
  masterRootId: string,
  slotPath: string,
): boolean {
  return findMasterNestedInstanceBySlotPath(nodes, masterRootId, slotPath) !== null;
}

/** Nested instance node id inside a component master for a slash-separated slot path. */
export function findMasterNestedInstanceBySlotPath(
  nodes: Record<string, EditorNode>,
  masterRootId: string,
  slotPath: string,
): string | null {
  const segments = slotPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  let scopeMasterId = masterRootId;
  let nestedInstanceNodeId: string | null = null;

  for (const slotStableId of segments) {
    const scopeMaster = nodes[scopeMasterId];
    if (!scopeMaster?.componentLayerStableIds) return null;
    const masterNodeId = Object.entries(scopeMaster.componentLayerStableIds).find(
      ([, sid]) => sid === slotStableId,
    )?.[0];
    if (!masterNodeId) return null;
    const node = nodes[masterNodeId];
    if (!node?.sourceComponentId) return null;
    nestedInstanceNodeId = masterNodeId;
    scopeMasterId = resolveVariantMasterId(
      nodes,
      node.variantGroupId ?? "",
      node.selectedVariantProperties,
      node.sourceComponentId,
    );
  }

  return nestedInstanceNodeId;
}

function rebuildParentStableMapForNestedSubtree(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  parentMasterId: string,
  masterNestedRootId: string,
  instanceNestedRootId: string,
  parentMap: Record<string, string>,
): Record<string, string> {
  const masterStable = nodes[parentMasterId]?.componentLayerStableIds ?? {};
  const nextMap = { ...parentMap };

  const walk = (masterId: string, instanceId: string) => {
    const stableId = masterStable[masterId];
    if (stableId) nextMap[instanceId] = stableId;
    const masterKids = childIdsForNode(nodes, childOrder, masterId);
    const instanceKids = childIdsForNode(nodes, childOrder, instanceId);
    const len = Math.min(masterKids.length, instanceKids.length);
    for (let i = 0; i < len; i++) walk(masterKids[i]!, instanceKids[i]!);
  };

  walk(masterNestedRootId, instanceNestedRootId);
  return nextMap;
}

export function inferPreferredComponentIds(
  nodes: Record<string, EditorNode>,
  componentId: string,
): string[] {
  const master = listComponentMasters(nodes).find((m) => m.componentId === componentId);
  if (!master) return [componentId];

  const preferred = new Set<string>([componentId]);
  const folder = componentFolderPath(master.name).slice(0, -1).join("/") || componentFolderPath(master.name).join("/");

  if (master.variantGroupId) {
    for (const m of listComponentMasters(nodes)) {
      if (m.variantGroupId === master.variantGroupId && m.componentId) {
        preferred.add(m.componentId);
      }
    }
  }

  for (const m of listComponentMasters(nodes)) {
    const mFolder = componentFolderPath(m.name).slice(0, -1).join("/") || componentFolderPath(m.name).join("/");
    if (m.componentId && mFolder === folder) {
      preferred.add(m.componentId);
    }
  }

  return [...preferred];
}

export function buildInstanceSwapPropertyForNestedInstance(
  nodes: Record<string, EditorNode>,
  masterRootId: string,
  nestedInstanceRootId: string,
  label?: string,
): ComponentPropertyDef | null {
  const nested = nodes[nestedInstanceRootId];
  if (!nested?.sourceComponentId || !nested.componentId) return null;
  const slotPath = computeSwapTargetSlotPath(nodes, masterRootId, nestedInstanceRootId);
  if (!slotPath) return null;

  const slotStableId = slotPath.split("/").pop()!;
  const preferred = inferPreferredComponentIds(nodes, nested.componentId);
  const keyBase = label?.toLowerCase().replace(/\s+/g, "-") ?? "icon";

  return {
    id: `prop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    key: keyBase,
    label: label ?? "Icon",
    kind: "instanceSwap",
    targetStableLayerId: slotStableId,
    targetStablePath: slotPath,
    targetPath: "componentId",
    defaultComponentId: nested.componentId,
    preferredComponentIds: preferred,
    allowAnyComponent: true,
  };
}

export function listSwapCandidatesForProperty(
  nodes: Record<string, EditorNode>,
  def: ComponentPropertyDef,
): EditorNode[] {
  const all = listComponentMasters(nodes).filter((m) => m.type === "frame" || m.type === "group");
  if (def.allowAnyComponent !== false && (!def.preferredComponentIds || def.preferredComponentIds.length === 0)) {
    return all;
  }

  const preferredSet = new Set(def.preferredComponentIds ?? []);
  const preferred = all.filter((m) => m.componentId && preferredSet.has(m.componentId));
  if (def.allowAnyComponent) return [...preferred, ...all.filter((m) => !m.componentId || !preferredSet.has(m.componentId))];
  return preferred.length > 0 ? preferred : all;
}

export function pruneIncompatiblePropertyValues(
  nodes: Record<string, EditorNode>,
  masterRootId: string,
  propertyValues: Record<string, string | boolean> | undefined,
  defs: ComponentPropertyDef[],
): { values: Record<string, string | boolean>; dropped: string[] } {
  if (!propertyValues) return { values: {}, dropped: [] };
  const next = { ...propertyValues };
  const dropped: string[] = [];

  for (const def of defs) {
    if (def.kind !== "instanceSwap") continue;
    const path = swapTargetPath(def);
    if (!slotPathExistsInMaster(nodes, masterRootId, path)) {
      if (next[def.key] !== undefined) {
        delete next[def.key];
        dropped.push(def.key);
      }
    }
  }

  return { values: next, dropped };
}

export function buildSwapNestedInstanceAtSlotResult(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  parentInstanceRootId: string,
  slotPath: string,
  newComponentKey: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; nestedRootId: string } | null {
  const parentRoot = nodes[parentInstanceRootId];
  if (!parentRoot?.sourceComponentId) return null;

  const nestedRootId = findNestedInstanceBySlotPath(nodes, parentRoot, parentInstanceRootId, slotPath);
  if (!nestedRootId) return null;

  const nestedRoot = nodes[nestedRootId];
  if (!nestedRoot?.sourceComponentId) return null;

  const newMasterId = resolveMasterIdForComponentKey(nodes, newComponentKey);
  if (!newMasterId) return null;
  const newMaster = nodes[newMasterId];
  if (!newMaster?.isComponent || !newMaster.componentId) return null;

  if (nestedRoot.componentId === newMaster.componentId) {
    return { nodes, childOrder, nestedRootId };
  }

  const slotStableId = slotPath.split("/").pop()!;
  const preserved = preserveOverridesOnSwap(nestedRoot, newMaster, nestedRoot.instanceStableIdMap ?? {});
  const parentId = nestedRoot.parentId;
  const parentKey = parentListKey(parentId);
  const list = childOrder[parentKey] ?? [];
  const insertIdx = list.indexOf(nestedRootId);

  const built = buildInstanceFromMaster(
    nodes,
    childOrder,
    newMasterId,
    parentId,
    nestedRoot.x,
    nestedRoot.y,
    nestedRoot.selectedVariantProperties,
  );
  if (!built) return null;

  let nextNodes = { ...built.nodes };
  let nextOrder = { ...built.childOrder };

  const oldIds = collectSubtreeIds(nestedRootId, childOrder);
  for (const oid of oldIds) delete nextNodes[oid];
  for (const oid of oldIds) delete nextOrder[oid];

  const parentMasterId = resolveVariantMasterId(
    nodes,
    parentRoot.variantGroupId ?? "",
    parentRoot.selectedVariantProperties,
    parentRoot.sourceComponentId,
  );
  const masterNestedRootId = findMasterNestedInstanceBySlotPath(nodes, parentMasterId, slotPath);
  const parentInst = nextNodes[parentInstanceRootId]!;
  let nextMap = { ...(parentInst.instanceStableIdMap ?? {}) };
  for (const oid of oldIds) delete nextMap[oid];
  if (masterNestedRootId) {
    nextMap = rebuildParentStableMapForNestedSubtree(
      nextNodes,
      nextOrder,
      parentMasterId,
      masterNestedRootId,
      built.newRootId,
      nextMap,
    );
  } else {
    nextMap[built.newRootId] = slotStableId;
  }

  nextNodes[built.newRootId] = writeInstanceOverrideState(nextNodes[built.newRootId]!, preserved);
  nextNodes[parentInstanceRootId] = { ...parentInst, instanceStableIdMap: nextMap };

  const newList = (nextOrder[parentKey] ?? []).filter(
    (id) => !oldIds.includes(id) && id !== built.newRootId,
  );
  if (insertIdx >= 0) newList.splice(Math.min(insertIdx, newList.length), 0, built.newRootId);
  else newList.push(built.newRootId);
  nextOrder = { ...nextOrder, [parentKey]: newList };

  return { nodes: nextNodes, childOrder: nextOrder, nestedRootId: built.newRootId };
}

export type ApplyInstanceSwapPropertiesResult = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  appliedSwaps: string[];
  droppedPropertyValues: string[];
};

/** Apply instance swap property values by rebuilding nested instances at stable slot paths. */
export function applyInstanceSwapProperties(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
): ApplyInstanceSwapPropertiesResult {
  const instanceRoot = nodes[instanceRootId];
  if (!instanceRoot?.sourceComponentId) {
    return { nodes, childOrder, appliedSwaps: [], droppedPropertyValues: [] };
  }

  const masterId = resolveVariantMasterId(
    nodes,
    instanceRoot.variantGroupId ?? "",
    instanceRoot.selectedVariantProperties,
    instanceRoot.sourceComponentId,
  );
  const master = nodes[masterId];
  if (!master?.isComponent) {
    return { nodes, childOrder, appliedSwaps: [], droppedPropertyValues: [] };
  }

  const defs = (master.componentPropertyDefs ?? []).filter((d) => d?.kind === "instanceSwap");
  if (defs.length === 0) {
    return { nodes, childOrder, appliedSwaps: [], droppedPropertyValues: [] };
  }

  const pruned = pruneIncompatiblePropertyValues(
    nodes,
    masterId,
    instanceRoot.componentPropertyValues,
    defs,
  );

  let nextNodes =
    pruned.dropped.length > 0
      ? {
          ...nodes,
          [instanceRootId]: {
            ...nodes[instanceRootId]!,
            componentPropertyValues: pruned.values,
          },
        }
      : { ...nodes };
  let nextOrder = { ...childOrder };
  const appliedSwaps: string[] = [];

  for (const def of defs) {
    const path = swapTargetPath(def);
    const targetComponentId = effectiveSwapComponentId(def, pruned.values);
    if (!targetComponentId) continue;
    if (!slotPathExistsInMaster(nextNodes, masterId, path)) continue;

    const parentRoot = nextNodes[instanceRootId]!;
    const currentNestedId = findNestedInstanceBySlotPath(nextNodes, parentRoot, instanceRootId, path);
    if (!currentNestedId) continue;
    const currentNested = nextNodes[currentNestedId];
    if (currentNested?.componentId === targetComponentId) continue;

    const swapped = buildSwapNestedInstanceAtSlotResult(
      nextNodes,
      nextOrder,
      instanceRootId,
      path,
      targetComponentId,
    );
    if (!swapped) continue;
    nextNodes = swapped.nodes;
    nextOrder = swapped.childOrder;
    appliedSwaps.push(def.key);
  }

  return {
    nodes: nextNodes,
    childOrder: nextOrder,
    appliedSwaps,
    droppedPropertyValues: pruned.dropped,
  };
}

export function buildResetComponentPropertyValueResult(
  nodes: Record<string, EditorNode>,
  instanceRootId: string,
  propertyKey: string,
): Record<string, EditorNode> | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return null;
  const values = { ...(root.componentPropertyValues ?? {}) };
  delete values[propertyKey];
  return {
    ...nodes,
    [instanceRootId]: { ...root, componentPropertyValues: values },
  };
}

export function findNestedInstanceInMasterSubtree(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterRootId: string,
  nodeId: string,
): string | null {
  const instRoot = findInstanceRoot(nodes, nodeId);
  if (!instRoot || instRoot === masterRootId) return null;
  if (!nodes[instRoot]?.sourceComponentId) return null;
  if (findInstanceRoot(nodes, instRoot) !== instRoot) return null;
  if (!collectSubtreeIds(masterRootId, childOrder).includes(instRoot)) return null;
  return instRoot;
}

export function swapCandidateGroups(
  nodes: Record<string, EditorNode>,
  def: ComponentPropertyDef,
): { preferred: EditorNode[]; all: EditorNode[] } {
  const all = listComponentMasters(nodes).filter((m) => m.type === "frame" || m.type === "group");
  const preferredIds = new Set(def.preferredComponentIds ?? []);
  const preferred = all.filter((m) => m.componentId && preferredIds.has(m.componentId));
  const rest = all.filter((m) => !m.componentId || !preferredIds.has(m.componentId));
  return { preferred, all: def.allowAnyComponent !== false ? rest : [] };
}
