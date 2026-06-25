import type { PathPoint } from "@/lib/pathGeometry";
import { penHitRadiusWorld } from "./coordinates";
import type { VectorPoint } from "./types";
import { pathPointToVector } from "./vectorPoint";

export type PenHitTarget =
  | { kind: "anchor"; pointId: string; index: number }
  | { kind: "in-handle"; pointId: string; index: number }
  | { kind: "out-handle"; pointId: string; index: number }
  | { kind: "segment"; index: number };

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function hitCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  threshold: number,
): boolean {
  return distSq(px, py, cx, cy) <= threshold * threshold;
}

function cubicPoint(
  t: number,
  p0: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  p1: { x: number; y: number },
): { x: number; y: number } {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * p0.x + 3 * uu * t * c1.x + 3 * u * tt * c2.x + tt * t * p1.x,
    y: uu * u * p0.y + 3 * uu * t * c1.y + 3 * u * tt * c2.y + tt * t * p1.y,
  };
}

function distPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-12) return Math.sqrt(distSq(px, py, ax, ay));
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + abx * t;
  const qy = ay + aby * t;
  return Math.sqrt(distSq(px, py, qx, qy));
}

function distPointToBezier(px: number, py: number, p0: PathPoint, p1: PathPoint, samples = 24): number {
  const c1x = p0.x + (p0.handleOut?.x ?? 0);
  const c1y = p0.y + (p0.handleOut?.y ?? 0);
  const c2x = p1.x + (p1.handleIn?.x ?? 0);
  const c2y = p1.y + (p1.handleIn?.y ?? 0);
  let minD = Infinity;
  let prev = { x: p0.x, y: p0.y };
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const cur = cubicPoint(t, { x: p0.x, y: p0.y }, { x: c1x, y: c1y }, { x: c2x, y: c2y }, { x: p1.x, y: p1.y });
    minD = Math.min(minD, distPointToSegment(px, py, prev.x, prev.y, cur.x, cur.y));
    prev = cur;
  }
  return minD;
}

export function hitTestAnchor(
  localX: number,
  localY: number,
  points: readonly PathPoint[],
  threshold: number,
): PenHitTarget | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]!;
    if (hitCircle(localX, localY, p.x, p.y, threshold)) {
      return { kind: "anchor", pointId: p.id, index: i };
    }
  }
  return null;
}

export function hitTestInHandle(
  localX: number,
  localY: number,
  points: readonly PathPoint[],
  threshold: number,
): PenHitTarget | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]!;
    if (!p.handleIn) continue;
    const hx = p.x + p.handleIn.x;
    const hy = p.y + p.handleIn.y;
    if (hitCircle(localX, localY, hx, hy, threshold)) {
      return { kind: "in-handle", pointId: p.id, index: i };
    }
  }
  return null;
}

export function hitTestOutHandle(
  localX: number,
  localY: number,
  points: readonly PathPoint[],
  threshold: number,
): PenHitTarget | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]!;
    if (!p.handleOut) continue;
    const hx = p.x + p.handleOut.x;
    const hy = p.y + p.handleOut.y;
    if (hitCircle(localX, localY, hx, hy, threshold)) {
      return { kind: "out-handle", pointId: p.id, index: i };
    }
  }
  return null;
}

export function hitTestPathSegment(
  localX: number,
  localY: number,
  points: readonly PathPoint[],
  closed: boolean,
  tolerance: number,
): PenHitTarget | null {
  if (points.length < 2) return null;
  let best: { index: number; d: number } | null = null;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const hasCurve = Boolean(a.handleOut || b.handleIn);
    const d = hasCurve
      ? distPointToBezier(localX, localY, a, b)
      : distPointToSegment(localX, localY, a.x, a.y, b.x, b.y);
    if (d <= tolerance && (!best || d < best.d)) best = { index: i, d };
  }
  if (closed && points.length >= 2) {
    const a = points[points.length - 1]!;
    const b = points[0]!;
    const hasCurve = Boolean(a.handleOut || b.handleIn);
    const d = hasCurve
      ? distPointToBezier(localX, localY, a, b)
      : distPointToSegment(localX, localY, a.x, a.y, b.x, b.y);
    if (d <= tolerance && (!best || d < best.d)) best = { index: points.length - 1, d };
  }
  return best ? { kind: "segment", index: best.index } : null;
}

/** Priority: handles → anchors → segments (Figma-style). Thresholds are zoom-aware. */
export function hitTestPenPathAtZoom(
  localX: number,
  localY: number,
  points: readonly PathPoint[],
  closed: boolean,
  zoom: number,
): PenHitTarget | null {
  const threshold = penHitRadiusWorld(zoom);
  return hitTestPenPath(localX, localY, points, closed, threshold, threshold);
}

/** Priority: handles → anchors → segments (Figma-style). */
export function hitTestPenPath(
  localX: number,
  localY: number,
  points: readonly PathPoint[],
  closed: boolean,
  anchorThreshold: number,
  segmentTolerance: number,
): PenHitTarget | null {
  return (
    hitTestInHandle(localX, localY, points, anchorThreshold) ??
    hitTestOutHandle(localX, localY, points, anchorThreshold) ??
    hitTestAnchor(localX, localY, points, anchorThreshold) ??
    hitTestPathSegment(localX, localY, points, closed, segmentTolerance)
  );
}

export function vectorPointsFromPath(points: readonly PathPoint[]): VectorPoint[] {
  return points.map((p) => pathPointToVector(p));
}
