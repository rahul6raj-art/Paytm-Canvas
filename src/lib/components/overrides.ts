import type { EditorNode } from "@/stores/useEditorStore";
import type { InstanceOverridePatch } from "@/lib/componentModel";
import type { OverrideMap } from "@/lib/components/types";
import {
  instanceNodeIdForStableId,
  stableIdForInstanceNode,
} from "@/lib/components/stableIds";

export function readInstanceOverrideMap(instanceRoot: EditorNode): OverrideMap {
  if (instanceRoot.instanceOverridesByStableId) {
    return { ...instanceRoot.instanceOverridesByStableId };
  }
  return legacyOverridesToStableMap(instanceRoot);
}

function legacyOverridesToStableMap(instanceRoot: EditorNode): OverrideMap {
  const legacy = instanceRoot.instanceOverrides ?? {};
  const stableMap = instanceRoot.instanceStableIdMap ?? {};
  const nodeToStable = stableMap;
  const out: OverrideMap = {};
  for (const [nodeId, patch] of Object.entries(legacy)) {
    const stableId = nodeToStable[nodeId];
    if (!stableId || !patch || typeof patch !== "object") continue;
    out[stableId] = flattenPatchToPaths(patch as InstanceOverridePatch);
  }
  return out;
}

function flattenPatchToPaths(patch: InstanceOverridePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function stableOverridesToNodePatches(
  instanceRoot: EditorNode,
  overrideMap: OverrideMap,
): Record<string, InstanceOverridePatch> {
  const out: Record<string, InstanceOverridePatch> = {};
  for (const [stableId, paths] of Object.entries(overrideMap)) {
    const nodeId = instanceNodeIdForStableId(instanceRoot, stableId);
    if (!nodeId) continue;
    out[nodeId] = paths as InstanceOverridePatch;
  }
  return out;
}

export function setStableOverride(
  overrideMap: OverrideMap,
  stableId: string,
  propertyPath: string,
  value: unknown,
): OverrideMap {
  const next = { ...overrideMap };
  const layer = { ...(next[stableId] ?? {}) };
  if (value === undefined) {
    delete layer[propertyPath];
  } else {
    layer[propertyPath] = value;
  }
  if (Object.keys(layer).length === 0) delete next[stableId];
  else next[stableId] = layer;
  return next;
}

export function resetStableOverride(
  overrideMap: OverrideMap,
  stableId?: string,
  propertyPath?: string,
): OverrideMap {
  if (!stableId) return {};
  if (!propertyPath) {
    const next = { ...overrideMap };
    delete next[stableId];
    return next;
  }
  const layer = { ...(overrideMap[stableId] ?? {}) };
  delete layer[propertyPath];
  const next = { ...overrideMap };
  if (Object.keys(layer).length === 0) delete next[stableId];
  else next[stableId] = layer;
  return next;
}

export function applyStableOverridePatchToNode(
  base: EditorNode,
  stableId: string,
  overrideMap: OverrideMap,
): EditorNode {
  const paths = overrideMap[stableId];
  return applyPathOverridesToNode(base, paths);
}

export function applyPathOverridesToNode(
  base: EditorNode,
  paths: Record<string, unknown> | undefined,
): EditorNode {
  if (!paths) return base;
  let next = { ...base };
  for (const [path, value] of Object.entries(paths)) {
    if (path === "visible") {
      next = { ...next, visible: Boolean(value) };
    } else if (path in next || path === "content" || path === "fill") {
      next = { ...next, [path]: value } as EditorNode;
    }
  }
  return next;
}

export function writeInstanceOverrideState(
  instanceRoot: EditorNode,
  overrideMap: OverrideMap,
): EditorNode {
  const nodeOverrides = stableOverridesToNodePatches(instanceRoot, overrideMap);
  return {
    ...instanceRoot,
    instanceOverridesByStableId: overrideMap,
    instanceOverrides: nodeOverrides,
  };
}

export function countOverrides(overrideMap: OverrideMap): number {
  let n = 0;
  for (const paths of Object.values(overrideMap)) n += Object.keys(paths).length;
  return n;
}
