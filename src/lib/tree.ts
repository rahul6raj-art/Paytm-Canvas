import type { EditorNode, NodeKind } from "@/stores/useEditorStore";
import { maskGroupChildHitOrder } from "@/lib/booleanGeometry";
import { isAncestorOf } from "@/lib/editorGraph";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  applyMatrixToPoint,
  getNodeTransformedWorldBounds,
  getNodeWorldInverseMatrix,
  getNodeWorldMatrix,
  pointInNodeWorldBounds,
  worldToParentLocal,
} from "@/lib/transformMath";

export function worldRect(
  id: string,
  nodes: Record<string, EditorNode>,
): { x: number; y: number; width: number; height: number } {
  return getNodeTransformedWorldBounds(id, nodes);
}

/** World-space top-left for a new root-level layer centered on the click. */
export function worldCenteredRootPoint(
  worldX: number,
  worldY: number,
  nodeWidth: number,
  nodeHeight: number,
): { x: number; y: number } {
  return {
    x: worldX - nodeWidth / 2,
    y: worldY - nodeHeight / 2,
  };
}

/** Parent-local top-left for a new layer centered on the click (no clamping). */
export function centeredLocalPointInParent(
  worldX: number,
  worldY: number,
  parentId: string | null,
  nodes: Record<string, EditorNode>,
  nodeWidth: number,
  nodeHeight: number,
): { x: number; y: number } {
  const local = worldPointToParentLocal(worldX, worldY, parentId, nodes);
  return {
    x: local.x - nodeWidth / 2,
    y: local.y - nodeHeight / 2,
  };
}

/** Bounds for shape insert parenting (world-space top-left + size). */
export type ShapeInsertBounds = { x: number; y: number; width: number; height: number };

/**
 * Frame to parent a newly drawn shape into.
 * Tries shape center/corners, then the selected layer's parent frame.
 */
