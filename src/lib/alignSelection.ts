import type { EditorNode } from "@/stores/useEditorStore";
import type { AlignDirection } from "@/stores/useEditorStore";
import {
  buildParentMapFromChildOrder,
  getNodeWorldMatrixFromChildOrder,
  getRenderedWorldBounds,
  getRenderedWorldTopLeft,
  topLevelSelectedIds,
  worldOriginToNodeXYFromChildOrder,
} from "@/lib/editorGraph";
import { findInstanceRoot } from "@/lib/componentModel";
import { lineEndpointsPatchFromLayout } from "@/lib/shapes/lineGeometry";
import { applyMatrixToPoint, type RectBounds } from "@/lib/transformMath";

function moveNodeByWorldDelta(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeId: string,
  dx: number,
  dy: number,
): Record<string, EditorNode> {
  if (dx === 0 && dy === 0) return nodes;
  const n = nodes[nodeId];
  if (!n) return nodes;
  const origin = getRenderedWorldTopLeft(nodeId, nodes, childOrder);
  const xy = worldOriginToNodeXYFromChildOrder(nodeId, nodes, childOrder, {
    x: origin.x + dx,
    y: origin.y + dy,
  });
  let next: EditorNode = { ...n, x: xy.x, y: xy.y };
  if (next.type === "line" || next.type === "arrow") {
    next = { ...next, ...lineEndpointsPatchFromLayout(next) };
  }
  return { ...nodes, [nodeId]: next };
}

function unionBounds(bounds: RectBounds[]): RectBounds | null {
  if (bounds.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of bounds) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function unionPoints(points: { x: number; y: number }[]): RectBounds | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Top-level selected layers that can be aligned or distributed. */
export function alignableSelectionIds(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): string[] {
  return topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && !n.locked && n.visible;
  });
}

function isAlignParentContainer(node: EditorNode | undefined): boolean {
  return node?.type === "frame" || node?.type === "group";
}

/** Parent frame/group used as align reference for a single selected child. */
export function alignParentIdForSelection(
  nodeIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string | null {
  if (nodeIds.length !== 1) return null;
  const id = nodeIds[0]!;
  const parentOf = buildParentMapFromChildOrder(childOrder);
  const parentId = parentOf.get(id) ?? nodes[id]?.parentId ?? null;
  if (!parentId) return null;
  const parent = nodes[parentId];
  if (!parent || !isAlignParentContainer(parent) || parent.locked || !parent.visible) {
    return null;
  }
  return parentId;
}

/** Content bounds of a frame/group in world space (respects padding). */
export function getParentAlignReferenceBounds(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): RectBounds {
  const parent = nodes[parentId];
  if (!parent) return { x: 0, y: 0, width: 0, height: 0 };

  const padL = parent.paddingLeft ?? 0;
  const padT = parent.paddingTop ?? 0;
  const padR = parent.paddingRight ?? 0;
  const padB = parent.paddingBottom ?? 0;
  const innerW = Math.max(0, parent.width - padL - padR);
  const innerH = Math.max(0, parent.height - padT - padB);
  const usePadding = innerW > 0 && innerH > 0;
  const local = usePadding
    ? { x: padL, y: padT, width: innerW, height: innerH }
    : { x: 0, y: 0, width: Math.max(1, parent.width), height: Math.max(1, parent.height) };

  const wm = getNodeWorldMatrixFromChildOrder(parentId, nodes, childOrder);
  if (!wm) {
    const origin = getRenderedWorldTopLeft(parentId, nodes, childOrder);
    return {
      x: origin.x + local.x,
      y: origin.y + local.y,
      width: local.width,
      height: local.height,
    };
  }

  const corners = [
    { x: local.x, y: local.y },
    { x: local.x + local.width, y: local.y },
    { x: local.x + local.width, y: local.y + local.height },
    { x: local.x, y: local.y + local.height },
  ].map((p) => applyMatrixToPoint(wm, p));
  const ref = unionPoints(corners);
  return ref ?? { x: 0, y: 0, width: local.width, height: local.height };
}

/** Whether the current selection can be aligned (2+ siblings or 1 child in a frame/group). */
export function canAlignSelection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  const tops = alignableSelectionIds(selectedIds, nodes);
  if (tops.length >= 2) return true;
  if (tops.length === 1) {
    return alignParentIdForSelection(tops, nodes, childOrder) != null;
  }
  return false;
}

