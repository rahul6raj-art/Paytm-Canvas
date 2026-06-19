import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { nextDuplicatedLayerName } from "@/lib/layerNaming";
import {
  applyMatrixToPoint,
  finiteCoord,
  finiteDimension,
  getNodeLocalMatrix,
  getNodeWorldOrigin,
  getRotatedRectCorners,
  hasRotation,
  invertMatrix,
  multiplyMatrix,
  type Matrix2D,
} from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";
import { hitTestLineWorld, lineRenderedWorldBounds } from "@/lib/shapes/lineGeometry";
import { arrowRenderedWorldBounds, hitTestArrowWorld } from "@/lib/shapes/arrowGeometry";
import { hitTestTextWorld } from "@/lib/text/textHitTest";
import { hitTestPolygonLocal, isPolygonNode } from "@/lib/shapes/polygonGeometry";
import {
  getBooleanGroupVisibleWorldBounds,
  isBooleanGroup,
  isMaskGroup,
} from "@/lib/booleanGeometry";

export type NodeMin = { parentId: string | null; name: string };

export function parentListKeyForNode(parentId: string | null): string {
  return parentId ?? EDITOR_ROOT_KEY;
}

function isValidParentContainer(nodes: Record<string, EditorNode>, parentKey: string): boolean {
  if (parentKey === EDITOR_ROOT_KEY) return true;
  const p = nodes[parentKey];
  return Boolean(p && (p.type === "frame" || p.type === "group"));
}

/** Parent list key for a node; invalid parents fall back to root. */
export function resolveParentListKey(
  nodes: Record<string, EditorNode>,
  parentId: string | null,
): string {
  const key = parentListKeyForNode(parentId);
  if (key === EDITOR_ROOT_KEY) return key;
  return isValidParentContainer(nodes, key) ? key : EDITOR_ROOT_KEY;
}

/**
 * Rebuild childOrder from nodes[].parentId so each layer appears under exactly one parent.
 * Preserves prior z-order where possible.
 */
