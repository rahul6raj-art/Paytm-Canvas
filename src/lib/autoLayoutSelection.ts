/**
 * Figma-style “Add auto layout” (⇧A): wrap selection or enable on frame/group.
 */

import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import { nextNumberedLayerName } from "@/lib/layerNaming";
import { worldRect } from "@/lib/tree";
import {
  applyDeepAutoLayout,
  defaultHugSizingForContainer,
  inferAutoLayoutGap,
  inferAutoLayoutFlow,
  inferAutoLayoutPadding,
  sortIdsForAutoLayoutFlow,
  type LayoutFields,
  type LayoutMode,
  type LayoutNode,
} from "@/lib/autoLayout";
import type { EditorNode } from "@/stores/useEditorStore";

export const DEFAULT_AUTO_LAYOUT_FIELDS: Required<LayoutFields> = {
  layoutMode: "horizontal",
  layoutGap: 0,
  layoutGapAuto: false,
  layoutWrap: false,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  primaryAxisAlign: "start",
  counterAxisAlign: "start",
};

function parentListKey(parentId: string | null): string {
  return parentId ?? EDITOR_ROOT_KEY;
}

function isContainer(n: EditorNode): boolean {
  return n.type === "frame" || n.type === "group";
}

function isLayoutContainer(n: EditorNode | undefined): n is EditorNode {
  return !!n && isContainer(n) && (n.layoutMode ?? "none") === "none";
}

/** Visible, unlocked direct children — childOrder first, parentId fallback. */
function directChildIds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  containerId: string,
): string[] {
  const fromOrder = (childOrder[containerId] ?? []).filter((cid) => {
    const c = nodes[cid];
    return c && c.visible && !c.locked && c.parentId === containerId;
  });
  if (fromOrder.length > 0) return fromOrder;

  const orderIndex = new Map<string, number>();
  let idx = 0;
  for (const list of Object.values(childOrder)) {
    for (const id of list) {
      if (!orderIndex.has(id)) orderIndex.set(id, idx++);
    }
  }

  return Object.keys(nodes)
    .filter((cid) => {
      const c = nodes[cid];
      return c && c.parentId === containerId && c.visible && !c.locked;
    })
    .sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
}

function syncContainerChildOrder(
  childOrder: Record<string, string[]>,
  containerId: string,
  childIds: string[],
): void {
  if (childIds.length === 0) return;
  const existing = childOrder[containerId] ?? [];
  if (existing.length > 0) return;
  childOrder[containerId] = [...childIds];
}

export function canAddAutoLayoutToSelection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): boolean {
  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && n.visible && !n.locked;
  });
  if (tops.length === 0) return false;

  if (tops.length === 1 && isContainer(nodes[tops[0]!]!)) return true;

  const parentId = nodes[tops[0]!]!.parentId;
  if (!tops.every((id) => nodes[id]!.parentId === parentId)) return false;

  if (parentId && isLayoutContainer(nodes[parentId])) {
    return tops.every((id) => id !== parentId);
  }

  return true;
}

function layoutFieldsForChildren(
  nodes: Record<string, EditorNode>,
  childIds: string[],
  frameW: number,
  frameH: number,
): LayoutFields & Pick<EditorNode, "layoutSizingHorizontal" | "layoutSizingVertical"> {
  const mode = inferAutoLayoutFlow(nodes as Record<string, LayoutNode>, childIds);
  const gap = inferAutoLayoutGap(nodes as Record<string, LayoutNode>, childIds, mode);
  const padding = inferAutoLayoutPadding(
    nodes as Record<string, LayoutNode>,
    childIds,
    frameW,
    frameH,
  );
  return {
    ...DEFAULT_AUTO_LAYOUT_FIELDS,
    layoutMode: mode,
    layoutGap: gap,
    layoutGapAuto: childIds.length >= 2,
    ...padding,
    ...defaultHugSizingForContainer(mode),
  };
}

function sortChildOrderInPlace(
  childOrder: Record<string, string[]>,
  parentId: string,
  nodes: Record<string, EditorNode>,
  mode: Exclude<LayoutMode, "none">,
): void {
  const list = childOrder[parentId];
  if (!list?.length) return;
  const sorted = sortIdsForAutoLayoutFlow(
    list.filter((id) => {
      const c = nodes[id];
      return c && c.visible && !c.locked;
    }),
    nodes as Record<string, LayoutNode>,
    mode,
  );
  const lockedTail = list.filter((id) => {
    const c = nodes[id];
    return !c || !c.visible || c.locked;
  });
  childOrder[parentId] = [...sorted, ...lockedTail];
}