/** When every selected layer shares an auto-layout parent, disable layout so manual x/y sticks. */
export function suspendAutoLayoutForManualPosition(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeIds: string[],
): Record<string, EditorNode> {
  if (nodeIds.length === 0) return nodes;
  const parentOf = buildParentMapFromChildOrder(childOrder);
  const parentIds = new Set<string | null>();
  for (const id of nodeIds) {
    if (!parentOf.has(id)) return nodes;
    parentIds.add(parentOf.get(id) ?? null);
  }
  if (parentIds.has(null) || parentIds.size !== 1) return nodes;
  const parentId = [...parentIds][0]!;
  const parent = nodes[parentId];
  if (!parent || (parent.layoutMode ?? "none") === "none") return nodes;
  return { ...nodes, [parentId]: { ...parent, layoutMode: "none" } };
}

/** Keep instance override x/y in sync when overrides already pin position. */
export function syncInstancePositionOverrides(
  nodes: Record<string, EditorNode>,
  nodeIds: string[],
): Record<string, EditorNode> {
  let next = nodes;
  for (const id of nodeIds) {
    const n = next[id];
    if (!n) continue;
    const instRoot = findInstanceRoot(next, id);
    if (!instRoot || instRoot === id) continue;
    const root = next[instRoot]!;
    const io: Record<string, Record<string, unknown>> = { ...(root.instanceOverrides ?? {}) };
    const raw = io[id];
    const prev =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? { ...(raw as Record<string, unknown>) }
        : {};
    if (!("x" in prev) && !("y" in prev)) continue;
    io[id] = { ...prev, x: n.x, y: n.y };
    next = { ...next, [instRoot]: { ...root, instanceOverrides: io } };
  }
  return next;
}

function alignNodeToSelectionBounds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeId: string,
  ref: RectBounds,
  direction: AlignDirection,
): Record<string, EditorNode> {
  let next = nodes;
  for (let iter = 0; iter < 12; iter++) {
    const b = getRenderedWorldBounds(nodeId, next, childOrder);
    let dx = 0;
    let dy = 0;
    switch (direction) {
      case "left":
        dx = ref.x - b.x;
        break;
      case "right":
        dx = ref.x + ref.width - (b.x + b.width);
        break;
      case "center-h":
        dx = ref.x + ref.width / 2 - (b.x + b.width / 2);
        break;
      case "top":
        dy = ref.y - b.y;
        break;
      case "bottom":
        dy = ref.y + ref.height - (b.y + b.height);
        break;
      case "center-v":
        dy = ref.y + ref.height / 2 - (b.y + b.height / 2);
        break;
      default:
        break;
    }
    if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) break;
    next = moveNodeByWorldDelta(next, childOrder, nodeId, dx, dy);
  }
  return next;
}

/** Align layers to the union of their visual bounds in world space (matches selection box). */
export function applyAlignToNodes(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeIds: string[],
  direction: AlignDirection,
): Record<string, EditorNode> {
  if (nodeIds.length === 0) return nodes;

  if (nodeIds.length === 1) {
    const parentId = alignParentIdForSelection(nodeIds, nodes, childOrder);
    if (!parentId) return nodes;
    const ref = getParentAlignReferenceBounds(parentId, nodes, childOrder);
    return alignNodeToSelectionBounds(nodes, childOrder, nodeIds[0]!, ref, direction);
  }

  const items = nodeIds.map((id) => ({
    id,
    b: getRenderedWorldBounds(id, nodes, childOrder),
  }));
  const ref = unionBounds(items.map(({ b }) => b));
  if (!ref) return nodes;

  let next = { ...nodes };
  for (const { id } of items) {
    next = alignNodeToSelectionBounds(next, childOrder, id, ref, direction);
  }
  return next;
}

function moveNodeBoundsEdgeToWorld(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeId: string,
  target: { x?: number; y?: number },
): Record<string, EditorNode> {
  let next = nodes;
  for (let iter = 0; iter < 12; iter++) {
    const b = getRenderedWorldBounds(nodeId, next, childOrder);
    const dx = target.x != null ? target.x - b.x : 0;
    const dy = target.y != null ? target.y - b.y : 0;
    if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) break;
    next = moveNodeByWorldDelta(next, childOrder, nodeId, dx, dy);
  }
  return next;
}

/** Whether the current selection can be distributed (3+ alignable top-level layers). */
export function canDistributeSelection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): boolean {
  return alignableSelectionIds(selectedIds, nodes).length >= 3;
}

