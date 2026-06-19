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
  pointerAngleRad,
  shortestAngleDeltaDegrees,
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
  /** Frozen at drag start — rotation must not change size or position. */
  startGeom: { x: number; y: number; width: number; height: number };
  /** Updated each pointer move — cumulative delta avoids ±360° jumps at atan2 wrap. */
  lastPointerAngleRad: number;
  accumulatedDeltaDeg: number;
};

export type MultiRotateSession = {
  kind: "multi";
  startAngle: number;
  centerWorld: { x: number; y: number };
  items: RotateDragItem[];
  lastPointerAngleRad: number;
  accumulatedDeltaDeg: number;
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
  const startAngle = pointerAngleRad(pointerWorld, centerWorld);
  return {
    kind: "single",
    id: nodeId,
    startRotation: node.rotation ?? 0,
    startAngle,
    centerWorld,
    startGeom: { x: node.x, y: node.y, width: node.width, height: node.height },
    lastPointerAngleRad: startAngle,
    accumulatedDeltaDeg: 0,
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
  const startAngle = pointerAngleRad(pointerWorld, centerWorld);
  return {
    kind: "multi",
    startAngle,
    centerWorld,
    items,
    lastPointerAngleRad: startAngle,
    accumulatedDeltaDeg: 0,
  };
}

function accumulatePointerRotationDelta(
  session: Pick<SingleRotateSession, "lastPointerAngleRad" | "accumulatedDeltaDeg">,
  pointerWorld: { x: number; y: number },
  centerWorld: { x: number; y: number },
): number {
  const angle = pointerAngleRad(pointerWorld, centerWorld);
  session.accumulatedDeltaDeg += shortestAngleDeltaDegrees(session.lastPointerAngleRad, angle);
  session.lastPointerAngleRad = angle;
  return session.accumulatedDeltaDeg;
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
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { id: string; rotation: number; x: number; y: number } {
  const delta = accumulatePointerRotationDelta(session, pointerWorld, session.centerWorld);
  let next = normalizeRotationDegrees(session.startRotation + delta);
  next = snapRotationDegrees(next, shiftKey);
  const { startGeom } = session;
  return {
    id: session.id,
    rotation: next,
    x: startGeom.x,
    y: startGeom.y,
  };
}

export function applyMultiRotatePatches(
  session: MultiRotateSession,
  pointerWorld: { x: number; y: number },
  shiftKey: boolean,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, { x: number; y: number; rotation: number }> {
  let delta = accumulatePointerRotationDelta(session, pointerWorld, session.centerWorld);
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
  _pointerWorld: { x: number; y: number },
  shiftKey: boolean,
): number {
  let next = normalizeRotationDegrees(session.startRotation + session.accumulatedDeltaDeg);
  next = snapRotationDegrees(next, shiftKey);
  return next;
}

/** Live angle label for multi rotate (delta applied to selection). */
export function multiRotateLabelDegrees(
  session: MultiRotateSession,
  _pointerWorld: { x: number; y: number },
  shiftKey: boolean,
): number {
  let delta = snapRotationDeltaDegrees(session.accumulatedDeltaDeg, shiftKey);
  return normalizeRotationDegrees(delta);
}
