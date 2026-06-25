import type { EditorNode } from "@/stores/useEditorStore";
import { childIdsForNode, collectSubtreeIds } from "@/lib/editorGraph";
import { cloneEditorSubtree, findInstanceRoot, stripComponentFields } from "@/lib/componentModel";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { ComponentPropertyDef, OverrideMap, SlotContentSnapshot } from "@/lib/components/types";
import { SLOT_CONTENT_PATH, SLOT_OVERRIDE_PREFIX } from "@/lib/components/types";
import { resolveVariantMasterId } from "@/lib/components/resolveInstance";
import { instanceNodeIdForStableId } from "@/lib/components/stableIds";
import { buildNestedInstanceStableIdMap } from "@/lib/components/stableIds";
import { readInstanceOverrideMap, resetStableOverride, writeInstanceOverrideState } from "@/lib/components/overrides";
import { resolveComponentInstance } from "@/lib/components/resolveComponentInstance";
import { nestedInstanceRootsInSubtree } from "@/lib/components/stablePaths";

function parentListKey(parentId: string | null): string {
  return parentId ?? EDITOR_ROOT_KEY;
}

export function slotTargetPath(def: ComponentPropertyDef): string {
  return def.targetStablePath ?? def.targetStableLayerId;
}

export function slotOverrideKey(targetStablePath: string): string {
  return `${SLOT_OVERRIDE_PREFIX}${targetStablePath}`;
}

export function isSlotOverrideKey(key: string): boolean {
  return key.startsWith(SLOT_OVERRIDE_PREFIX);
}

export function partitionSlotOverrides(overrideMap: OverrideMap): {
  local: OverrideMap;
  slots: Map<string, SlotContentSnapshot>;
} {
  const local: OverrideMap = {};
  const slots = new Map<string, SlotContentSnapshot>();
  for (const [key, paths] of Object.entries(overrideMap)) {
    if (isSlotOverrideKey(key)) {
      const content = paths?.[SLOT_CONTENT_PATH];
      if (content && typeof content === "object") {
        slots.set(key.slice(SLOT_OVERRIDE_PREFIX.length), content as SlotContentSnapshot);
      }
      continue;
    }
    local[key] = paths;
  }
  return { local, slots };
}

export function readSlotContentOverride(
  overrideMap: OverrideMap,
  targetStablePath: string,
): SlotContentSnapshot | undefined {
  const paths = overrideMap[slotOverrideKey(targetStablePath)];
  const content = paths?.[SLOT_CONTENT_PATH];
  if (!content || typeof content !== "object") return undefined;
  return content as SlotContentSnapshot;
}

export function writeSlotContentOverride(
  overrideMap: OverrideMap,
  targetStablePath: string,
  snapshot: SlotContentSnapshot | undefined,
): OverrideMap {
  const key = slotOverrideKey(targetStablePath);
  if (!snapshot) return resetStableOverride(overrideMap, key, SLOT_CONTENT_PATH);
  return {
    ...overrideMap,
    [key]: { [SLOT_CONTENT_PATH]: snapshot },
  };
}

export function isSlotPropertyOverridden(
  def: ComponentPropertyDef,
  overrideMap: OverrideMap,
): boolean {
  return readSlotContentOverride(overrideMap, slotTargetPath(def)) !== undefined;
}

