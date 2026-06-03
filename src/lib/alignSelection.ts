import type { EditorNode } from "@/stores/useEditorStore";
import type { AlignDirection } from "@/stores/useEditorStore";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import { findInstanceRoot } from "@/lib/componentModel";
import {
  getNodeTransformedWorldBounds,
  getNodeWorldOrigin,
  worldOriginToNodeXY,
  type RectBounds,
} from "@/lib/transformMath";

function moveNodeByWorldDelta(
  nodes: Record<string, EditorNode>,
  nodeId: string,
  dx: number,
  dy: number,
): Record<string, EditorNode> {
  if (dx === 0 && dy === 0) return nodes;
  const n = nodes[nodeId];
  if (!n) return nodes;
  const origin = getNodeWorldOrigin(nodeId, nodes);
  const xy = worldOriginToNodeXY(nodeId, nodes, {
    x: origin.x + dx,
    y: origin.y + dy,
  });
  return { ...nodes, [nodeId]: { ...n, x: xy.x, y: xy.y } };
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

/** When every selected layer shares an auto-layout parent, disable layout so manual x/y sticks. */
export function suspendAutoLayoutForManualPosition(
  nodes: Record<string, EditorNode>,
  nodeIds: string[],
): Record<string, EditorNode> {
  if (nodeIds.length === 0) return nodes;
  const parentIds = new Set<string>();
  for (const id of nodeIds) {
    const p = nodes[id]?.parentId;
    if (!p) return nodes;
    parentIds.add(p);
  }
  if (parentIds.size !== 1) return nodes;
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
  nodeId: string,
  ref: RectBounds,
  direction: AlignDirection,
): Record<string, EditorNode> {
  let next = nodes;
  for (let iter = 0; iter < 12; iter++) {
    const b = getNodeTransformedWorldBounds(nodeId, next);
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
    next = moveNodeByWorldDelta(next, nodeId, dx, dy);
  }
  return next;
}

/** Align layers to the union of their visual bounds in world space. */
export function applyAlignToNodes(
  nodes: Record<string, EditorNode>,
  nodeIds: string[],
  direction: AlignDirection,
): Record<string, EditorNode> {
  if (nodeIds.length < 2) return nodes;

  const items = nodeIds.map((id) => ({
    id,
    b: getNodeTransformedWorldBounds(id, nodes),
  }));
  const ref = unionBounds(items.map(({ b }) => b));
  if (!ref) return nodes;

  let next = { ...nodes };
  for (const { id } of items) {
    next = alignNodeToSelectionBounds(next, id, ref, direction);
  }
  return next;
}

/** Distribute layer spacing using visual bounds (world space). */
export function applyDistributeToNodes(
  nodes: Record<string, EditorNode>,
  nodeIds: string[],
  axis: "horizontal" | "vertical",
): Record<string, EditorNode> {
  if (nodeIds.length < 3) return nodes;

  let next = { ...nodes };
  const items = nodeIds.map((id) => ({
    id,
    b: getNodeTransformedWorldBounds(id, next),
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
      const b = getNodeTransformedWorldBounds(id, next);
      next = moveNodeByWorldDelta(next, id, cur - b.x, 0);
      const b2 = getNodeTransformedWorldBounds(id, next);
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
      const b = getNodeTransformedWorldBounds(id, next);
      next = moveNodeByWorldDelta(next, id, 0, cur - b.y);
      const b2 = getNodeTransformedWorldBounds(id, next);
      cur = b2.y + b2.height + gap;
    }
  }

  return next;
}

/** Parents to relayout after manual position — skip auto-layout frames (they would undo align). */
export function relayoutParentKeysAfterManualPosition(
  nodes: Record<string, EditorNode>,
  nodeIds: string[],
  parentListKey: (parentId: string | null) => string,
): Set<string> {
  const keys = new Set<string>();
  for (const id of nodeIds) {
    const parentId = nodes[id]?.parentId ?? null;
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
  nodeIds: string[],
  direction: AlignDirection,
): Record<string, EditorNode> {
  if (nodeIds.length < 2) return nodes;
  let next = suspendAutoLayoutForManualPosition(nodes, nodeIds);
  next = applyAlignToNodes(next, nodeIds, direction);
  next = syncInstancePositionOverrides(next, nodeIds);
  return next;
}

/** Full distribute pipeline. */
export function distributeNodesInDocument(
  nodes: Record<string, EditorNode>,
  nodeIds: string[],
  axis: "horizontal" | "vertical",
): Record<string, EditorNode> {
  if (nodeIds.length < 3) return nodes;
  let next = suspendAutoLayoutForManualPosition(nodes, nodeIds);
  next = applyDistributeToNodes(next, nodeIds, axis);
  next = syncInstancePositionOverrides(next, nodeIds);
  return next;
}
