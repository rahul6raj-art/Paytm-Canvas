import { canSwapAutoLayoutSiblings } from "@/lib/autoLayoutArrowReorder";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  getRenderedWorldBounds,
  getRenderedWorldOrigin,
  isAncestorOf,
  pointInNodeRenderedWorldBounds,
  topLevelSelectedIds,
  worldOriginToNodeXYFromChildOrder,
} from "@/lib/editorGraph";
import { pickDeepestVisibleNodeAtWorldPoint } from "@/lib/tree";

function parentAllowsSwap(
  parentId: string | null,
  nodes: Record<string, EditorNode>,
): boolean {
  if (!parentId) return true;
  const parent = nodes[parentId];
  if (!parent || !parent.visible || parent.locked) return false;
  if ((parent.layoutMode ?? "none") !== "none") return false;
  return true;
}

/** Whether two layers can exchange positions (Figma-style swap). */
export function canSwapNodes(
  idA: string,
  idB: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  if (idA === idB) return false;
  const a = nodes[idA];
  const b = nodes[idB];
  if (!a || !b || !a.visible || !b.visible || a.locked || b.locked) return false;
  if (a.parentId !== b.parentId) return false;
  if (isAncestorOf(nodes, idA, idB) || isAncestorOf(nodes, idB, idA)) return false;
  if (canSwapAutoLayoutSiblings(idA, idB, nodes)) return true;
  return parentAllowsSwap(a.parentId, nodes);
}

/** Other selected top-level layers the node can swap with. */
export function swapCandidatesForMultiSelect(
  nodeId: string,
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  const tops = topLevelSelectedIds(selectedIds, nodes);
  if (tops.length < 2 || !tops.includes(nodeId)) return [];
  return tops.filter(
    (id) => id !== nodeId && canSwapNodes(nodeId, id, nodes, childOrder),
  );
}

/** Top-level selected layers that show a swap handle (2+ selection with at least one partner). */
export function multiSelectSwapHandleIds(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && n.visible && !n.locked;
  });
  if (tops.length < 2) return [];
  return tops.filter(
    (id) => swapCandidatesForMultiSelect(id, selectedIds, nodes, childOrder).length > 0,
  );
}

export function swapHandleWorldCenter(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  const bounds = getRenderedWorldBounds(nodeId, nodes, childOrder);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

/** When exactly two top-level layers are selected, return the partner of the clicked node. */
export function swapPartnerForMultiSelect(
  nodeId: string,
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): string | undefined {
  const tops = topLevelSelectedIds(selectedIds, nodes);
  if (tops.length !== 2 || !tops.includes(nodeId)) return undefined;
  return tops.find((id) => id !== nodeId);
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

export function findSwapTargetAtPoint(
  movingId: string,
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  swapCandidateIds?: readonly string[],
): string | null {
  if (swapCandidateIds?.length) {
    const hit = pickDeepestVisibleNodeAtWorldPoint(worldX, worldY, nodes, childOrder);
    if (
      hit &&
      hit !== movingId &&
      swapCandidateIds.includes(hit) &&
      canSwapNodes(movingId, hit, nodes, childOrder)
    ) {
      return hit;
    }
    for (const candidateId of swapCandidateIds) {
      if (
        canSwapNodes(movingId, candidateId, nodes, childOrder) &&
        pointInNodeRenderedWorldBounds(worldX, worldY, candidateId, nodes, childOrder)
      ) {
        return candidateId;
      }
    }
    return null;
  }

  const hit = pickDeepestVisibleNodeAtWorldPoint(worldX, worldY, nodes, childOrder);
  if (!hit || hit === movingId) return null;
  if (!canSwapNodes(movingId, hit, nodes, childOrder)) return null;
  return hit;
}

export type WorldPoint = { x: number; y: number };

/** Exchange rendered world origins (positions at drag start). */
export function swapNodeWorldPositions(
  idA: string,
  idB: string,
  worldA: WorldPoint,
  worldB: WorldPoint,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { nodes: Record<string, EditorNode> } {
  const xyA = worldOriginToNodeXYFromChildOrder(idA, nodes, childOrder, worldB);
  const xyB = worldOriginToNodeXYFromChildOrder(idB, nodes, childOrder, worldA);
  return {
    nodes: {
      ...nodes,
      [idA]: { ...nodes[idA]!, x: xyA.x, y: xyA.y },
      [idB]: { ...nodes[idB]!, x: xyB.x, y: xyB.y },
    },
  };
}

export function getSwapTargetBounds(
  targetId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number; width: number; height: number } {
  return getRenderedWorldBounds(targetId, nodes, childOrder);
}

/** World center of a layer as it was at drag-start (from captured origin). */
export function worldCenterAtCapturedOrigin(
  nodeId: string,
  origin: WorldPoint,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  const bounds = getRenderedWorldBounds(nodeId, nodes, childOrder);
  const cur = getRenderedWorldOrigin(nodeId, nodes, childOrder);
  return {
    x: bounds.x + bounds.width / 2 + (origin.x - cur.x),
    y: bounds.y + bounds.height / 2 + (origin.y - cur.y),
  };
}

/** Resolve swap partner on drop (pointer over partner or sufficient overlap). */
export function resolveSwapDropTarget(
  movingId: string,
  swapCandidateIds: readonly string[] | undefined,
  lastSwapTargetId: string | null | undefined,
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string | null {
  if (!swapCandidateIds?.length) {
    if (lastSwapTargetId && canSwapNodes(movingId, lastSwapTargetId, nodes, childOrder)) {
      return lastSwapTargetId;
    }
    return null;
  }

  const atPoint = findSwapTargetAtPoint(
    movingId,
    worldX,
    worldY,
    nodes,
    childOrder,
    swapCandidateIds,
  );
  if (atPoint) return atPoint;

  const a = getRenderedWorldBounds(movingId, nodes, childOrder);
  let best: { id: string; overlap: number } | null = null;
  for (const candidateId of swapCandidateIds) {
    if (!canSwapNodes(movingId, candidateId, nodes, childOrder)) continue;
    const b = getRenderedWorldBounds(candidateId, nodes, childOrder);
    const overlap = rectOverlapArea(a, b);
    const minArea = Math.min(a.width * a.height, b.width * b.height);
    if (minArea > 0 && overlap / minArea >= 0.3) {
      if (!best || overlap > best.overlap) best = { id: candidateId, overlap };
    }
  }
  if (best) return best.id;

  if (lastSwapTargetId && swapCandidateIds.includes(lastSwapTargetId)) {
    return lastSwapTargetId;
  }
  return null;
}

export function captureSwapWorldOrigins(
  ids: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, WorldPoint> {
  const out: Record<string, WorldPoint> = {};
  for (const id of ids) {
    out[id] = getRenderedWorldOrigin(id, nodes, childOrder);
  }
  return out;
}