/** Compute stable path for a slot container inside a component master. */
export function computeSlotTargetPath(
  nodes: Record<string, EditorNode>,
  masterRootId: string,
  containerNodeId: string,
): string | null {
  const container = nodes[containerNodeId];
  if (!container) return null;
  if (container.type !== "frame" && container.type !== "group") return null;

  const segments: string[] = [];
  let cur = containerNodeId;

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

export function findMasterSlotContainer(
  nodes: Record<string, EditorNode>,
  masterRootId: string,
  slotPath: string,
): string | null {
  const segments = slotPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  let scopeMasterId = masterRootId;
  for (let i = 0; i < segments.length; i++) {
    const scopeMaster = nodes[scopeMasterId];
    if (!scopeMaster?.componentLayerStableIds) return null;
    const masterNodeId = Object.entries(scopeMaster.componentLayerStableIds).find(
      ([, sid]) => sid === segments[i],
    )?.[0];
    if (!masterNodeId) return null;
    if (i === segments.length - 1) return masterNodeId;
    const node = nodes[masterNodeId];
    if (!node?.sourceComponentId) return null;
    scopeMasterId = resolveVariantMasterId(
      nodes,
      node.variantGroupId ?? "",
      node.selectedVariantProperties,
      node.sourceComponentId,
    );
  }
  return null;
}

export function slotPathExistsInMaster(
  nodes: Record<string, EditorNode>,
  masterRootId: string,
  slotPath: string,
): boolean {
  return findMasterSlotContainer(nodes, masterRootId, slotPath) !== null;
}

export function findSlotContainerInInstance(
  nodes: Record<string, EditorNode>,
  instanceRoot: EditorNode,
  instanceRootId: string,
  slotPath: string,
): string | null {
  const segments = slotPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  let scopeRoot = instanceRoot;
  for (let i = 0; i < segments.length - 1; i++) {
    const nestedId = instanceNodeIdForStableId(scopeRoot, segments[i]!);
    if (!nestedId) return null;
    const n = nodes[nestedId];
    if (!n?.sourceComponentId) return null;
    scopeRoot = n;
  }

  const containerStableId = segments[segments.length - 1]!;
  return instanceNodeIdForStableId(scopeRoot, containerStableId);
}

export function serializeSlotContent(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  containerId: string,
): SlotContentSnapshot {
  const rootChildIds = childIdsForNode(nodes, childOrder, containerId);
  const collected = new Set<string>();
  const snapNodes: Record<string, EditorNode> = {};
  const snapOrder: Record<string, string[]> = {};

  for (const rootId of rootChildIds) {
    for (const id of collectSubtreeIds(rootId, childOrder)) {
      collected.add(id);
    }
  }

  for (const id of collected) {
    const n = nodes[id];
    if (!n) continue;
    if (n.sourceComponentId && n.componentId) {
      snapNodes[id] = {
        ...stripComponentFields(n),
        sourceComponentId: n.sourceComponentId,
        componentId: n.componentId,
        variantGroupId: n.variantGroupId,
        selectedVariantProperties: n.selectedVariantProperties,
        componentVersionAtInsert: n.componentVersionAtInsert,
      };
    } else {
      snapNodes[id] = stripComponentFields({ ...n, isComponent: undefined });
    }
  }

  for (const id of collected) {
    const kids = childIdsForNode(nodes, childOrder, id).filter((cid) => collected.has(cid));
    if (kids.length > 0) snapOrder[id] = kids;
  }

  return {
    version: 1,
    nodes: snapNodes,
    childOrder: snapOrder,
    rootChildIds: [...rootChildIds],
  };
}

function cloneSlotSnapshotIntoContainer(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  containerId: string,
  snapshot: SlotContentSnapshot,
  allNodes: Record<string, EditorNode>,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; newRootIds: string[] } {
  let nextNodes = { ...nodes };
  let nextOrder = { ...childOrder };
  const idMap = new Map<string, string>();
  const newRootIds: string[] = [];

  const cloneNode = (oldId: string, parentNewId: string): string => {
    const old = snapshot.nodes[oldId];
    if (!old) return "";
    const newId = `${old.type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    idMap.set(oldId, newId);
    let fresh: EditorNode = { ...old, id: newId, parentId: parentNewId };
    if (old.sourceComponentId && old.componentId) {
      const nestedMaster = allNodes[old.sourceComponentId];
      fresh = {
        ...fresh,
        sourceComponentId: old.sourceComponentId,
        componentId: old.componentId,
        variantGroupId: old.variantGroupId,
        selectedVariantProperties: old.selectedVariantProperties,
        componentVersionAtInsert: nestedMaster?.componentVersion ?? 1,
        instanceStableIdMap: {},
        instanceOverrides: {},
        instanceOverridesByStableId: {},
      };
    }
    nextNodes[newId] = fresh;
    const kids = snapshot.childOrder[oldId] ?? [];
    const nk: string[] = [];
    for (const k of kids) nk.push(cloneNode(k, newId));
    nextOrder[newId] = nk;
    return newId;
  };

  for (const rootId of snapshot.rootChildIds) {
    const newRootId = cloneNode(rootId, containerId);
    if (newRootId) newRootIds.push(newRootId);
  }

  nextOrder[containerId] = newRootIds;

  for (const newRootId of newRootIds) {
    const n = nextNodes[newRootId];
    if (!n?.sourceComponentId) continue;
    const nestedMasterId = resolveVariantMasterId(
      allNodes,
      n.variantGroupId ?? "",
      n.selectedVariantProperties,
      n.sourceComponentId,
    );
    const nestedMap = buildNestedInstanceStableIdMap(nextNodes, nextOrder, newRootId, nestedMasterId);
    if (Object.keys(nestedMap).length > 0) {
      nextNodes[newRootId] = { ...nextNodes[newRootId]!, instanceStableIdMap: nestedMap };
    }
  }

  return { nodes: nextNodes, childOrder: nextOrder, newRootIds };
}

export function snapshotContentSignature(snapshot: SlotContentSnapshot): string {
  const parts: string[] = [];
  for (const rootId of snapshot.rootChildIds) {
    for (const id of [rootId, ...(snapshot.childOrder[rootId] ?? [])]) {
      const n = snapshot.nodes[id];
      if (!n) continue;
      parts.push(`${n.type}:${n.content ?? ""}:${n.sourceComponentId ?? ""}:${n.componentId ?? ""}:${n.visible !== false}`);
    }
  }
  return parts.join("|");
}

function slotContainerMatchesSnapshot(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  containerId: string,
  snapshot: SlotContentSnapshot,
): boolean {
  const current = serializeSlotContent(nodes, childOrder, containerId);
  if (current.rootChildIds.length !== snapshot.rootChildIds.length) return false;
  return snapshotContentSignature(current) === snapshotContentSignature(snapshot);
}

function removeContainerChildren(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  containerId: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; removedIds: string[] } {
  const childIds = childIdsForNode(nodes, childOrder, containerId);
  const removed = new Set<string>();
  for (const cid of childIds) {
    for (const id of collectSubtreeIds(cid, childOrder)) removed.add(id);
  }

  let nextNodes = { ...nodes };
  let nextOrder = { ...childOrder };
  for (const id of removed) delete nextNodes[id];
  for (const id of removed) delete nextOrder[id];
  nextOrder[containerId] = [];

  const instRoot = nextNodes[instanceRootId];
  if (instRoot?.instanceStableIdMap) {
    const nextMap = { ...instRoot.instanceStableIdMap };
    for (const id of removed) delete nextMap[id];
    nextNodes[instanceRootId] = { ...instRoot, instanceStableIdMap: nextMap };
  }

  for (const [pk, list] of Object.entries(nextOrder)) {
    nextOrder[pk] = list.filter((id) => !removed.has(id));
  }

  return { nodes: nextNodes, childOrder: nextOrder, removedIds: [...removed] };
}

export function buildSlotPropertyForContainer(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterRootId: string,
  containerNodeId: string,
  label?: string,
): ComponentPropertyDef | null {
  const container = nodes[containerNodeId];
  if (!container || (container.type !== "frame" && container.type !== "group")) return null;
  const slotPath = computeSlotTargetPath(nodes, masterRootId, containerNodeId);
  if (!slotPath) return null;

  const slotStableId = slotPath.split("/").pop()!;
  const defaultContent = serializeSlotContent(nodes, childOrder, containerNodeId);
  const keyBase = label?.toLowerCase().replace(/\s+/g, "-") ?? "slot";

  return {
    id: `prop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    key: keyBase,
    label: label ?? "Slot",
    kind: "slot",
    targetStableLayerId: slotStableId,
    targetStablePath: slotPath,
    targetPath: "slot",
    defaultSlotContent: defaultContent,
    allowedSlotTypes: ["ANY"],
    allowEmpty: true,
  };
}

export function pruneIncompatibleSlotOverrides(
  nodes: Record<string, EditorNode>,
  masterRootId: string,
  overrideMap: OverrideMap,
  defs: ComponentPropertyDef[],
): { overrideMap: OverrideMap; dropped: string[] } {
  const slotDefs = defs.filter((d) => d?.kind === "slot");
  let next = { ...overrideMap };
  const dropped: string[] = [];
  const validPaths = new Set(slotDefs.map((d) => slotTargetPath(d)));

  for (const def of slotDefs) {
    const path = slotTargetPath(def);
    if (slotPathExistsInMaster(nodes, masterRootId, path)) continue;
    const key = slotOverrideKey(path);
    if (next[key]) {
      delete next[key];
      dropped.push(def.key);
    }
  }

  for (const key of Object.keys(next)) {
    if (!isSlotOverrideKey(key)) continue;
    const path = key.slice(SLOT_OVERRIDE_PREFIX.length);
    if (validPaths.has(path)) continue;
    if (!slotPathExistsInMaster(nodes, masterRootId, path)) {
      delete next[key];
      dropped.push(path);
    }
  }

  return { overrideMap: next, dropped };
}

export type ApplySlotPropertiesResult = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  appliedSlots: string[];
  droppedSlotOverrides: string[];
};

