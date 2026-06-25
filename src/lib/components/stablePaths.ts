import type { EditorNode } from "@/stores/useEditorStore";
import type { OverrideMap } from "@/lib/components/types";
import { collectSubtreeIds } from "@/lib/editorGraph";
import { findInstanceRoot } from "@/lib/componentModel";
import { stableIdForInstanceNode } from "@/lib/components/stableIds";

export const NESTED_STABLE_PATH_SEP = "/";
export const NESTED_SLOT_MARKER = "::";

/** `{parentStableId}/{nestedSlotStableId}::{nestedLayerStableId}` */
export function formatNestedStablePath(
  parentLayerStableId: string,
  nestedSlotStableId: string,
  nestedLayerStableId: string,
): string {
  return `${parentLayerStableId}${NESTED_STABLE_PATH_SEP}${nestedSlotStableId}${NESTED_SLOT_MARKER}${nestedLayerStableId}`;
}

export function parseNestedStablePath(path: string): {
  parentLayerStableId: string;
  nestedSlotStableId: string;
  nestedLayerStableId: string;
} | null {
  const slash = path.indexOf(NESTED_STABLE_PATH_SEP);
  const marker = path.indexOf(NESTED_SLOT_MARKER);
  if (slash <= 0 || marker <= slash) return null;
  const parentLayerStableId = path.slice(0, slash);
  const nestedSlotStableId = path.slice(slash + 1, marker);
  const nestedLayerStableId = path.slice(marker + NESTED_SLOT_MARKER.length);
  if (!parentLayerStableId || !nestedSlotStableId || !nestedLayerStableId) return null;
  return { parentLayerStableId, nestedSlotStableId, nestedLayerStableId };
}

export function isNestedStablePath(path: string): boolean {
  return parseNestedStablePath(path) !== null;
}

export function partitionOverrideMap(overrideMap: OverrideMap): {
  local: OverrideMap;
  nestedBySlot: Map<string, OverrideMap>;
} {
  const local: OverrideMap = {};
  const nestedBySlot = new Map<string, OverrideMap>();
  for (const [key, paths] of Object.entries(overrideMap)) {
    const parsed = parseNestedStablePath(key);
    if (!parsed) {
      local[key] = paths;
      continue;
    }
    const slotKey = parsed.nestedSlotStableId;
    const slotMap = nestedBySlot.get(slotKey) ?? {};
    slotMap[parsed.nestedLayerStableId] = {
      ...(slotMap[parsed.nestedLayerStableId] ?? {}),
      ...paths,
    };
    nestedBySlot.set(slotKey, slotMap);
  }
  return { local, nestedBySlot };
}

export function parentOverridesForNestedLayer(
  parentOverrideMap: OverrideMap,
  nestedSlotStableId: string,
  nestedLayerStableId: string,
): Record<string, unknown> | undefined {
  for (const [key, paths] of Object.entries(parentOverrideMap)) {
    const parsed = parseNestedStablePath(key);
    if (!parsed) continue;
    if (
      parsed.nestedSlotStableId === nestedSlotStableId &&
      parsed.nestedLayerStableId === nestedLayerStableId
    ) {
      return paths;
    }
  }
  return undefined;
}

export type NestedInstanceDebugPath = {
  stablePath: string;
  nestedInstanceRootId: string;
  nestedComponentId: string;
  nestedSlotStableId: string;
  nestedSelectedVariant?: Record<string, string>;
  nestedOverrides: OverrideMap;
  parentNestedOverrides: OverrideMap;
};

export function collectNestedInstancePaths(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  instanceRootId: string,
): NestedInstanceDebugPath[] {
  const instanceRoot = nodes[instanceRootId];
  if (!instanceRoot?.sourceComponentId) return [];

  const parentOverrideMap = instanceRoot.instanceOverridesByStableId ?? {};
  const { nestedBySlot } = partitionOverrideMap(parentOverrideMap);
  const out: NestedInstanceDebugPath[] = [];

  for (const nodeId of collectSubtreeIds(instanceRootId, childOrder)) {
    const n = nodes[nodeId];
    if (!n?.sourceComponentId || !n.componentId) continue;
    if (findInstanceRoot(nodes, nodeId) !== nodeId || nodeId === instanceRootId) continue;

    const nestedSlotStableId = stableIdForInstanceNode(instanceRoot, nodeId);
    if (!nestedSlotStableId) continue;

    const parentStablePrefix = nestedSlotStableId;
    out.push({
      stablePath: parentStablePrefix,
      nestedInstanceRootId: nodeId,
      nestedComponentId: n.componentId,
      nestedSlotStableId,
      nestedSelectedVariant: n.selectedVariantProperties,
      nestedOverrides: n.instanceOverridesByStableId ?? {},
      parentNestedOverrides: nestedBySlot.get(nestedSlotStableId) ?? {},
    });
  }

  return out;
}

/** Deepest instance root ancestor (closest nested instance to the hit node). */
export function findDeepestInstanceRoot(
  nodes: Record<string, EditorNode>,
  nodeId: string,
): string | null {
  const chain: string[] = [];
  let cur: string | null = nodeId;
  while (cur) {
    const n = nodes[cur];
    if (!n) break;
    if (n.sourceComponentId) chain.push(cur);
    cur = n.parentId ?? null;
  }
  return chain.length > 0 ? chain[0]! : null;
}

/** Outermost instance root (legacy selection behavior). */
export function findOutermostInstanceRoot(
  nodes: Record<string, EditorNode>,
  nodeId: string,
): string | null {
  return findInstanceRoot(nodes, nodeId);
}

/** Deepest instance root that participates in interactive variant preview. */
export function findDeepestInteractiveInstanceRoot(
  nodes: Record<string, EditorNode>,
  nodeId: string,
): string | null {
  let cur: string | null = nodeId;
  while (cur) {
    const n = nodes[cur];
    if (!n) break;
    if (n.sourceComponentId && n.variantGroupId) return cur;
    cur = n.parentId ?? null;
  }
  return null;
}

export function isDescendantOfNestedInstanceRoot(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  outerInstanceRootId: string,
  nodeId: string,
): boolean {
  if (nodeId === outerInstanceRootId) return false;
  let cur: string | null = nodes[nodeId]?.parentId ?? null;
  while (cur && cur !== outerInstanceRootId) {
    const n = nodes[cur];
    if (n?.sourceComponentId && findInstanceRoot(nodes, cur) === cur) return true;
    cur = n.parentId ?? null;
  }
  return false;
}

export function nestedInstanceRootsInSubtree(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  rootId: string,
): string[] {
  const out: string[] = [];
  for (const nodeId of collectSubtreeIds(rootId, childOrder)) {
    const n = nodes[nodeId];
    if (!n?.sourceComponentId) continue;
    if (findInstanceRoot(nodes, nodeId) === nodeId && nodeId !== rootId) out.push(nodeId);
  }
  return out;
}
