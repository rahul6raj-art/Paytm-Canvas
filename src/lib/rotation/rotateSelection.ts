import {
  applyMatrixToPoint,
  normalizeRotationDegrees,
  rotatePointAroundCenter,
} from "@/lib/transformMath";
import {
  getNodeWorldMatrixFromChildOrder,
  getRenderedWorldBounds,
  topLevelSelectedIds,
  worldCenterToNodeXYFromChildOrder,
} from "@/lib/editorGraph";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  rotationDeltaDegrees,
  snapRotationDeltaDegrees,
  snapRotationDegrees,
} from "./rotateMath";

export type RotateDragItem = {
  id: string;
  startRotation: number;
  startWorldCenter: { x: number; y: number };
};

export type SingleRotateSession = {
  kind: "single";
  id: string;
  startRotation: number;
  startAngle: number;
  centerWorld: { x: number; y: number };
};

export type MultiRotateSession = {
  kind: "multi";
  startAngle: number;
  centerWorld: { x: number; y: number };
  items: RotateDragItem[];
};

export type RotateDragSession = SingleRotateSession | MultiRotateSession;

export function unionBoundsCenter(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number } {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function createSingleRotateSession(
  nodeId: string,
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  pointerWorld: { x: number; y: number },
): SingleRotateSession {
  const centerWorld = getNodeWorldCenterFromChildOrder(nodeId, nodes, childOrder);
  return {
    kind: "single",
    id: nodeId,
    startRotation: node.rotation ?? 0,
    startAngle: Math.atan2(
      pointerWorld.y - centerWorld.y,
      pointerWorld.x - centerWorld.x,
    ),
    centerWorld,
  };
}

export function createMultiRotateSession(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  union: { x: number; y: number; width: number; height: number },
  pointerWorld: { x: number; y: number },
): MultiRotateSession {
  const tops = topLevelSelectedIds(selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && !n.locked && n.visible;
  });
  const centerWorld = unionBoundsCenter(union);
  const items: RotateDragItem[] = tops.map((id) => ({
    id,
    startRotation: nodes[id]!.rotation ?? 0,
    startWorldCenter: getNodeWorldCenterFromChildOrder(id, nodes, childOrder),
  }));
  return {
    kind: "multi",
    startAngle: Math.atan2(
      pointerWorld.y - centerWorld.y,
      pointerWorld.x - centerWorld.x,
    ),
    centerWorld,
    items,
  };
}

/** Geometric center of a node in world space (transform pivot). */
export function getNodeWorldCenterFromChildOrder(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  const n = nodes[nodeId];
  if (!n) return { x: 0, y: 0 };
  const wm = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (!wm) {
    const b = getRenderedWorldBounds(nodeId, nodes, childOrder);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  const w = Math.max(1, n.width);
  const h = Math.max(1, n.height);
  return applyMatrixToPoint(wm, { x: w / 2, y: h / 2 });
}

export function applySingleRotate(
  session: SingleRotateSession,
  pointerWorld: { x: number; y: number },
  shiftKey: boolean,
): { id: string; rotation: number } {
  const delta = rotationDeltaDegrees(pointerWorld, session.centerWorld, session.startAngle);
  let next = normalizeRotationDegrees(session.startRotation + delta);
  next = snapRotationDegrees(next, shiftKey);
  return { id: session.id, rotation: next };
}

export function applyMultiRotatePatches(
  session: MultiRotateSession,
  pointerWorld: { x: number; y: number },
  shiftKey: boolean,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, { x: number; y: number; rotation: number }> {
  let delta = rotationDeltaDegrees(pointerWorld, session.centerWorld, session.startAngle);
  delta = snapRotationDeltaDegrees(delta, shiftKey);

  const patches: Record<string, { x: number; y: number; rotation: number }> = {};
  for (const item of session.items) {
    const n = nodes[item.id];
    if (!n) continue;
    const newRotation = normalizeRotationDegrees(item.startRotation + delta);
    const newCenter = rotatePointAroundCenter(
      item.startWorldCenter,
      session.centerWorld,
      delta,
    );
    const xy = worldCenterToNodeXYFromChildOrder(
      item.id,
      nodes,
      childOrder,
      newCenter,
      newRotation,
      { x: n.x, y: n.y },
    );
    patches[item.id] = { x: xy.x, y: xy.y, rotation: newRotation };
  }
  return patches;
}

/** Live angle label for single-node rotate (absolute rotation). */
export function singleRotateLabelDegrees(
  session: SingleRotateSession,
  pointerWorld: { x: number; y: number },
  shiftKey: boolean,
): number {
  return applySingleRotate(session, pointerWorld, shiftKey).rotation;
}

/** Live angle label for multi rotate (delta applied to selection). */
export function multiRotateLabelDegrees(
  session: MultiRotateSession,
  pointerWorld: { x: number; y: number },
  shiftKey: boolean,
): number {
  let delta = rotationDeltaDegrees(pointerWorld, session.centerWorld, session.startAngle);
  delta = snapRotationDeltaDegrees(delta, shiftKey);
  return normalizeRotationDegrees(delta);
}