/** Replace slot container children with instance slot content overrides. */
export function applySlotProperties(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
): ApplySlotPropertiesResult {
  const instanceRoot = nodes[instanceRootId];
  if (!instanceRoot?.sourceComponentId) {
    return { nodes, childOrder, appliedSlots: [], droppedSlotOverrides: [] };
  }

  const masterId = resolveVariantMasterId(
    nodes,
    instanceRoot.variantGroupId ?? "",
    instanceRoot.selectedVariantProperties,
    instanceRoot.sourceComponentId,
  );
  const master = nodes[masterId];
  if (!master?.isComponent) {
    return { nodes, childOrder, appliedSlots: [], droppedSlotOverrides: [] };
  }

  const defs = (master.componentPropertyDefs ?? []).filter((d) => d?.kind === "slot");
  if (defs.length === 0) {
    return { nodes, childOrder, appliedSlots: [], droppedSlotOverrides: [] };
  }

  let overrideMap = readInstanceOverrideMap(instanceRoot);
  const pruned = pruneIncompatibleSlotOverrides(nodes, masterId, overrideMap, defs);
  overrideMap = pruned.overrideMap;

  let nextNodes =
    pruned.dropped.length > 0
      ? {
          ...nodes,
          [instanceRootId]: writeInstanceOverrideState(instanceRoot, overrideMap),
        }
      : { ...nodes };
  let nextOrder = { ...childOrder };
  const appliedSlots: string[] = [];

  for (const def of defs) {
    const path = slotTargetPath(def);
    const snapshot = readSlotContentOverride(overrideMap, path);
    if (!snapshot) continue;
    if (!slotPathExistsInMaster(nextNodes, masterId, path)) continue;

    const containerId = findSlotContainerInInstance(
      nextNodes,
      nextNodes[instanceRootId]!,
      instanceRootId,
      path,
    );
    if (!containerId) continue;

    if (slotContainerMatchesSnapshot(nextNodes, nextOrder, containerId, snapshot)) continue;

    const cleared = removeContainerChildren(nextNodes, nextOrder, instanceRootId, containerId);
    nextNodes = cleared.nodes;
    nextOrder = cleared.childOrder;

    if (snapshot.rootChildIds.length === 0) {
      appliedSlots.push(def.key);
      continue;
    }

    const inserted = cloneSlotSnapshotIntoContainer(
      nextNodes,
      nextOrder,
      containerId,
      snapshot,
      nodes,
    );
    nextNodes = inserted.nodes;
    nextOrder = inserted.childOrder;
    appliedSlots.push(def.key);
  }

  for (const nestedId of nestedInstanceRootsInSubtree(nextNodes, nextOrder, instanceRootId)) {
    const nested = resolveComponentInstance(nextNodes, nextOrder, nestedId, { force: true });
    nextNodes = nested.nodes;
    nextOrder = nested.childOrder;
  }

  return {
    nodes: nextNodes,
    childOrder: nextOrder,
    appliedSlots,
    droppedSlotOverrides: pruned.dropped,
  };
}

