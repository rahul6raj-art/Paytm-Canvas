import type { PathPoint } from "@/lib/pathGeometry";
import { pathPointsToWorldPoints, type WorldPathPoint } from "./coordinates";
import {
  buildLivePreviewSegment,
  buildPlacementPreviewPoints,
  cubicPathD,
  type CubicPoint,
} from "./bezierGeometry";
import type { PenPlacement } from "./types";

export type { CubicPoint } from "./bezierGeometry";
export {
  appendCubicSegmentD,
  buildCornerPathPoint,
  buildSmoothPathPointFromDrag,
  cubicControlPoints,
  cubicPathD,
  placementHandleVectors,
  segmentUsesCubicBezier,
  smoothHandlesFromDragVector,
  PEN_HANDLE_MAX_SEGMENT_RATIO,
} from "./bezierGeometry";

/** Build SVG path `d` for world-space points (same cubic logic as committed path). */
export function penPreviewPathD(points: readonly WorldPathPoint[]): string {
  return cubicPathD(points);
}

/** Preview points including in-progress click-drag placement. */
export function buildPenPreviewPoints(
  worldPts: readonly WorldPathPoint[],
  anchor: { x: number; y: number },
  drag: { x: number; y: number },
): WorldPathPoint[] {
  return buildPlacementPreviewPoints(worldPts, anchor, drag) as WorldPathPoint[];
}

/** Live preview segment from last committed point to hover/placement. */
export function previewSegmentD(
  last: CubicPoint,
  target: { x: number; y: number },
  placement: PenPlacement | null,
): { path: string; isCurve: boolean } {
  return buildLivePreviewSegment(last, target, placement);
}

export function pathPointsToWorld(
  points: readonly PathPoint[],
  origin: { x: number; y: number },
): WorldPathPoint[] {
  return pathPointsToWorldPoints(points, origin);
}