/** Distribute layer spacing using visual bounds (world space). */
export function applyDistributeToNodes(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeIds: string[],
  axis: "horizontal" | "vertical",
): Record<string, EditorNode> {
  if (nodeIds.length < 3) return nodes;

  let next = { ...nodes };
  const items = nodeIds.map((id) => ({
    id,
    b: getRenderedWorldBounds(id, next, childOrder),
  }));

  if (axis === "horizontal") {
    const sorted = [...items].sort((a, b) => a.b.x - b.b.x);
    const n = sorted.length;
    const left0 = sorted[0]!.b.x;
    const rightLast = sorted[n - 1]!.b.x + sorted[n - 1]!.b.width;
    const span = rightLast - left0;
    const sumW = sorted.reduce((acc, { b }) => acc + b.width, 0);
    const gap = (span - sumW) / (n - 1);
    let cur = left0;
    for (const { id } of sorted) {
      next = moveNodeBoundsEdgeToWorld(next, childOrder, id, { x: cur });
      const b2 = getRenderedWorldBounds(id, next, childOrder);
      cur = b2.x + b2.width + gap;
    }
  } else {
    const sorted = [...items].sort((a, b) => a.b.y - b.b.y);
    const n = sorted.length;
    const top0 = sorted[0]!.b.y;
    const botLast = sorted[n - 1]!.b.y + sorted[n - 1]!.b.height;
    const span = botLast - top0;
    const sumH = sorted.reduce((acc, { b }) => acc + b.height, 0);
    const gap = (span - sumH) / (n - 1);
    let cur = top0;
    for (const { id } of sorted) {
      next = moveNodeBoundsEdgeToWorld(next, childOrder, id, { y: cur });
      const b2 = getRenderedWorldBounds(id, next, childOrder);
      cur = b2.y + b2.height + gap;
    }
  }

  return next;
}

/** Parents to relayout after manual position — skip auto-layout frames (they would undo align). */
export function relayoutParentKeysAfterManualPosition(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeIds: string[],
  parentListKey: (parentId: string | null) => string,
): Set<string> {
  const parentOf = buildParentMapFromChildOrder(childOrder);
  const keys = new Set<string>();
  for (const id of nodeIds) {
    const parentId = parentOf.get(id) ?? null;
    if (!parentId) continue;
    const parent = nodes[parentId];
    if (parent && (parent.layoutMode ?? "none") !== "none") continue;
    keys.add(parentListKey(parentId));
  }
  return keys;
}

/** Full align pipeline: suspend conflicting auto-layout, align, sync instance overrides. */
export function alignNodesInDocument(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeIds: string[],
  direction: AlignDirection,
): Record<string, EditorNode> {
  if (nodeIds.length === 0) return nodes;
  if (nodeIds.length === 1 && !alignParentIdForSelection(nodeIds, nodes, childOrder)) {
    return nodes;
  }
  let next = suspendAutoLayoutForManualPosition(nodes, childOrder, nodeIds);
  next = applyAlignToNodes(next, childOrder, nodeIds, direction);
  next = syncInstancePositionOverrides(next, nodeIds);
  return next;
}

export function alignDirectionForGridCell(
  row: number,
  col: number,
): { horizontal: AlignDirection; vertical: AlignDirection } {
  const horizontal: AlignDirection = col === 0 ? "left" : col === 1 ? "center-h" : "right";
  const vertical: AlignDirection = row === 0 ? "top" : row === 1 ? "center-v" : "bottom";
  return { horizontal, vertical };
}

/** Align selection to a 3×3 grid position (horizontal + vertical in one pass). */
export function alignNodesInDocumentToGrid(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeIds: string[],
  row: number,
  col: number,
): Record<string, EditorNode> {
  const { horizontal, vertical } = alignDirectionForGridCell(row, col);
  let next = alignNodesInDocument(nodes, childOrder, nodeIds, horizontal);
  next = alignNodesInDocument(next, childOrder, nodeIds, vertical);
  return next;
}

/** Full distribute pipeline. */
export function distributeNodesInDocument(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeIds: string[],
  axis: "horizontal" | "vertical",
): Record<string, EditorNode> {
  if (nodeIds.length < 3) return nodes;
  let next = suspendAutoLayoutForManualPosition(nodes, childOrder, nodeIds);
  next = applyDistributeToNodes(next, childOrder, nodeIds, axis);
  next = syncInstancePositionOverrides(next, nodeIds);
  return next;
}