function enableAutoLayoutOnContainer(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  containerId: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  const n = nodes[containerId];
  if (!n || !isContainer(n)) return { nodes, childOrder };

  const nextOrder = { ...childOrder };
  const kids = directChildIds(nodes, nextOrder, containerId);
  syncContainerChildOrder(nextOrder, containerId, kids);

  const mode =
    (n.layoutMode ?? "none") !== "none"
      ? (n.layoutMode as Exclude<LayoutMode, "none">)
      : inferAutoLayoutFlow(nodes as Record<string, LayoutNode>, kids);

  if ((n.layoutMode ?? "none") === "none") {
    sortChildOrderInPlace(nextOrder, containerId, nodes, mode);
    const layout = layoutFieldsForChildren(nodes, kids, n.width, n.height);
    let next = {
      ...nodes,
      [containerId]: { ...n, ...layout },
    };
    next = applyDeepAutoLayout(
      next as Record<string, LayoutNode>,
      nextOrder,
      containerId,
    ) as Record<string, EditorNode>;
    return { nodes: next, childOrder: nextOrder };
  }

  sortChildOrderInPlace(nextOrder, containerId, nodes, mode);
  const next = applyDeepAutoLayout(
    nodes as Record<string, LayoutNode>,
    nextOrder,
    containerId,
  ) as Record<string, EditorNode>;
  return { nodes: next, childOrder: nextOrder };
}

function wrapInAutoLayoutFrame(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  topIds: string[],
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; frameId: string } | null {
  if (topIds.length === 0) return null;
  const parentId = nodes[topIds[0]!]!.parentId;
  if (!topIds.every((id) => nodes[id]!.parentId === parentId)) return null;

  const P = parentListKey(parentId);
  const pw = parentId ? worldRect(parentId, nodes) : { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of topIds) {
    const w = worldRect(id, nodes);
    minX = Math.min(minX, w.x);
    minY = Math.min(minY, w.y);
    maxX = Math.max(maxX, w.x + w.width);
    maxY = Math.max(maxY, w.y + w.height);
  }

  const fw = Math.max(1, maxX - minX);
  const fh = Math.max(1, maxY - minY);
  const fx = minX - pw.x;
  const fy = minY - pw.y;

  const fid = `frame-al-${Date.now()}`;
  const nextNodes = { ...nodes };
  const nextOrder = { ...childOrder };

  const kids = topIds.filter((id) => {
    const c = nextNodes[id];
    return c && c.visible && !c.locked;
  });

  for (const id of topIds) {
    const w = worldRect(id, nodes);
    const cn = nextNodes[id]!;
    nextNodes[id] = {
      ...cn,
      parentId: fid,
      x: w.x - minX,
      y: w.y - minY,
      layoutSizingHorizontal: cn.layoutSizingHorizontal ?? "fixed",
      layoutSizingVertical: cn.layoutSizingVertical ?? "fixed",
    };
  }

  const layout = layoutFieldsForChildren(nextNodes, kids, fw, fh);

  nextNodes[fid] = {
    id: fid,
    parentId,
    type: "frame",
    name: nextNumberedLayerName(nextNodes, "Frame"),
    x: fx,
    y: fy,
    width: fw,
    height: fh,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fillEnabled: false,
    fill: "#ffffff",
    clipChildren: true,
    ...layout,
  };

  const list = [...(nextOrder[P] ?? [])];
  const ixs = topIds.map((id) => list.indexOf(id)).sort((a, b) => a - b);
  const insertAt = ixs[0] ?? list.length;
  const newList = list.filter((id) => !topIds.includes(id));
  newList.splice(insertAt, 0, fid);
  nextOrder[P] = newList;
  nextOrder[fid] = sortIdsForAutoLayoutFlow(
    topIds,
    nextNodes as Record<string, LayoutNode>,
    layout.layoutMode as Exclude<LayoutMode, "none">,
  );

  const laidOut = applyDeepAutoLayout(
    nextNodes as Record<string, LayoutNode>,
    nextOrder,
    fid,
  ) as Record<string, EditorNode>;
  return { nodes: laidOut, childOrder: nextOrder, frameId: fid };
}

