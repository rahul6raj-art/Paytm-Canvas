import { VIEWPORT_MAX_ROOT_DIMENSION } from "@/lib/canvasZoom";
import { finiteCoord, finiteDimension } from "@/lib/transformMath";
import type { Bounds } from "@/lib/resize";
import type { EditorNode } from "@/stores/useEditorStore";

/** Hard ceiling for layer width/height (prevents resize/overflow runaway). */
export const MAX_NODE_DIMENSION = VIEWPORT_MAX_ROOT_DIMENSION;

/** Clamp a resize pointer to a sane box around the starting bounds. */
export function clampResizePointerLocal(
  point: { x: number; y: number },
  startBounds: Bounds,
  zeroOrigin: boolean,
): { x: number; y: number } {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    const cx = zeroOrigin ? startBounds.width / 2 : startBounds.x + startBounds.width / 2;
    const cy = zeroOrigin ? startBounds.height / 2 : startBounds.y + startBounds.height / 2;
    return { x: cx, y: cy };
  }
  const bx = zeroOrigin ? 0 : startBounds.x;
  const by = zeroOrigin ? 0 : startBounds.y;
  const pad = Math.max(4_000, startBounds.width * 8, startBounds.height * 8, MAX_NODE_DIMENSION);
  return {
    x: Math.max(bx - pad, Math.min(bx + startBounds.width + pad, point.x)),
    y: Math.max(by - pad, Math.min(by + startBounds.height + pad, point.y)),
  };
}

export function clampNodeDimensions(
  width: number,
  height: number,
  refWidth: number,
  refHeight: number,
  minWidth = 1,
  minHeight = minWidth,
): { width: number; height: number } {
  const refW = Math.max(minWidth, refWidth);
  const refH = Math.max(minHeight, refHeight);
  const maxW = Math.max(MAX_NODE_DIMENSION, refW * 50);
  const maxH = Math.max(MAX_NODE_DIMENSION, refH * 50);
  const w = Number.isFinite(width) ? Math.min(Math.max(minWidth, width), maxW) : refW;
  const h = Number.isFinite(height) ? Math.min(Math.max(minHeight, height), maxH) : refH;
  return {
    width: finiteDimension(w, minWidth),
    height: finiteDimension(h, minHeight),
  };
}

export function clampNodePosition(x: number, y: number, fallback: { x: number; y: number }): {
  x: number;
  y: number;
} {
  const lim = MAX_NODE_DIMENSION * 4;
  const fx = finiteCoord(fallback.x);
  const fy = finiteCoord(fallback.y);
  const cx = Number.isFinite(x) ? Math.max(-lim, Math.min(lim, x)) : fx;
  const cy = Number.isFinite(y) ? Math.max(-lim, Math.min(lim, y)) : fy;
  return { x: finiteCoord(cx, fx), y: finiteCoord(cy, fy) };
}

/** Clamp node x/y/width/height to sane editor limits (last line of defense). */
export function sanitizeNodeGeometry(
  node: EditorNode,
  ref?: Pick<EditorNode, "width" | "height">,
  opts?: { minDimension?: number },
): EditorNode {
  const baseMin = opts?.minDimension ?? 1;
  let minW = baseMin;
  let minH = baseMin;
  if (node.type === "path") {
    minW = 0;
    minH = 0;
  } else if (node.type === "line" || node.type === "arrow") {
    minH = 0;
  }
  const refW = ref?.width ?? (Number.isFinite(node.width) && node.width > 0 ? node.width : minW);
  const refH = ref?.height ?? (Number.isFinite(node.height) && node.height > 0 ? node.height : minH);
  const { width, height } = clampNodeDimensions(node.width, node.height, refW, refH, minW, minH);
  const { x, y } = clampNodePosition(node.x, node.y, { x: node.x, y: node.y });
  if (node.x === x && node.y === y && node.width === width && node.height === height) return node;
  return { ...node, x, y, width, height };
}