export function reconcileChildOrderWithParents(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, string[]> {
  const orderIndex = new Map<string, number>();
  let idx = 0;
  for (const list of Object.values(childOrder)) {
    for (const id of list) {
      if (!orderIndex.has(id)) orderIndex.set(id, idx++);
    }
  }
  for (const id of Object.keys(nodes)) {
    if (!orderIndex.has(id)) orderIndex.set(id, idx++);
  }

  const buckets = new Map<string, string[]>();
  const touch = (key: string) => {
    if (!buckets.has(key)) buckets.set(key, []);
    return buckets.get(key)!;
  };

  const sortedIds = [...Object.keys(nodes)].sort(
    (a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0),
  );

  for (const id of sortedIds) {
    const n = nodes[id];
    if (!n) continue;
    touch(resolveParentListKey(nodes, n.parentId)).push(id);
  }

  for (const id of Object.keys(nodes)) {
    const n = nodes[id]!;
    if ((n.type === "frame" || n.type === "group") && !buckets.has(id)) {
      buckets.set(id, []);
    }
  }

  const out: Record<string, string[]> = {};
  for (const [k, v] of buckets) out[k] = v;
  if (!out[EDITOR_ROOT_KEY]) out[EDITOR_ROOT_KEY] = [];
  return out;
}

/** Layer panel child ids — honors childOrder z-order but only under the correct parent. */
export function layerPanelChildIds(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  const expectedParent = parentId === EDITOR_ROOT_KEY ? null : parentId;
  const fromOrder = (childOrder[parentId] ?? []).filter((id) => {
    if (id === EDITOR_ROOT_KEY || id === parentId) return false;
    const n = nodes[id];
    return n && (n.parentId ?? null) === expectedParent;
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
    .filter((id) => {
      if (id === EDITOR_ROOT_KEY || id === parentId) return false;
      const n = nodes[id];
      return n && (n.parentId ?? null) === expectedParent;
    })
    .sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
}

/** Figma-style layer list — front-most layer first (top of the panel). */
export function layerPanelDisplayChildIds(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  return [...layerPanelChildIds(parentId, nodes, childOrder)].reverse();
}

/** Map a layer-panel drop index to a childOrder insertion index. */
export function childOrderIndexFromLayerPanelInsertBefore(
  siblingCount: number,
  insertBefore: number,
): number {
  return Math.max(0, Math.min(siblingCount, siblingCount - insertBefore));
}

/**
 * Insert a duplicated node directly above its source in the layer panel and in front on canvas.
 */
export function insertDuplicatedSiblingInChildOrder(
  childOrder: Record<string, string[]>,
  parentKey: string,
  sourceId: string,
  duplicateId: string,
): Record<string, string[]> {
  const list = [...(childOrder[parentKey] ?? [])].filter((id) => id !== duplicateId);
  const curIdx = list.indexOf(sourceId);
  const insertAt = curIdx >= 0 ? curIdx + 1 : list.length;
  list.splice(insertAt, 0, duplicateId);
  return { ...childOrder, [parentKey]: list };
}

/** Insert a node into the correct parent list and remove it from all other lists. */
export function insertNodeInChildOrder(
  childOrder: Record<string, string[]>,
  id: string,
  parentId: string | null,
): Record<string, string[]> {
  const co: Record<string, string[]> = {};
  for (const [key, list] of Object.entries(childOrder)) {
    co[key] = (list ?? []).filter((x) => x !== id);
  }
  const parentKey = parentListKeyForNode(parentId);
  const list = [...(co[parentKey] ?? [])];
  list.push(id);
  co[parentKey] = list;
  return co;
}

/** Hit test in world space using the childOrder render tree (matches canvas). */
export function pointInNodeRenderedWorldBounds(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  zoom = 1,
): boolean {
  const n = nodes[nodeId];
  if (!n) return false;
  if (n.type === "line") {
    return hitTestLineWorld(worldX, worldY, nodeId, nodes, childOrder, zoom);
  }
  if (n.type === "arrow") {
    return hitTestArrowWorld(worldX, worldY, nodeId, nodes, childOrder, zoom);
  }
  if (n.type === "text") {
    return hitTestTextWorld(worldX, worldY, nodeId, nodes, childOrder);
  }
  if (isPolygonNode(n)) {
    const inv = getNodeWorldInverseMatrixFromChildOrder(nodeId, nodes, childOrder);
    if (!inv) {
      const b = getRenderedWorldBounds(nodeId, nodes, childOrder);
      return (
        worldX >= b.x &&
        worldX <= b.x + b.width &&
        worldY >= b.y &&
        worldY <= b.y + b.height
      );
    }
    const local = applyMatrixToPoint(inv, { x: worldX, y: worldY });
    return hitTestPolygonLocal(local.x, local.y, n, zoom);
  }
  const inv = getNodeWorldInverseMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (!inv) {
    const b = getRenderedWorldBounds(nodeId, nodes, childOrder);
    return (
      worldX >= b.x &&
      worldX <= b.x + b.width &&
      worldY >= b.y &&
      worldY <= b.y + b.height
    );
  }
  const local = applyMatrixToPoint(inv, { x: worldX, y: worldY });
  const w = Math.max(1, n.width);
  const h = Math.max(1, n.height);
  return local.x >= 0 && local.x <= w && local.y >= 0 && local.y <= h;
}

/** Parent map from childOrder (editor scene tree). */
export function buildParentMapFromChildOrder(
  childOrder: Record<string, string[]>,
): Map<string, string | null> {
  const parentOf = new Map<string, string | null>();
  for (const [key, list] of Object.entries(childOrder)) {
    const parentId = key === EDITOR_ROOT_KEY ? null : key;
    for (const id of list) {
      parentOf.set(id, parentId);
    }
  }
  return parentOf;
}

/** Prefer nodes[].parentId for auto-layout parents; else childOrder (matches canvas when desynced). */
export function resolveRenderParentId(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string | null {
  const n = nodes[nodeId];
  if (!n) return null;
  const parentFromOrder = buildParentMapFromChildOrder(childOrder).get(nodeId);

  if (n.parentId != null && nodes[n.parentId]) {
    const parent = nodes[n.parentId];
    if ((parent.layoutMode ?? "none") !== "none") {
      return n.parentId;
    }
  }

  if (parentFromOrder !== undefined) {
    return parentFromOrder;
  }

  return n.parentId ?? null;
}

/** World matrix for a node using the childOrder tree (same tree as CanvasObject). */
export function getNodeWorldMatrixFromChildOrder(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Matrix2D | null {
  const n = nodes[nodeId];
  if (!n) return null;
  try {
    const local = getNodeLocalMatrix(n);
    const parentId = resolveRenderParentId(nodeId, nodes, childOrder);
    if (!parentId || !nodes[parentId]) return local;
    const parentWorld = getNodeWorldMatrixFromChildOrder(parentId, nodes, childOrder);
    if (!parentWorld) return local;
    return multiplyMatrix(parentWorld, local);
  } catch {
    return null;
  }
}

export type WorldCorner = { x: number; y: number };

/** World-space box corners (nw, ne, se, sw) using the childOrder render tree — matches SVG scene. */
export function getNodeTransformedWorldCornersFromChildOrder(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): [WorldCorner, WorldCorner, WorldCorner, WorldCorner] | null {
  const n = nodes[nodeId];
  if (!n) return null;
  const wm = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (!wm) {
    const topLeft = getRenderedWorldTopLeft(nodeId, nodes, childOrder);
    return getRotatedRectCorners(
      { x: topLeft.x, y: topLeft.y, width: n.width, height: n.height },
      n.rotation ?? 0,
    );
  }
  const w = Math.max(1, n.width);
  const h = Math.max(1, n.height);
  const local = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ] as const;
  return local.map((p) => applyMatrixToPoint(wm, p)) as [
    WorldCorner,
    WorldCorner,
    WorldCorner,
    WorldCorner,
  ];
}

/**
 * World top-left of a node as rendered by the DOM tree (childOrder), ignoring nodes[].parentId.
 */
export function getRenderedWorldTopLeft(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  const wm = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (wm) return applyMatrixToPoint(wm, { x: 0, y: 0 });
  const n = nodes[nodeId];
  return { x: n?.x ?? 0, y: n?.y ?? 0 };
}

/** Bounds for one node (no mask-group expansion). */
function renderNodeWorldBounds(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number; width: number; height: number } {
  const n = nodes[nodeId];
  if (!n) return { x: 0, y: 0, width: 0, height: 0 };
  if (n.type === "line") {
    return lineRenderedWorldBounds(nodeId, nodes, childOrder);
  }
  if (n.type === "arrow") {
    return arrowRenderedWorldBounds(nodeId, nodes, childOrder);
  }
  const wm = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (!wm) {
    return {
      x: finiteCoord(n.x),
      y: finiteCoord(n.y),
      width: finiteDimension(n.width),
      height: finiteDimension(n.height),
    };
  }
  const w = finiteDimension(n.width);
  const h = finiteDimension(n.height);
  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ].map((p) => applyMatrixToPoint(wm, p));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of corners) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) {
    const origin = applyMatrixToPoint(wm, { x: 0, y: 0 });
    return {
      x: finiteCoord(origin.x),
      y: finiteCoord(origin.y),
      width: w,
      height: h,
    };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function intersectWorldBounds(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } | null {
  const minX = Math.max(a.x, b.x);
  const minY = Math.max(a.y, b.y);
  const maxX = Math.min(a.x + a.width, b.x + b.width);
  const maxY = Math.min(a.y + a.height, b.y + b.height);
  if (maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function unionWorldBounds(
  boxes: { x: number; y: number; width: number; height: number }[],
): { x: number; y: number; width: number; height: number } | null {
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Visible region before a mask group node exists (mask ∩ content layers). */
export function boundsForMaskAndContent(
  maskId: string,
  contentIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number; width: number; height: number } {
  const maskBounds = renderNodeWorldBounds(maskId, nodes, childOrder);
  if (contentIds.length === 0) return maskBounds;
  const contentUnion = unionWorldBounds(
    contentIds.map((cid) => renderNodeWorldBounds(cid, nodes, childOrder)),
  );
  if (!contentUnion) return maskBounds;
  const visible = intersectWorldBounds(maskBounds, contentUnion);
  return visible
    ? {
        x: visible.x,
        y: visible.y,
        width: Math.max(1, visible.width),
        height: Math.max(1, visible.height),
      }
    : maskBounds;
}

/**
 * World bounds of what is actually visible in a mask group (mask shape ∩ masked content).
 */
export function getMaskGroupVisibleWorldBounds(
  groupId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number; width: number; height: number } {
  const g = nodes[groupId];
  if (!isMaskGroup(g) || !g.maskId || !nodes[g.maskId]) {
    return renderNodeWorldBounds(groupId, nodes, childOrder);
  }
  const contentIds = (childOrder[groupId] ?? []).filter((cid) => {
    if (cid === g.maskId) return false;
    const c = nodes[cid];
    return c && c.visible && !c.locked;
  });
  return boundsForMaskAndContent(g.maskId, contentIds, nodes, childOrder);
}

/** Axis-aligned world bounds using the childOrder render tree (matches what you see on canvas). */
export function getRenderedWorldBounds(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number; width: number; height: number } {
  const n = nodes[nodeId];
  if (!n) return { x: 0, y: 0, width: 0, height: 0 };
  if (isMaskGroup(n) && n.maskId && nodes[n.maskId]) {
    return getMaskGroupVisibleWorldBounds(nodeId, nodes, childOrder);
  }
  if (isBooleanGroup(n)) {
    return getBooleanGroupVisibleWorldBounds(nodeId, nodes, childOrder);
  }
  return renderNodeWorldBounds(nodeId, nodes, childOrder);
}

function visibleBoundsForCompositeGroup(
  groupId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number; width: number; height: number } | null {
  const g = nodes[groupId];
  if (!g || g.type !== "group") return null;
  if (isMaskGroup(g) && g.maskId) {
    return getMaskGroupVisibleWorldBounds(groupId, nodes, childOrder);
  }
  if (isBooleanGroup(g)) {
    return getBooleanGroupVisibleWorldBounds(groupId, nodes, childOrder);
  }
  return null;
}

/**
 * Resize a mask or boolean group to its visible result; keep children fixed in world space.
 */
export function syncGroupFrameToVisible(
  groupId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, EditorNode> {
  const g = nodes[groupId];
  const visibleBounds = visibleBoundsForCompositeGroup(groupId, nodes, childOrder);
  if (!g || !visibleBounds) return nodes;
  const parentId = g.parentId;
  const groupXY = parentId
    ? worldPointToParentLocalFromChildOrder(
        visibleBounds.x,
        visibleBounds.y,
        parentId,
        nodes,
        childOrder,
      )
    : { x: visibleBounds.x, y: visibleBounds.y };

  const kids = (childOrder[groupId] ?? []).filter((cid) => nodes[cid]);
  const worldOrigins = new Map<string, { x: number; y: number }>();
  for (const cid of kids) {
    worldOrigins.set(cid, getNodeWorldOrigin(cid, nodes));
  }

  let out = { ...nodes };
  out[groupId] = {
    ...g,
    x: groupXY.x,
    y: groupXY.y,
    width: Math.max(1, visibleBounds.width),
    height: Math.max(1, visibleBounds.height),
  };

  for (const cid of kids) {
    const wo = worldOrigins.get(cid)!;
    const local = worldPointToParentLocalFromChildOrder(wo.x, wo.y, groupId, out, childOrder);
    out[cid] = { ...out[cid]!, x: local.x, y: local.y };
  }

  return out;
}

/** @deprecated Use syncGroupFrameToVisible */
export const syncMaskGroupFrameToMask = syncGroupFrameToVisible;

/** @deprecated Use syncGroupFrameToVisible */
export const syncBooleanGroupFrame = syncGroupFrameToVisible;

/** Inverse world matrix using the childOrder render tree. */
export function getNodeWorldInverseMatrixFromChildOrder(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Matrix2D | null {
  const wm = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (!wm) return null;
  return invertMatrix(wm);
}

/** World point → node's local geometry coordinates (childOrder render tree). */
export function worldToNodeLocalFromChildOrder(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  const inv = getNodeWorldInverseMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (!inv) {
    const n = nodes[nodeId];
    if (!n) return { x: worldX, y: worldY };
    const origin = getRenderedWorldTopLeft(nodeId, nodes, childOrder);
    return { x: worldX - origin.x, y: worldY - origin.y };
  }
  return applyMatrixToPoint(inv, { x: worldX, y: worldY });
}

/** World point → parent-local using the childOrder scene tree. */
export function worldPointToParentLocalFromChildOrder(
  worldX: number,
  worldY: number,
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  const inv = getNodeWorldInverseMatrixFromChildOrder(parentId, nodes, childOrder);
  if (!inv) {
    const pw = getRenderedWorldTopLeft(parentId, nodes, childOrder);
    return { x: worldX - pw.x, y: worldY - pw.y };
  }
  return applyMatrixToPoint(inv, { x: worldX, y: worldY });
}

/** Live drag endpoints are in world space; node x/y are parent-local when parented. */
export function worldDragPairInParentSpace(
  parentId: string | null | undefined,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  start: { x: number; y: number },
  end: { x: number; y: number },
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  if (!parentId) return { start, end };
  return {
    start: worldPointToParentLocalFromChildOrder(start.x, start.y, parentId, nodes, childOrder),
    end: worldPointToParentLocalFromChildOrder(end.x, end.y, parentId, nodes, childOrder),
  };
}

/** Align nodes[].parentId with where the layer appears in childOrder. */
export function syncParentIdsFromChildOrder(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, EditorNode> {
  const parentOf = buildParentMapFromChildOrder(childOrder);
  const out = { ...nodes };
  for (const id of Object.keys(out)) {
    if (!parentOf.has(id)) continue;
    const want = parentOf.get(id)!;
    const n = out[id]!;
    if ((n.parentId ?? null) !== want) {
      out[id] = { ...n, parentId: want };
    }
  }
  return out;
}

function nodeCenterLooksLikeWorldCoordsInParent(
  node: EditorNode,
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  const pb = getRenderedWorldBounds(parentId, nodes, childOrder);
  const origin = getRenderedWorldTopLeft(node.id, nodes, childOrder);
  const cx = origin.x + node.width / 2;
  const cy = origin.y + node.height / 2;
  return (
    cx >= pb.x &&
    cy >= pb.y &&
    cx <= pb.x + pb.width &&
    cy <= pb.y + pb.height
  );
}

/**
 * When a layer is nested in childOrder but parentId is null, set parentId from the list.
 * If x/y look like canvas (world) coordinates inside the parent, convert to parent-local.
 */
export function syncParentIdsFromChildOrderIfNull(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, EditorNode> {
  const parentOf = buildParentMapFromChildOrder(childOrder);
  const out = { ...nodes };
  for (const id of Object.keys(out)) {
    const n = out[id]!;
    if (n.parentId != null) continue;
    if (!parentOf.has(id)) continue;
    const want = parentOf.get(id)!;
    if (want == null) continue;
    if (!isValidParentContainer(nodes, want)) continue;

    if (nodeCenterLooksLikeWorldCoordsInParent(n, want, out, childOrder)) {
      const world = getRenderedWorldTopLeft(id, out, childOrder);
      const local = worldPointToParentLocalFromChildOrder(world.x, world.y, want, out, childOrder);
      out[id] = { ...n, parentId: want, x: local.x, y: local.y };
    } else {
      out[id] = { ...n, parentId: want };
    }
  }
  return out;
}

/** Remove duplicate ids across lists; keep the deepest (non-root) parent when duplicated. */
export function dedupeChildOrderLists(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, string[]> {
  const placement = new Map<string, string>();
  for (const [key, list] of Object.entries(childOrder)) {
    for (const id of list) {
      if (!nodes[id]) continue;
      const prev = placement.get(id);
      if (!prev) {
        placement.set(id, key);
        continue;
      }
      if (prev === EDITOR_ROOT_KEY && key !== EDITOR_ROOT_KEY) {
        placement.set(id, key);
      }
    }
  }

  const out: Record<string, string[]> = {};
  const touch = (key: string) => {
    if (!out[key]) out[key] = [];
    return out[key]!;
  };

  for (const [id, key] of placement) {
    touch(key).push(id);
  }

  for (const id of Object.keys(nodes)) {
    if ((nodes[id]!.type === "frame" || nodes[id]!.type === "group") && !out[id]) {
      out[id] = [];
    }
  }
  if (!out[EDITOR_ROOT_KEY]) out[EDITOR_ROOT_KEY] = [];
  return out;
}

/** Rewrite node x/y as parent-local coords for `parentId`, preserving world top-left. */
export function nodeWithWorldTopLeftAsParentLocal(
  node: EditorNode,
  parentId: string | null,
  worldTopLeft: { x: number; y: number },
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): EditorNode {
  return nodeWithWorldBoundsAsParentLocal(
    node,
    parentId,
    { x: worldTopLeft.x, y: worldTopLeft.y, width: node.width, height: node.height },
    nodes,
    childOrder,
  );
}

/** Rewrite node x/y/width/height to match axis-aligned world bounds in the render tree. */
export function nodeWithWorldBoundsAsParentLocal(
  node: EditorNode,
  parentId: string | null,
  worldBounds: { x: number; y: number; width: number; height: number },
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): EditorNode {
  const w = Math.max(1, worldBounds.width);
  const h = Math.max(1, worldBounds.height);
  if (!parentId) {
    return {
      ...node,
      parentId: null,
      x: worldBounds.x,
      y: worldBounds.y,
      width: w,
      height: h,
    };
  }
  const tl = worldPointToParentLocalFromChildOrder(
    worldBounds.x,
    worldBounds.y,
    parentId,
    nodes,
    childOrder,
  );
  const br = worldPointToParentLocalFromChildOrder(
    worldBounds.x + w,
    worldBounds.y + h,
    parentId,
    nodes,
    childOrder,
  );
  return {
    ...node,
    parentId,
    x: tl.x,
    y: tl.y,
    width: Math.max(1, br.x - tl.x),
    height: Math.max(1, br.y - tl.y),
  };
}

/** World origin (0,0) of a node as rendered on canvas (childOrder tree). */
export function getRenderedWorldOrigin(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  return getRenderedWorldTopLeft(nodeId, nodes, childOrder);
}

/** True when the parent frame uses horizontal or vertical auto-layout. */
export function parentUsesAutoLayout(
  parentId: string | null,
  nodes: Record<string, { layoutMode?: string }>,
): boolean {
  if (!parentId) return false;
  const p = nodes[parentId];
  if (!p) return false;
  const mode = p.layoutMode ?? "none";
  return mode === "horizontal" || mode === "vertical";
}

export type CloneWorldOffset = { dx: number; dy: number };

/** Clone positioning: null offset keeps the same local position; world offset shifts only the tree root. */
export function clonedNodePosition(
  oldId: string,
  isTreeRoot: boolean,
  worldOffset: CloneWorldOffset | null,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  newParentId: string | null,
  oldNode: EditorNode,
): { x: number; y: number } {
  if (!isTreeRoot || !worldOffset || (worldOffset.dx === 0 && worldOffset.dy === 0)) {
    return { x: oldNode.x, y: oldNode.y };
  }
  const topLeft = getRenderedWorldTopLeft(oldId, nodes, childOrder);
  const wx = topLeft.x + worldOffset.dx;
  const wy = topLeft.y + worldOffset.dy;
  if (!newParentId) {
    return { x: wx, y: wy };
  }
  return worldPointToParentLocalFromChildOrder(wx, wy, newParentId, nodes, childOrder);
}

/** Sort ids so parents are updated before descendants (stable by depth). */
export function sortNodeIdsParentsBeforeChildren(
  ids: string[],
  parentOf: Map<string, string | null>,
): string[] {
  const depth = new Map<string, number>();
  const getDepth = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    const p = parentOf.get(id) ?? null;
    const d = p ? getDepth(p) + 1 : 0;
    depth.set(id, d);
    return d;
  };
  for (const id of ids) getDepth(id);
  return [...ids].sort((a, b) => (depth.get(a) ?? 0) - (depth.get(b) ?? 0));
}

/** Set node x/y so its rendered origin matches a world point (childOrder tree). */
export function worldOriginToNodeXYFromChildOrder(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  desiredWorldOrigin: { x: number; y: number },
): { x: number; y: number } {
  const n = nodes[nodeId];
  if (!n) return desiredWorldOrigin;

  const parentOf = buildParentMapFromChildOrder(childOrder);
  const parentId = parentOf.get(nodeId) ?? null;
  const inParent = parentId
    ? worldPointToParentLocalFromChildOrder(
        desiredWorldOrigin.x,
        desiredWorldOrigin.y,
        parentId,
        nodes,
        childOrder,
      )
    : desiredWorldOrigin;

  if (!hasRotation(n.rotation)) {
    return { x: inParent.x, y: inParent.y };
  }

  let x = n.x;
  let y = n.y;
  for (let i = 0; i < 8; i++) {
    const got = applyMatrixToPoint(getNodeLocalMatrix({ ...n, x, y }), { x: 0, y: 0 });
    const errX = inParent.x - got.x;
    const errY = inParent.y - got.y;
    if (Math.abs(errX) < 1e-4 && Math.abs(errY) < 1e-4) break;
    x += errX;
    y += errY;
  }
  return { x, y };
}

/**
 * Set node x/y so its world center matches a point.
 * Rotation is around the box center, so parent-local center is always (x + w/2, y + h/2).
 */
export function worldCenterToNodeXYFromChildOrder(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  desiredWorldCenter: { x: number; y: number },
  _rotation?: number,
  _initialGuess?: { x: number; y: number },
): { x: number; y: number } {
  const n = nodes[nodeId];
  if (!n) return { x: 0, y: 0 };
  const w = Math.max(1, n.width);
  const h = Math.max(1, n.height);
  const parentOf = buildParentMapFromChildOrder(childOrder);
  const parentId = parentOf.get(nodeId) ?? null;
  const inParent = parentId
    ? worldPointToParentLocalFromChildOrder(
        desiredWorldCenter.x,
        desiredWorldCenter.y,
        parentId,
        nodes,
        childOrder,
      )
    : desiredWorldCenter;
  return { x: inParent.x - w / 2, y: inParent.y - h / 2 };
}

function rectOverlapArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  if (x1 <= x0 || y1 <= y0) return 0;
  return (x1 - x0) * (y1 - y0);
}

/**
 * Move frames that sit almost entirely outside their parent to the canvas root (Figma-like).
 * Fixes frames wrongly nested via “selected frame” fallback when drawn beside another frame.
 */
export function liftFramesMostlyOutsideParent(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  const parentOf = buildParentMapFromChildOrder(childOrder);
  let co = { ...childOrder };
  const out = { ...nodes };
  const toLift: string[] = [];

  for (const id of Object.keys(out)) {
    const n = out[id];
    if (!n || n.type !== "frame") continue;
    const parentId = parentOf.get(id) ?? null;
    if (!parentId) continue;
    const childB = getRenderedWorldBounds(id, out, co);
    const parentB = getRenderedWorldBounds(parentId, out, co);
    const area = Math.max(1, childB.width * childB.height);
    const overlap = rectOverlapArea(childB, parentB);
    if (overlap / area < 0.25) toLift.push(id);
  }

  if (toLift.length === 0) return { nodes: out, childOrder: co };

  for (const id of toLift) {
    const wb = getRenderedWorldBounds(id, out, co);
    const parentId = parentOf.get(id) ?? null;
    if (!parentId) continue;
    const listKey = parentListKeyForNode(parentId);
    co[listKey] = (co[listKey] ?? []).filter((x) => x !== id);
    const roots = [...(co[EDITOR_ROOT_KEY] ?? [])];
    if (!roots.includes(id)) roots.push(id);
    co[EDITOR_ROOT_KEY] = roots;
    co[id] = co[id] ?? [];
    out[id] = nodeWithWorldBoundsAsParentLocal(out[id]!, null, wb, out, co);
  }

  return { nodes: out, childOrder: co };
}

/**
 * Fix hierarchy desync: childOrder drives rendering; parentId drives world bounds / selection.
 * Preserves on-canvas world position while aligning parentId, childOrder, and parent-local x/y.
 */
export function repairNodeHierarchy(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  const lifted = liftFramesMostlyOutsideParent(nodes, childOrder);
  const deduped = dedupeChildOrderLists(lifted.nodes, lifted.childOrder);

  const renderBounds = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const id of Object.keys(lifted.nodes)) {
    renderBounds.set(id, getRenderedWorldBounds(id, lifted.nodes, deduped));
  }

  const nodesSynced = syncParentIdsFromChildOrderIfNull(lifted.nodes, deduped);
  const co = reconcileChildOrderWithParents(nodesSynced, deduped);
  const parentOf = buildParentMapFromChildOrder(co);

  const out: Record<string, EditorNode> = { ...nodesSynced };
  const orderedIds = sortNodeIdsParentsBeforeChildren(Object.keys(out), parentOf);
  for (const id of orderedIds) {
    const wb = renderBounds.get(id);
    if (!wb) continue;
    const wantParent = parentOf.has(id) ? parentOf.get(id)! : null;
    out[id] = nodeWithWorldBoundsAsParentLocal(out[id]!, wantParent, wb, out, co);
  }

  return { nodes: out, childOrder: co };
}

/** True when childOrder disagrees with nodes[].parentId (e.g. child listed at root and under a frame). */
export function needsChildOrderReconcile(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  const seen = new Map<string, string>();
  for (const [key, list] of Object.entries(childOrder)) {
    for (const id of list) {
      if (!nodes[id]) continue;
      if (seen.has(id)) return true;
      seen.set(id, key);
      if (resolveParentListKey(nodes, nodes[id]!.parentId) !== key) return true;
    }
  }
  for (const id of Object.keys(nodes)) {
    if (!seen.has(id)) return true;
    if (seen.get(id) !== resolveParentListKey(nodes, nodes[id]!.parentId)) return true;
  }
  return false;
}

/** True when stored x/y/width/height disagree with the childOrder render tree. */
export function needsNodeGeometryRepair(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  epsilon = 2,
): boolean {
  const parentOf = buildParentMapFromChildOrder(childOrder);
  for (const id of Object.keys(nodes)) {
    const n = nodes[id];
    if (!n) continue;
    const rendered = getRenderedWorldBounds(id, nodes, childOrder);
    const parentId = parentOf.get(id) ?? null;
    let expectedOrigin = { x: n.x, y: n.y };
    if (parentId) {
      const po = getRenderedWorldTopLeft(parentId, nodes, childOrder);
      expectedOrigin = { x: po.x + n.x, y: po.y + n.y };
    }
    if (Math.hypot(rendered.x - expectedOrigin.x, rendered.y - expectedOrigin.y) > epsilon) {
      return true;
    }
    if (Math.abs(rendered.width - Math.max(1, n.width)) > epsilon) return true;
    if (Math.abs(rendered.height - Math.max(1, n.height)) > epsilon) return true;
  }
  return false;
}

export function needsNodeHierarchyRepair(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  return needsChildOrderReconcile(nodes, childOrder) || needsNodeGeometryRepair(nodes, childOrder);
}

/** Skip full geometry repair above this count (keeps editor responsive after large imports). */
export const HIERARCHY_REPAIR_NODE_SOFT_CAP = 8_000;

/**
 * Reconcile parentId/childOrder only — no world-bounds rewrite (cheap for large documents).
 */
export function reconcileHierarchyLight(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  if (!needsChildOrderReconcile(nodes, childOrder)) {
    return { nodes, childOrder };
  }
  const nodesSynced = syncParentIdsFromChildOrder(nodes, childOrder);
  const co = reconcileChildOrderWithParents(nodesSynced, childOrder);
  return { nodes: nodesSynced, childOrder: dedupeChildOrderLists(nodesSynced, co) };
}

/**
 * Full hierarchy repair when needed; large docs only get light reconcile to avoid UI freezes.
 */
export function repairNodeHierarchyIfNeeded(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  opts?: { maxNodesForFullRepair?: number },
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  const count = Object.keys(nodes).length;
  if (count === 0) return { nodes, childOrder };

  const cap = opts?.maxNodesForFullRepair ?? HIERARCHY_REPAIR_NODE_SOFT_CAP;
  if (count > cap) {
    return reconcileHierarchyLight(nodes, childOrder);
  }

  if (!needsNodeHierarchyRepair(nodes, childOrder)) {
    return { nodes, childOrder };
  }

  return repairNodeHierarchy(nodes, childOrder);
}

export function isAncestorOf(
  nodes: Record<string, NodeMin>,
  ancestorId: string,
  nodeId: string,
): boolean {
  let cur: string | null = nodeId;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = nodes[cur]?.parentId ?? null;
  }
  return false;
}

export function topLevelSelectedIds(selectedIds: string[], nodes: Record<string, NodeMin>): string[] {
  return selectedIds.filter((id) => !selectedIds.some((o) => o !== id && isAncestorOf(nodes, o, id)));
}

export function collectSubtreeIds(rootId: string, childOrder: Record<string, string[]>): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    out.push(id);
    for (const c of childOrder[id] ?? []) walk(c);
  };
  walk(rootId);
  return out;
}

export function nextFrameName(nodes: Record<string, { name: string }>): string {
  let max = 0;
  const re = /^Frame (\d+)$/;
  for (const n of Object.values(nodes)) {
    const m = re.exec(n.name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Frame ${max + 1}`;
}

export function nextCopyName(nodes: Record<string, { name: string }>, base: string): string {
  if (!nodesHasName(nodes, `${base} Copy`)) return `${base} Copy`;
  let i = 2;
  while (nodesHasName(nodes, `${base} Copy ${i}`)) i++;
  return `${base} Copy ${i}`;
}

/** Duplicate root label: "Copy", "Copy 2", … (unique in the document). */
/** @deprecated Use `nextDuplicatedLayerName` with the source layer name. */
export function nextDuplicateName(
  nodes: Record<string, { name: string }>,
  sourceName = "Layer",
): string {
  return nextDuplicatedLayerName(nodes, sourceName);
}

function nodesHasName(nodes: Record<string, { name: string }>, name: string): boolean {
  return Object.values(nodes).some((n) => n.name === name);
}
