import type { PathPoint } from "@/lib/pathGeometry";

/** Min world-space distance between freehand samples (~2px on screen at current zoom). */
export function freehandSampleSpacingWorld(zoom: number): number {
  return 2 / Math.max(zoom, 0.01);
}

export function shouldSampleFreehandPoint(
  lastX: number,
  lastY: number,
  x: number,
  y: number,
  zoom: number,
): boolean {
  const min = freehandSampleSpacingWorld(zoom);
  return Math.hypot(x - lastX, y - lastY) >= min;
}

type Point2 = { x: number; y: number };

function perpendicularDistance(point: Point2, lineStart: Point2, lineEnd: Point2): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  const t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const px = lineStart.x + clamped * dx;
  const py = lineStart.y + clamped * dy;
  return Math.hypot(point.x - px, point.y - py);
}

/** Ramer–Douglas–Peucker — keeps stroke smooth with fewer anchors after release. */
export function simplifyPolyline(points: Point2[], epsilon: number): Point2[] {
  if (points.length <= 2) return points.slice();
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i]!, points[0]!, points[end]!);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }
  if (maxDist > epsilon) {
    const left = simplifyPolyline(points.slice(0, index + 1), epsilon);
    const right = simplifyPolyline(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0]!, points[end]!];
}

function knotAt(points: Point2[], index: number, closed: boolean): Point2 {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  if (closed) return points[((index % n) + n) % n]!;
  if (index <= 0) return points[0]!;
  if (index >= n - 1) return points[n - 1]!;
  return points[index]!;
}

function limitHandleVector(x: number, y: number, maxLen: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len <= maxLen || len < 1e-6) return { x, y };
  const scale = maxLen / len;
  return { x: x * scale, y: y * scale };
}

/**
 * Convert a polyline into cubic-bezier path points (Catmull–Rom style).
 * Used when finishing pencil strokes so freehand paths render as smooth curves.
 */
export function smoothPolylineToPathPoints(
  points: Point2[],
  closed = false,
  createId: () => string,
): PathPoint[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) {
    const p = points[0]!;
    return [{ id: createId(), x: p.x, y: p.y }];
  }
  if (n === 2) {
    return points.map((p) => ({ id: createId(), x: p.x, y: p.y }));
  }

  const out: PathPoint[] = [];
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const pPrev = knotAt(points, i - 1, closed);
    const pNext = knotAt(points, i + 1, closed);
    const tangentX = (pNext.x - pPrev.x) / 6;
    const tangentY = (pNext.y - pPrev.y) / 6;

    let handleIn: { x: number; y: number } | undefined;
    let handleOut: { x: number; y: number } | undefined;

    if (closed || i < n - 1) {
      const segLen = Math.hypot(pNext.x - p.x, pNext.y - p.y);
      handleOut = limitHandleVector(tangentX, tangentY, segLen * 0.45);
    }
    if (closed || i > 0) {
      const segLen = Math.hypot(p.x - pPrev.x, p.y - pPrev.y);
      handleIn = limitHandleVector(-tangentX, -tangentY, segLen * 0.45);
    }

    out.push({ id: createId(), x: p.x, y: p.y, handleIn, handleOut });
  }
  return out;
}
