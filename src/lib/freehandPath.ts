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
