/**
 * Figma-style “Add auto layout” (⇧A): wrap any selection in an auto-layout frame,
 * or enable auto layout on an existing frame/group.
 *
 * @see https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout
 */

import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import { worldRect } from "@/lib/tree";
import {
  applyDeepAutoLayout,
  type LayoutFields,
  type LayoutMode,
  type LayoutNode,
} from "@/lib/autoLayout";
import type { EditorNode } from "@/stores/useEditorStore";

export const DEFAULT_AUTO_LAYOUT_FIELDS: Required<LayoutFields> = {
  layoutMode: "horizontal",
  layoutGap: 8,
  paddingTop: 12,
  paddingRight: 12,
  paddingBottom: 12,
  paddingLeft: 12,
  primaryAxisAlign: "start",
  counterAxisAlign: "start",
};

function parentListKey(parentId: string | null): string {
  return parentId ?? EDITOR_ROOT_KEY;
}

function isContainer(n: EditorNode): boolean {
  return n.type === "frame" || n.type === "group";
}

/** Whether ⇧A can run on the current selection (design mode). */
export function canAddAutoLayoutToSelection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): boolean {
  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && n.visible && !n.locked;
  });
  if (tops.length === 0) return false;
  const parentId = nodes[tops[0]!]!.parentId;
  return tops.every((id) => nodes[id]!.parentId === parentId);
}

/** Guess horizontal vs vertical flow from child arrangement (Figma infers direction). */
export function inferAutoLayoutFlow(
  nodes: Record<string, LayoutNode>,
  childIds: string[],
): LayoutMode {
  if (childIds.length < 2) return "horizontal";

  let minCx = Infinity;
  let maxCx = -Infinity;
  let minCy = Infinity;
  let maxCy = -Infinity;

  for (const id of childIds) {
    const n = nodes[id];
    if (!n) continue;
    const cx = n.x + n.width / 2;
    const cy = n.y + n.height / 2;
    minCx = Math.min(minCx, cx);
    maxCx = Math.max(maxCx, cx);
    minCy = Math.min(minCy, cy);
    maxCy = Math.max(maxCy, cy);
  }

  const spreadX = maxCx - minCx;
  const spreadY = maxCy - minCy;
  return spreadX >= spreadY ? "horizontal" : "vertical";
}

function layoutFieldsForChildren(
  nodes: Record<string, EditorNode>,
  childIds: string[],
): LayoutFields {
  const mode = inferAutoLayoutFlow(nodes, childIds);
  return { ...DEFAULT_AUTO_LAYOUT_FIELDS, layoutMode: mode };
}

function enableAutoLayoutOnContainer(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  containerId: string,
): Record<string, EditorNode> {
  const n = nodes[containerId];
  if (!n || !isContainer(n)) return nodes;
  if ((n.layoutMode ?? "none") !== "none") {
    return applyDeepAutoLayout(nodes as Record<string, LayoutNode>, childOrder, containerId) as Record<
      string,
      EditorNode
    >;
  }

  const kids = (childOrder[containerId] ?? []).filter((cid) => {
    const c = nodes[cid];
    return c && c.visible && !c.locked;
  });
  const layout = layoutFieldsForChildren(nodes, kids);
  let next = {
    ...nodes,
    [containerId]: { ...n, ...layout },
  };
  return applyDeepAutoLayout(next as Record<string, LayoutNode>, childOrder, containerId) as Record<
    string,
    EditorNode
  >;
}

/** Wrap top-level siblings in a new auto-layout frame. */
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
  const layout = layoutFieldsForChildren(nextNodes, kids);

  nextNodes[fid] = {
    id: fid,
    parentId,
    type: "frame",
    name: topIds.length === 1 ? nextNodes[topIds[0]!]!.name || "Frame" : "Auto layout",
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
    ...layout,
  };

  for (const id of topIds) {
    const w = worldRect(id, nodes);
    const n = nextNodes[id]!;
    nextNodes[id] = {
      ...n,
      parentId: fid,
      x: w.x - minX,
      y: w.y - minY,
    };
  }

  const list = [...(nextOrder[P] ?? [])];
  const ixs = topIds.map((id) => list.indexOf(id)).sort((a, b) => a - b);
  const insertAt = ixs[0] ?? list.length;
  const newList = list.filter((id) => !topIds.includes(id));
  newList.splice(insertAt, 0, fid);
  nextOrder[P] = newList;
  nextOrder[fid] = topIds;

  const laidOut = applyDeepAutoLayout(
    nextNodes as Record<string, LayoutNode>,
    nextOrder,
    fid,
  ) as Record<string, EditorNode>;
  return { nodes: laidOut, childOrder: nextOrder, frameId: fid };
}

export type ApplyAutoLayoutSelectionResult = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  selectedIds: string[];
};

/**
 * Apply Figma-style auto layout to the current selection.
 * - One shape → wrap in auto-layout frame
 * - One frame/group → enable auto layout
 * - Multiple layers → wrap in one auto-layout frame
 */
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
  const parentId = nodes[tops[0]!]!.parentId;
  if (!tops.every((id) => nodes[id]!.parentId === parentId)) return null;

  if (tops.length === 1) {
    const id = tops[0]!;
    const n = nodes[id]!;
    if (isContainer(n)) {
      const nextNodes = enableAutoLayoutOnContainer(nodes, childOrder, id);
      return { nodes: nextNodes, childOrder, selectedIds: [id] };
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
