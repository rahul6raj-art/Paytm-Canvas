import type { EditorNode } from "@/stores/useEditorStore";
import {
  findInstanceRoot,
  groupComponentMasters,
  listComponentMasters,
  markNodeAsComponent,
  newVariantGroupId,
  wrapNodeInFrameForComponent,
  type ComponentLibraryGroup,
} from "@/lib/componentModel";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import { readInstanceOverrideMap } from "@/lib/components/overrides";
import { stableIdForInstanceNode } from "@/lib/components/stableIds";
import { componentDisplayName } from "@/lib/components/folders";
import {
  combineMastersAsVariantSet,
  findComponentSetContainer,
  isComponentSetContainerNode,
  isVariantMasterInComponentSet,
} from "@/lib/components/componentSet";
import { frameParentAtWorldPoint } from "@/lib/tree";

const RECENT_COMPONENTS_KEY = "craft-recent-components-v1";
const RECENT_MAX = 8;
const VARIANT_GAP = 24;

/** Place a new variant master to the right of the set (Figma-style, no overlap). */
export function nextVariantMasterPosition(
  nodes: Record<string, EditorNode>,
  variantGroupId: string,
  sourceMaster: EditorNode,
): { x: number; y: number } {
  const siblings = Object.values(nodes).filter(
    (n) =>
      n.isComponent &&
      n.variantGroupId === variantGroupId &&
      n.parentId === sourceMaster.parentId &&
      (n.type === "frame" || n.type === "group"),
  );
  if (siblings.length === 0) {
    return { x: sourceMaster.x + sourceMaster.width + VARIANT_GAP, y: sourceMaster.y };
  }
  let maxRight = -Infinity;
  let anchorY = sourceMaster.y;
  for (const s of siblings) {
    maxRight = Math.max(maxRight, s.x + s.width);
    anchorY = Math.min(anchorY, s.y);
  }
  return { x: maxRight + VARIANT_GAP, y: anchorY };
}

export function canCombineAsVariants(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): boolean {
  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && !n.locked && n.visible;
  });
  if (tops.length < 2) return false;
  if (tops.some((id) => findInstanceRoot(nodes, id))) return false;
  return tops.every((id) => {
    const n = nodes[id];
    return n?.isComponent && (n.type === "frame" || n.type === "group");
  });
}

/** Figma: select 2+ frames/groups → Create component set (works on raw frames or existing components). */
export function canCreateComponentSetFromSelection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): boolean {
  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && !n.locked && n.visible;
  });
  if (tops.length < 2) return false;
  if (tops.some((id) => findInstanceRoot(nodes, id))) return false;
  return tops.every((id) => {
    const n = nodes[id];
    return n && (n.type === "frame" || n.type === "group");
  });
}

/** Turn each selected frame/group into a component master, then merge into one variant set. */
export function buildCreateComponentSetFromSelectionResult(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  selectedIds: string[],
): {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  masterIds: string[];
  setContainerId: string;
} | null {
  if (!canCreateComponentSetFromSelection(selectedIds, nodes)) return null;

  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && !n.locked && n.visible;
  });

  let nextNodes = { ...nodes };
  let nextOrder = { ...childOrder };
  const masterIds: string[] = [];

  for (const id of tops) {
    let rootId = id;
    if (!nextNodes[rootId]?.isComponent) {
      const wrapped = wrapNodeInFrameForComponent(nextNodes, nextOrder, rootId);
      if (!wrapped) return null;
      nextNodes = wrapped.nodes;
      nextOrder = wrapped.childOrder;
      rootId = wrapped.frameId;
      nextNodes = markNodeAsComponent(nextNodes, nextOrder, rootId);
    }
    masterIds.push(rootId);
  }

  const combined = combineComponentsAsVariants(nextNodes, nextOrder, masterIds);
  if (!combined) return null;
  return { ...combined, masterIds };
}

/** Combine 2+ component masters into one variant set (Figma: Combine as variants). */
export function combineComponentsAsVariants(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  masterIds: string[],
): {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  setContainerId: string;
} | null {
  return combineMastersAsVariantSet(nodes, childOrder, masterIds);
}

export function variantAxesForGroup(group: ComponentLibraryGroup): string[] {
  const axes = new Set<string>();
  for (const v of group.variants) {
    for (const key of Object.keys(v.variantProperties ?? {})) axes.add(key);
  }
  return [...axes];
}

export function variantValuesForAxis(group: ComponentLibraryGroup, axis: string): string[] {
  const values = new Set<string>();
  for (const v of group.variants) {
    const val = v.variantProperties?.[axis];
    if (val != null) values.add(val);
  }
  return [...values];
}

export function findVariantGroupForMaster(
  nodes: Record<string, EditorNode>,
  masterId: string,
): ComponentLibraryGroup | null {
  const master = nodes[masterId];
  if (!master?.isComponent) return null;
  const groups = groupComponentMasters(listComponentMasters(nodes), nodes);
  if (master.variantGroupId) {
    return groups.find((g) => g.id === master.variantGroupId) ?? null;
  }
  return groups.find((g) => g.variants.some((v) => v.id === masterId)) ?? null;
}

export function instanceRootForNode(
  nodes: Record<string, EditorNode>,
  nodeId: string,
): EditorNode | null {
  const rootId = findInstanceRoot(nodes, nodeId);
  if (!rootId) return null;
  return nodes[rootId] ?? null;
}

export function hasStableOverride(
  instanceRoot: EditorNode,
  stableId: string,
  propertyPath: string,
): boolean {
  const map = readInstanceOverrideMap(instanceRoot);
  return propertyPath in (map[stableId] ?? {});
}

export function hasNodeOverride(
  nodes: Record<string, EditorNode>,
  nodeId: string,
  propertyPath: string,
): boolean {
  const root = instanceRootForNode(nodes, nodeId);
  if (!root) return false;
  const stableId = stableIdForInstanceNode(root, nodeId);
  if (!stableId) return false;
  return hasStableOverride(root, stableId, propertyPath);
}

export function readRecentComponentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_COMPONENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordRecentComponent(masterId: string): void {
  try {
    const prev = readRecentComponentIds().filter((id) => id !== masterId);
    const next = [masterId, ...prev].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_COMPONENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function resolveRecentMasters(
  nodes: Record<string, EditorNode>,
  recentIds: string[],
): EditorNode[] {
  const masters = new Set(listComponentMasters(nodes).map((m) => m.id));
  return recentIds.filter((id) => masters.has(id)).map((id) => nodes[id]!);
}

/** Add a variant property axis to every master in a component set. */
export function addVariantAxisToGroup(
  nodes: Record<string, EditorNode>,
  variantGroupId: string,
  axis: string,
  defaultValue: string,
): Record<string, EditorNode> {
  let next = { ...nodes };
  for (const n of Object.values(nodes)) {
    if (!n?.isComponent || n.variantGroupId !== variantGroupId) continue;
    if (n.variantProperties?.[axis] != null) continue;
    next[n.id] = {
      ...n,
      variantProperties: { ...(n.variantProperties ?? {}), [axis]: defaultValue },
    };
  }
  return next;
}

/** Frame parent for placing a library instance — never inside a component set or variant master. */
export function instancePlacementParentAtWorldPoint(
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string | null {
  let pid = frameParentAtWorldPoint(worldX, worldY, nodes, childOrder);
  while (pid) {
    const n = nodes[pid];
    if (!n) return null;
    if (isComponentSetContainerNode(n) || isVariantMasterInComponentSet(nodes, pid)) {
      pid = n.parentId ?? null;
      continue;
    }
    break;
  }
  return pid;
}