export function buildResetSlotContentResult(
  nodes: Record<string, EditorNode>,
  instanceRootId: string,
  propertyKey: string,
): Record<string, EditorNode> | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return null;
  const master = nodes[root.sourceComponentId];
  const def = master?.componentPropertyDefs?.find((d) => d.key === propertyKey && d.kind === "slot");
  if (!def) return null;

  const overrideMap = readInstanceOverrideMap(root);
  const nextMap = writeSlotContentOverride(overrideMap, slotTargetPath(def), undefined);
  return {
    ...nodes,
    [instanceRootId]: writeInstanceOverrideState(root, nextMap),
  };
}

export function buildSetSlotContentResult(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  propertyKey: string,
  snapshot: SlotContentSnapshot,
): Record<string, EditorNode> | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return null;
  const master = nodes[root.sourceComponentId];
  const def = master?.componentPropertyDefs?.find((d) => d.key === propertyKey && d.kind === "slot");
  if (!def) return null;

  const overrideMap = readInstanceOverrideMap(root);
  const nextMap = writeSlotContentOverride(overrideMap, slotTargetPath(def), snapshot);
  return {
    ...nodes,
    [instanceRootId]: writeInstanceOverrideState(root, nextMap),
  };
}

/** Capture live slot container content into an override snapshot. */
export function captureSlotContentFromInstance(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
  propertyKey: string,
): SlotContentSnapshot | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return null;
  const masterId = resolveVariantMasterId(
    nodes,
    root.variantGroupId ?? "",
    root.selectedVariantProperties,
    root.sourceComponentId,
  );
  const master = nodes[masterId];
  const def = master?.componentPropertyDefs?.find((d) => d.key === propertyKey && d.kind === "slot");
  if (!def) return null;

  const containerId = findSlotContainerInInstance(nodes, root, instanceRootId, slotTargetPath(def));
  if (!containerId) return null;
  return serializeSlotContent(nodes, childOrder, containerId);
}

