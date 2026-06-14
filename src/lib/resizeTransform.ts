import { getNodeWorldMatrixFromChildOrder } from "@/lib/editorGraph";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  applyMatrixToPoint,
  finiteCoord,
  getNodeLocalMatrix,
  getNodeWorldMatrix,
  hasRotation,
  invertMatrix,
  matrixHasRotation,
  multiplyMatrix,
  resolveParentId,
} from "@/lib/transformMath";
import type { Bounds, ResizeHandle } from "@/lib/resize";

export function isCornerHandle(handle: ResizeHandle): boolean {
  return handle === "nw" || handle === "ne" || handle === "se" || handle === "sw";
}

/** Local point that stays fixed in world space while dragging `handle`. */
export function getResizeAnchorLocal(
  handle: ResizeHandle,
  width: number,
  height: number,
): { x: number; y: number } {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  switch (handle) {
    case "se":
      return { x: 0, y: 0 };
    case "nw":
      return { x: w, y: h };
    case "ne":
      return { x: 0, y: h };
    case "sw":
      return { x: w, y: 0 };
    case "e":
      return { x: 0, y: h / 2 };
    case "w":
      return { x: w, y: h / 2 };
    case "n":
      return { x: w / 2, y: h };
    case "s":
      return { x: w / 2, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

export function anchorWorldAtBounds(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  handle: ResizeHandle,
  bounds: Bounds,
): { x: number; y: number } | null {
  const n = nodes[nodeId];
  if (!n) return null;
  const wm = getNodeWorldMatrix(nodeId, nodes);
  if (!wm) return null;
  const anchorLocal = getResizeAnchorLocal(handle, bounds.width, bounds.height);
  return applyMatrixToPoint(wm, anchorLocal);
}

/** Same anchor as anchorWorldAtBounds but uses the childOrder render tree. */
export function anchorWorldAtBoundsFromChildOrder(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  handle: ResizeHandle,
  bounds: Bounds,
): { x: number; y: number } | null {
  const wm = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (!wm) return anchorWorldAtBounds(nodeId, nodes, handle, bounds);
  const anchorLocal = getResizeAnchorLocal(handle, bounds.width, bounds.height);
  return applyMatrixToPoint(wm, anchorLocal);
}

function localPointToWorld(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  localPoint: { x: number; y: number },
): { x: number; y: number } {
  const parentId = resolveParentId(node.parentId);
  const localM = getNodeLocalMatrix(node);
  if (!parentId || !nodes[parentId]) {
    return applyMatrixToPoint(localM, localPoint);
  }
  const parentWorld = getNodeWorldMatrix(parentId, nodes);
  if (!parentWorld) return applyMatrixToPoint(localM, localPoint);
  return applyMatrixToPoint(multiplyMatrix(parentWorld, localM), localPoint);
}

/** Keep a world-space anchor fixed while updating width/height on rotated nodes. */
export function solveNodeXYForAnchorWorld(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  width: number,
  height: number,
  anchorLocal: { x: number; y: number },
  anchorWorld: { x: number; y: number },
  seedXY: { x: number; y: number },
): { x: number; y: number } {
  const parentId = resolveParentId(node.parentId);
  const parentWorld = parentId && nodes[parentId] ? getNodeWorldMatrix(parentId, nodes) : null;
  const parentRotated = parentWorld ? matrixHasRotation(parentWorld) : false;
  if (!hasRotation(node.rotation) && !parentRotated) return seedXY;

  let x = seedXY.x;
  let y = seedXY.y;
  const parentInv = parentWorld ? invertMatrix(parentWorld) : null;

  for (let i = 0; i < 24; i++) {
    const trial = { ...node, x, y, width, height };
    const got = localPointToWorld(trial, nodes, anchorLocal);
    const dx = anchorWorld.x - got.x;
    const dy = anchorWorld.y - got.y;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) break;

    if (parentInv) {
      const atGot = applyMatrixToPoint(parentInv, got);
      const atTarget = applyMatrixToPoint(parentInv, { x: got.x + dx, y: got.y + dy });
      x += atTarget.x - atGot.x;
      y += atTarget.y - atGot.y;
    } else {
      x += dx;
      y += dy;
    }
  }

  return {
    x: Number.isFinite(x) ? x : finiteCoord(seedXY.x, finiteCoord(node.x)),
    y: Number.isFinite(y) ? y : finiteCoord(seedXY.y, finiteCoord(node.y)),
  };
}