/** Figma ⌘⌥G — wrap selection in a frame without enabling auto layout. */
function wrapInPlainFrame(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  topIds: string[],
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; frameId: string } | null {
  if (topIds.length === 0) return null;
  const parentId = nodes[topIds[0]!]!.parentId;
  if (!topIds.every((id) => nodes[id]!.parentId === parentId)) return null;

  const P = parentListKey(parentId);
  const pw = parentId ? worldRect(parentId, nodes) : { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of topIds) {
    const w = worldRect(id, nodes);
    minX = Math.min(minX, w.x);
    minY = Math.min(minY, w.y);
    maxX = Math.max(maxX, w.x + w.width);
    maxY = Math.max(maxY, w.y + w.height);
  }

  const fw = Math.max(1, maxX - minX);
  const fh = Math.max(1, maxY - minY);
  const fx = minX - pw.x;
  const fy = minY - pw.y;
  const fid = `frame-wrap-${Date.now()}`;
  const nextNodes = { ...nodes };
  const nextOrder = { ...childOrder };

  for (const id of topIds) {
    const w = worldRect(id, nodes);
    const cn = nextNodes[id]!;
    nextNodes[id] = {
      ...cn,
      parentId: fid,
      x: w.x - minX,
      y: w.y - minY,
    };
  }

  nextNodes[fid] = {
    id: fid,
    parentId,
    type: "frame",
    name: topIds.length === 1 ? nextNodes[topIds[0]!]!.name || "Frame" : "Frame",
    x: fx,
    y: fy,
    width: fw,
    height: fh,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fillEnabled: false,
    fill: "#ffffff",
    clipChildren: true,
    layoutMode: "none",
  };

  const list = [...(nextOrder[P] ?? [])];
  const ixs = topIds.map((id) => list.indexOf(id)).sort((a, b) => a - b);
  const insertAt = ixs[0] ?? list.length;
  const newList = list.filter((id) => !topIds.includes(id));
  newList.splice(insertAt, 0, fid);
  nextOrder[P] = newList;
  nextOrder[fid] = [...topIds];

  return { nodes: nextNodes, childOrder: nextOrder, frameId: fid };
}

export function applyWrapSelectionInFrame(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  selectedIds: string[],
): ApplyAutoLayoutSelectionResult | null {
  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && n.visible && !n.locked;
  });
  if (tops.length < 1) return null;
  const wrapped = wrapInPlainFrame(nodes, childOrder, tops);
  if (!wrapped) return null;
  return {
    nodes: wrapped.nodes,
    childOrder: wrapped.childOrder,
    selectedIds: [wrapped.frameId],
  };
}

export type ApplyAutoLayoutSelectionResult = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  selectedIds: string[];
};

/** Enable auto layout on a specific frame/group (⇧A on a selected container). */
export function applyAutoLayoutToContainer(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  containerId: string,
): ApplyAutoLayoutSelectionResult | null {
  const n = nodes[containerId];
  if (!n || !isContainer(n)) return null;
  const result = enableAutoLayoutOnContainer(nodes, childOrder, containerId);
  return {
    nodes: result.nodes,
    childOrder: result.childOrder,
    selectedIds: [containerId],
  };
}

function sharedManualLayoutParentId(
  tops: string[],
  nodes: Record<string, EditorNode>,
): string | null {
  if (tops.length === 0) return null;
  const parentId = nodes[tops[0]!]!.parentId;
  if (!parentId || !tops.every((id) => nodes[id]!.parentId === parentId)) return null;
  if (tops.some((id) => id === parentId)) return null;
  return isLayoutContainer(nodes[parentId]) ? parentId : null;
}

export function applyAutoLayoutToSelection(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  selectedIds: string[],
): ApplyAutoLayoutSelectionResult | null {
  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && n.visible && !n.locked;
  });
  if (tops.length === 0) return null;

  const parentFrameId = sharedManualLayoutParentId(tops, nodes);
  if (parentFrameId) {
    return applyAutoLayoutToContainer(nodes, childOrder, parentFrameId);
  }

  const parentId = nodes[tops[0]!]!.parentId;
  if (!tops.every((id) => nodes[id]!.parentId === parentId)) return null;

  if (tops.length === 1) {
    const id = tops[0]!;
    const n = nodes[id]!;
    if (isContainer(n)) {
      return applyAutoLayoutToContainer(nodes, childOrder, id);
    }
    const wrapped = wrapInAutoLayoutFrame(nodes, childOrder, tops);
    if (!wrapped) return null;
    return {
      nodes: wrapped.nodes,
      childOrder: wrapped.childOrder,
      selectedIds: [wrapped.frameId],
    };
  }

  const wrapped = wrapInAutoLayoutFrame(nodes, childOrder, tops);
  if (!wrapped) return null;
  return {
    nodes: wrapped.nodes,
    childOrder: wrapped.childOrder,
    selectedIds: [wrapped.frameId],
  };
}