export function collectSlotDebugInfo(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
): import("@/lib/components/types").SlotDebugInfo[] {
  const instanceRoot = nodes[instanceRootId];
  if (!instanceRoot?.sourceComponentId) return [];

  const masterId = resolveVariantMasterId(
    nodes,
    instanceRoot.variantGroupId ?? "",
    instanceRoot.selectedVariantProperties,
    instanceRoot.sourceComponentId,
  );
  const master = nodes[masterId];
  const defs = (master?.componentPropertyDefs ?? []).filter((d) => d?.kind === "slot");
  const overrideMap = readInstanceOverrideMap(instanceRoot);
  const out: import("@/lib/components/types").SlotDebugInfo[] = [];

  for (const def of defs) {
    const path = slotTargetPath(def);
    const pathExists = slotPathExistsInMaster(nodes, masterId, path);
    const overridden = isSlotPropertyOverridden(def, overrideMap);
    const containerId = pathExists
      ? findSlotContainerInInstance(nodes, instanceRoot, instanceRootId, path)
      : null;
    let resolvedNodeCount = 0;
    if (containerId) {
      resolvedNodeCount = childIdsForNode(nodes, childOrder, containerId).reduce(
        (sum, cid) => sum + collectSubtreeIds(cid, childOrder).length,
        0,
      );
    }
    out.push({
      propertyKey: def.key,
      label: def.label,
      targetStablePath: path,
      active: pathExists,
      overridden,
      resolvedNodeCount,
      dropped: !pathExists && overridden,
    });
  }

  return out;
}

/** Insert a text node into a slot container and return updated snapshot. */
export function buildSlotTextContentSnapshot(content: string, name = "Text"): SlotContentSnapshot {
  const textId = `slot-text-${Date.now()}`;
  return {
    version: 1,
    nodes: {
      [textId]: {
        id: textId,
        parentId: null,
        type: "text",
        name,
        content,
        x: 0,
        y: 0,
        width: 120,
        height: 24,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        fontSize: 14,
        fontFamily: "Inter",
      } as EditorNode,
    },
    childOrder: {},
    rootChildIds: [textId],
  };
}

/** Clone a component master into a slot content snapshot. */
export function buildSlotInstanceContentSnapshot(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterId: string,
): SlotContentSnapshot | null {
  const res = cloneEditorSubtree(
    nodes,
    childOrder,
    masterId,
    null,
    EDITOR_ROOT_KEY,
    (root) => ({
      ...root,
      sourceComponentId: masterId,
      componentId: nodes[masterId]?.componentId,
      variantGroupId: nodes[masterId]?.variantGroupId,
      selectedVariantProperties: nodes[masterId]?.variantProperties,
      componentVersionAtInsert: nodes[masterId]?.componentVersion ?? 1,
      instanceStableIdMap: {},
      instanceOverrides: {},
      instanceOverridesByStableId: {},
      isComponent: undefined,
    }),
    (_old, fresh) => stripComponentFields(fresh),
  );
  if (!res) return null;

  const collected = new Set(collectSubtreeIds(res.newRootId, res.childOrder));
  const snapNodes: Record<string, EditorNode> = {};
  const snapOrder: Record<string, string[]> = {};

  for (const id of collected) {
    const n = res.nodes[id];
    if (!n) continue;
    if (n.sourceComponentId && n.componentId) {
      snapNodes[id] = {
        ...stripComponentFields(n),
        sourceComponentId: n.sourceComponentId,
        componentId: n.componentId,
        variantGroupId: n.variantGroupId,
        selectedVariantProperties: n.selectedVariantProperties,
        componentVersionAtInsert: n.componentVersionAtInsert,
      };
    } else {
      snapNodes[id] = stripComponentFields(n);
    }
  }

  for (const id of collected) {
    const kids = childIdsForNode(res.nodes, res.childOrder, id).filter((cid) => collected.has(cid));
    if (kids.length > 0) snapOrder[id] = kids;
  }

  return {
    version: 1,
    nodes: snapNodes,
    childOrder: snapOrder,
    rootChildIds: [res.newRootId],
  };
}
