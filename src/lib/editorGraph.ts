import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  applyMatrixToPoint,
  getNodeTransformedWorldBounds,
  getNodeWorldInverseMatrix,
  worldRectSum,
} from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";

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

/** Parent map from childOrder (matches what DomSceneRenderer actually mounts). */
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

function worldPointToParentLocalGraph(
  worldX: number,
  worldY: number,
  parentId: string,
  nodes: Record<string, EditorNode>,
): { x: number; y: number } {
  const inv = getNodeWorldInverseMatrix(parentId, nodes);
  if (!inv) {
    const pw = worldRectSum(parentId, nodes);
    return { x: worldX - pw.x, y: worldY - pw.y };
  }
  return applyMatrixToPoint(inv, { x: worldX, y: worldY });
}

function nodeCenterLooksLikeWorldCoordsInParent(
  node: EditorNode,
  parentId: string,
  nodes: Record<string, EditorNode>,
): boolean {
  const pb = getNodeTransformedWorldBounds(parentId, nodes);
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
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

    if (nodeCenterLooksLikeWorldCoordsInParent(n, want, out)) {
      const local = worldPointToParentLocalGraph(n.x, n.y, want, out);
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

/**
 * Fix hierarchy desync: childOrder drives rendering; parentId drives world bounds / selection.
 * Prefer nodes[].parentId for placement; only copy from childOrder when parentId is null.
 */
export function repairNodeHierarchy(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  const deduped = dedupeChildOrderLists(nodes, childOrder);
  const nodesSynced = syncParentIdsFromChildOrderIfNull(nodes, deduped);
  const co = reconcileChildOrderWithParents(nodesSynced, deduped);
  return { nodes: nodesSynced, childOrder: co };
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

export function needsNodeHierarchyRepair(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  return needsChildOrderReconcile(nodes, childOrder);
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
export function nextDuplicateName(nodes: Record<string, { name: string }>): string {
  if (!nodesHasName(nodes, "Copy")) return "Copy";
  let i = 2;
  while (nodesHasName(nodes, `Copy ${i}`)) i++;
  return `Copy ${i}`;
}

function nodesHasName(nodes: Record<string, { name: string }>, name: string): boolean {
  return Object.values(nodes).some((n) => n.name === name);
}
