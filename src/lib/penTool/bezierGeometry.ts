import type { PathPoint } from "@/lib/pathGeometry";
import { newPathPointId } from "@/lib/pathGeometry";
import {
  appendCubicSegmentD,
  cubicControlPoints,
  cubicPathD,
  previewSegmentBetween,
  segmentUsesCubicBezier,
  type CubicPoint,
} from "@/lib/vector/bezierGeometry";

export type { CubicPoint } from "@/lib/vector/bezierGeometry";
export {
  appendCubicSegmentD,
  cubicControlPoints,
  cubicPathD,
  previewSegmentBetween,
  segmentUsesCubicBezier,
} from "@/lib/vector/bezierGeometry";

export const PEN_HANDLE_MAX_SEGMENT_RATIO = 0.6;

type XY = { x: number; y: number };

export function maxHandleLengthForSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  ratio = PEN_HANDLE_MAX_SEGMENT_RATIO,
): number {
  return Math.hypot(bx - ax, by - ay) * ratio;
}

/** Clamp handle vector length to avoid exaggerated curves. */
export function clampHandleVector(dx: number, dy: number, maxLength: number): XY {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6 || len <= maxLength) return { x: dx, y: dy };
  const s = maxLength / len;
  return { x: dx * s, y: dy * s };
}

/**
 * Handle vectors from click-drag at anchor toward drag pointer.
 * dx/dy are relative to the anchor (handleOut direction); handleIn = mirror.
 */
export function placementHandleVectors(
  anchor: XY,
  drag: XY,
  previousAnchor: XY | null,
): { hx: number; hy: number } {
  let dx = drag.x - anchor.x;
  let dy = drag.y - anchor.y;
  if (previousAnchor) {
    const maxLen = maxHandleLengthForSegment(
      previousAnchor.x,
      previousAnchor.y,
      anchor.x,
      anchor.y,
    );
    ({ x: dx, y: dy } = clampHandleVector(dx, dy, maxLen));
  }
  return { hx: dx, hy: dy };
}

/** Normalize -0 to 0 for stable handle storage. */
function normalizeCoord(n: number): number {
  return n === 0 ? 0 : n;
}

export function smoothHandlesFromDragVector(hx: number, hy: number): {
  handleIn: XY;
  handleOut: XY;
} {
  return {
    handleIn: { x: normalizeCoord(-hx), y: normalizeCoord(-hy) },
    handleOut: { x: normalizeCoord(hx), y: normalizeCoord(hy) },
  };
}

/** Corner point: no handles. */
export function buildCornerPathPoint(x: number, y: number, id?: string): PathPoint {
  return {
    id: id ?? newPathPointId(),
    x,
    y,
    pointType: "corner",
  };
}

/** Smooth point + previous out-handle patch from click-drag placement (local coords). */
export function buildSmoothPathPointFromDrag(
  prev: PathPoint,
  anchorLocal: XY,
  dragLocal: XY,
): { prevPatch: Pick<PathPoint, "handleOut" | "pointType">; newPoint: PathPoint } {
  const { hx, hy } = placementHandleVectors(anchorLocal, dragLocal, prev);
  const handles = smoothHandlesFromDragVector(hx, hy);
  return {
    prevPatch: {
      handleOut: { x: hx, y: hy },
      pointType: prev.pointType ?? "corner",
    },
    newPoint: {
      id: newPathPointId(),
      x: anchorLocal.x,
      y: anchorLocal.y,
      pointType: "smooth",
      handleIn: handles.handleIn,
      handleOut: handles.handleOut,
    },
  };
}

/** World-space points for in-progress click-drag (matches store commit geometry). */
export function buildPlacementPreviewPoints(
  committed: readonly CubicPoint[],
  anchor: XY,
  drag: XY,
): CubicPoint[] {
  if (committed.length === 0) return [{ x: anchor.x, y: anchor.y }];
  const prev = committed[committed.length - 1]!;
  const { hx, hy } = placementHandleVectors(anchor, drag, prev);
  const handles = smoothHandlesFromDragVector(hx, hy);
  return [
    ...committed.slice(0, -1),
    { ...prev, handleOut: { x: hx, y: hy } },
    {
      x: anchor.x,
      y: anchor.y,
      handleIn: handles.handleIn,
      handleOut: handles.handleOut,
    },
  ];
}

/** Preview segment while drawing: last committed → hover or placement anchor. */
export function buildLivePreviewSegment(
  last: CubicPoint,
  target: XY,
  placement: { anchor: XY; drag: XY } | null,
): { path: string; isCurve: boolean } {
  if (placement) {
    const { hx, hy } = placementHandleVectors(placement.anchor, placement.drag, last);
    const handles = smoothHandlesFromDragVector(hx, hy);
    return previewSegmentBetween(
      { ...last, handleOut: { x: hx, y: hy } },
      {
        x: placement.anchor.x,
        y: placement.anchor.y,
        handleIn: handles.handleIn,
      },
    );
  }
  return previewSegmentBetween(last, {
    x: target.x,
    y: target.y,
    handleIn: null,
    handleOut: null,
  });
}
