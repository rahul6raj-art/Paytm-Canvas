import type { EditorNode } from "@/stores/useEditorStore";
import type { InstanceOverridePatch } from "@/lib/componentModel";
import { readInstanceOverrideMap, writeInstanceOverrideState, applyPathOverridesToNode } from "@/lib/components/overrides";
import { masterNodeIdForStableId } from "@/lib/components/stableIds";

const SYNC_KEYS: (keyof EditorNode)[] = [
  "fill",
  "fillOpacity",
  "fillEnabled",
  "strokeColor",
  "strokeEnabled",
  "strokeWidth",
  "cornerRadius",
  "cornerRadii",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "content",
  "opacity",
  "effects",
  "layoutMode",
  "layoutGap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "visible",
  "strokeEnabled",
  "strokePosition",
  "strokeSides",
  "textColor",
  "blendMode",
  "name",
];

export function propagateMasterLayerToInstances(
  nodes: Record<string, EditorNode>,
  masterNodeId: string,
  changedKeys?: (keyof EditorNode)[],
): Record<string, EditorNode> {
  const masterNode = nodes[masterNodeId];
  if (!masterNode) return nodes;
  const masterRootId = findMasterRootForNode(nodes, masterNodeId);
  if (!masterRootId) return nodes;
  const masterRoot = nodes[masterRootId];
  if (!masterRoot?.isComponent) return nodes;

  const stableId = masterRoot.componentLayerStableIds?.[masterNodeId];
  if (!stableId) return nodes;

  const keys = changedKeys ?? SYNC_KEYS;
  let next = { ...nodes };

  for (const n of Object.values(next)) {
    if (!n.sourceComponentId || !n.componentId) continue;
    if (n.componentId !== masterRoot.componentId) continue;

    const instanceNodeId = Object.entries(n.instanceStableIdMap ?? {}).find(
      ([, sid]) => sid === stableId,
    )?.[0];
    if (!instanceNodeId || !next[instanceNodeId]) continue;

    const overrideMap = readInstanceOverrideMap(n);
    const overriddenPaths = new Set(Object.keys(overrideMap[stableId] ?? {}));
    const patch: Partial<EditorNode> = {};
    for (const key of keys) {
      if (overriddenPaths.has(String(key))) continue;
      const val = masterNode[key as keyof EditorNode];
      if (val !== undefined) (patch as Record<string, unknown>)[key as string] = val;
    }
    if (Object.keys(patch).length === 0) continue;

    next[instanceNodeId] = { ...next[instanceNodeId]!, ...patch };
  }

  return next;
}

export function findMasterRootForNode(
  nodes: Record<string, EditorNode>,
  nodeId: string,
): string | null {
  let cur: string | null = nodeId;
  while (cur) {
    const node: EditorNode | undefined = nodes[cur];
    if (!node) return null;
    if (node.isComponent) return cur;
    cur = node.parentId ?? null;
  }
  return null;
}

export function incrementComponentVersion(
  nodes: Record<string, EditorNode>,
  masterRootId: string,
): Record<string, EditorNode> {
  const master = nodes[masterRootId];
  if (!master?.isComponent) return nodes;
  return {
    ...nodes,
    [masterRootId]: {
      ...master,
      componentVersion: (master.componentVersion ?? 1) + 1,
    },
  };
}

export function pushInstanceOverridesToMaster(
  nodes: Record<string, EditorNode>,
  instanceRootId: string,
): { nodes: Record<string, EditorNode>; pushed: number } | null {
  const instanceRoot = nodes[instanceRootId];
  const masterId = instanceRoot?.sourceComponentId;
  if (!instanceRoot || !masterId) return null;
  const master = nodes[masterId];
  if (!master?.isComponent) return null;

  const overrideMap = readInstanceOverrideMap(instanceRoot);
  let next = { ...nodes };
  let pushed = 0;

  for (const [stableId, paths] of Object.entries(overrideMap)) {
    const masterNodeId = masterNodeIdForStableId(master, stableId);
    if (!masterNodeId || !next[masterNodeId]) continue;
    next[masterNodeId] = applyPathOverridesToNode(next[masterNodeId]!, paths);
    pushed += Object.keys(paths).length;
  }

  next = incrementComponentVersion(next, masterId);
  next[instanceRootId] = writeInstanceOverrideState(instanceRoot, {});
  return { nodes: next, pushed };
}

export function recordInstanceOverrideByStableId(
  instanceRoot: EditorNode,
  stableId: string,
  patch: InstanceOverridePatch,
): EditorNode {
  let overrideMap = readInstanceOverrideMap(instanceRoot);
  const layer = { ...(overrideMap[stableId] ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete layer[key];
    else layer[key] = value;
  }
  if (Object.keys(layer).length === 0) {
    const next = { ...overrideMap };
    delete next[stableId];
    overrideMap = next;
  } else {
    overrideMap = { ...overrideMap, [stableId]: layer };
  }
  return writeInstanceOverrideState(instanceRoot, overrideMap);
}

export function recordInstanceOverrideForNode(
  nodes: Record<string, EditorNode>,
  instanceRootId: string,
  targetNodeId: string,
  patch: InstanceOverridePatch,
): EditorNode | null {
  const root = nodes[instanceRootId];
  if (!root?.sourceComponentId) return null;
  const stableId = root.instanceStableIdMap?.[targetNodeId];
  if (!stableId) {
    const io: Record<string, Record<string, unknown>> = { ...(root.instanceOverrides ?? {}) };
    io[targetNodeId] = { ...(io[targetNodeId] as object), ...patch };
    return { ...root, instanceOverrides: io };
  }
  return recordInstanceOverrideByStableId(root, stableId, patch);
}