export function resolveFrameParentForShapeInsert(
  bounds: ShapeInsertBounds,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  selectedIds: string[],
): string | null {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const samplePoints = [
    { x: cx, y: cy },
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
  for (const p of samplePoints) {
    const frameId = frameParentAtWorldPoint(p.x, p.y, nodes, childOrder);
    if (frameId) return frameId;
  }

  for (const sid of selectedIds) {
    let walk: string | null = sid;
    const seen = new Set<string>();
    while (walk && !seen.has(walk)) {
      seen.add(walk);
      const n = nodes[walk];
      if (!n) break;
      if (n.type === "frame" && n.visible && !n.locked) return walk;
      walk = n.parentId;
    }
  }

  return null;
}

/** Deepest unlocked visible frame under the point, if any. */
export function frameParentAtWorldPoint(
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string | null {
  const atPoint = pickDeepestFrameAtWorldPoint(worldX, worldY, nodes, childOrder);
  if (!atPoint) return null;
  const n = nodes[atPoint];
  if (n?.type === "frame" && n.visible && !n.locked) return atPoint;
  return null;
}

/** Parent-local top-left for a new layer, centered on the click and clamped inside the frame. */
export function clampInsertLocalPoint(
  worldX: number,
  worldY: number,
  frameRect: { x: number; y: number; width: number; height: number },
  nodeWidth: number,
  nodeHeight: number,
): { x: number; y: number } {
  const lx = worldX - frameRect.x - nodeWidth / 2;
  const ly = worldY - frameRect.y - nodeHeight / 2;
  const maxX = Math.max(0, frameRect.width - nodeWidth);
  const maxY = Math.max(0, frameRect.height - nodeHeight);
  return {
    x: Math.min(maxX, Math.max(0, lx)),
    y: Math.min(maxY, Math.max(0, ly)),
  };
}

/** World-space point → immediate parent's local coordinates for a child node. */
export function worldToLocalForNode(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
): { x: number; y: number } {
  return worldToParentLocal(worldX, worldY, nodeId, nodes);
}

/** Convert a world-space point into coordinates relative to `parentId`'s top-left (null = canvas / root). */
export function worldPointToParentLocal(
  worldX: number,
  worldY: number,
  parentId: string | null,
  nodes: Record<string, EditorNode>,
): { x: number; y: number } {
  if (!parentId) return { x: worldX, y: worldY };
  const inv = getNodeWorldInverseMatrix(parentId, nodes);
  if (!inv) {
    const pw = worldRect(parentId, nodes);
    return { x: worldX - pw.x, y: worldY - pw.y };
  }
  return applyMatrixToPoint(inv, { x: worldX, y: worldY });
}

/** Deepest frame/group under the point (top-most in z-order). Excludes `excludeDescendantsOf` subtree. */
export function pickDeepestFrameOrGroupAtWorldPoint(
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  opts: { excludeDescendantsOf?: string | null },
): string | null {
  const ex = opts.excludeDescendantsOf;
  const inRect = (nid: string) => pointInNodeWorldBounds(worldX, worldY, nid, nodes);
  const skip = (nid: string) =>
    Boolean(ex && (nid === ex || isAncestorOf(nodes, ex, nid)));

  function dfs(nid: string): string | null {
    if (!inRect(nid) || skip(nid)) return null;
    const n = nodes[nid];
    const rawKids = childOrder[nid] ?? [];
    const kids =
      n?.type === "group" && n.maskId ? maskGroupChildHitOrder(n, rawKids) : rawKids;
    for (const k of [...kids].reverse()) {
      const hit = dfs(k);
      if (hit) return hit;
    }
    if (n?.type === "frame" || n?.type === "group") return nid;
    return null;
  }
  const roots = [...(childOrder[EDITOR_ROOT_KEY] ?? [])].reverse();
  for (const r of roots) {
    const hit = dfs(r);
    if (hit) return hit;
  }
  return null;
}

/** Deepest `frame` under the point (walks up from frame/group hit). */
export function pickDeepestFrameAtWorldPoint(
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  opts: { excludeDescendantsOf?: string | null } = {},
): string | null {
  const hit = pickDeepestFrameOrGroupAtWorldPoint(worldX, worldY, nodes, childOrder, opts);
  if (!hit) return null;
  let cur: string | null = hit;
  while (cur) {
    const n: EditorNode | undefined = nodes[cur];
    if (n?.type === "frame") return cur;
    cur = n?.parentId ?? null;
  }
  return null;
}

/** Deepest visible node under the point (top-most in z-order). Optional `types` filters leaf hits. */
export function pickDeepestNodeAtWorldPoint(
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  opts?: { types?: NodeKind[] },
): string | null {
  const types = opts?.types;
  function dfs(nid: string): string | null {
    const n = nodes[nid];
    if (!n?.visible) return null;
    if (!pointInNodeWorldBounds(worldX, worldY, nid, nodes)) return null;
    const kids = maskGroupChildHitOrder(n, childOrder[nid] ?? []);
    for (const k of [...kids].reverse()) {
      const h = dfs(k);
      if (h) return h;
    }
    if (types && !types.includes(n.type)) return null;
    return nid;
  }
  const roots = [...(childOrder[EDITOR_ROOT_KEY] ?? [])].reverse();
  for (const r of roots) {
    const h = dfs(r);
    if (h) return h;
  }
  return null;
}

/** Frame to insert new layers into — prefers artboard under `world`, then selection, then first root frame. */
export function targetFrameForInsert(
  state: Pick<{ nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; selectedIds: string[] }, "nodes" | "childOrder" | "selectedIds">,
  world?: { x: number; y: number },
): string {
  if (world) {
    const atPoint = pickDeepestFrameAtWorldPoint(world.x, world.y, state.nodes, state.childOrder);
    if (atPoint) {
      const n = state.nodes[atPoint];
      if (n?.type === "frame" && n.visible && !n.locked) return atPoint;
    }
  }
  const roots = state.childOrder[EDITOR_ROOT_KEY] ?? [];
  if (state.selectedIds.length >= 1) {
    let cur: string | undefined = state.selectedIds[0];
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const n: EditorNode | undefined = state.nodes[cur];
      if (!n) break;
      if (n.type === "frame" && n.visible && !n.locked) return cur;
      cur = n.parentId ?? undefined;
    }
  }
  const first = roots[0];
  if (first && state.nodes[first]?.type === "frame") return first;
  return first ?? "";
}

/** Deepest visible node (any type) under the point, top-most in z-order. */
export function pickDeepestVisibleNodeAtWorldPoint(
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string | null {
  return pickDeepestNodeAtWorldPoint(worldX, worldY, nodes, childOrder);
}
