import {
  calculateRoundedCorner,
  type Point2,
  type RoundedCorner,
} from "./roundedCornerUtils";
import { createSharpPath2D, createSharpPathSvgD } from "./createSharpPath";

export type RadiusForPointFn = (point: Point2, index: number) => number;

function computeClosedCorners(
  points: readonly Point2[],
  getRadiusForPoint: RadiusForPointFn,
): RoundedCorner[] {
  const n = points.length;
  return points.map((curr, i) => {
    const prev = points[(i - 1 + n) % n]!;
    const next = points[(i + 1) % n]!;
    return calculateRoundedCorner(prev, curr, next, getRadiusForPoint(curr, i));
  });
}

function appendClosedRoundedPath(
  path: Path2D,
  corners: readonly RoundedCorner[],
): void {
  const n = corners.length;
  if (n === 0) return;
  path.moveTo(corners[0]!.end.x, corners[0]!.end.y);
  for (let i = 0; i < n; i++) {
    const c = corners[(i + 1) % n]!;
    path.lineTo(c.start.x, c.start.y);
    if (c.radius > 0) {
      path.quadraticCurveTo(c.vertex.x, c.vertex.y, c.end.x, c.end.y);
    } else {
      path.lineTo(c.vertex.x, c.vertex.y);
    }
  }
  path.closePath();
}

/** Open path with rounded interior vertices only (endpoints stay sharp). */
export function createOpenRoundedPathSvgD(
  points: readonly Point2[],
  getRadiusForPoint: RadiusForPointFn,
): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (n === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < n - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;
    const rounded = calculateRoundedCorner(prev, curr, next, getRadiusForPoint(curr, i));
    d += ` L ${rounded.start.x} ${rounded.start.y}`;
    if (rounded.radius > 0) {
      d += ` Q ${curr.x} ${curr.y} ${rounded.end.x} ${rounded.end.y}`;
    } else {
      d += ` L ${curr.x} ${curr.y}`;
    }
  }
  const last = points[n - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function createOpenRoundedPath2D(
  points: readonly Point2[],
  getRadiusForPoint: RadiusForPointFn,
): Path2D {
  const path = new Path2D();
  const n = points.length;
  if (n === 0) return path;
  path.moveTo(points[0]!.x, points[0]!.y);
  if (n === 1) return path;
  if (n === 2) {
    path.lineTo(points[1]!.x, points[1]!.y);
    return path;
  }
  for (let i = 1; i < n - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;
    const rounded = calculateRoundedCorner(prev, curr, next, getRadiusForPoint(curr, i));
    path.lineTo(rounded.start.x, rounded.start.y);
    if (rounded.radius > 0) {
      path.quadraticCurveTo(curr.x, curr.y, rounded.end.x, rounded.end.y);
    } else {
      path.lineTo(curr.x, curr.y);
    }
  }
  path.lineTo(points[n - 1]!.x, points[n - 1]!.y);
  return path;
}

/** Closed path with quadratic fillets at each vertex. */
export function createRoundedPathSvgD(
  points: readonly Point2[],
  getRadiusForPoint: RadiusForPointFn,
  closed = true,
): string {
  const n = points.length;
  if (n === 0) return "";
  if (n < 3) return createSharpPathSvgD(points, closed);
  if (!closed) return createOpenRoundedPathSvgD(points, getRadiusForPoint);

  const corners = computeClosedCorners(points, getRadiusForPoint);
  if (corners.every((c) => c.radius <= 0)) {
    return createSharpPathSvgD(points, true);
  }

  let d = `M ${corners[0]!.end.x} ${corners[0]!.end.y}`;
  for (let i = 0; i < n; i++) {
    const c = corners[(i + 1) % n]!;
    d += ` L ${c.start.x} ${c.start.y}`;
    if (c.radius > 0) {
      d += ` Q ${c.vertex.x} ${c.vertex.y} ${c.end.x} ${c.end.y}`;
    } else {
      d += ` L ${c.vertex.x} ${c.vertex.y}`;
    }
  }
  return `${d} Z`;
}

export function createRoundedPath2D(
  points: readonly Point2[],
  getRadiusForPoint: RadiusForPointFn,
  closed = true,
): Path2D {
  const n = points.length;
  if (n === 0) return new Path2D();
  if (n < 3) return createSharpPath2D(points, closed);
  if (!closed) return createOpenRoundedPath2D(points, getRadiusForPoint);

  const corners = computeClosedCorners(points, getRadiusForPoint);
  if (corners.every((c) => c.radius <= 0)) {
    return createSharpPath2D(points, true);
  }

  const path = new Path2D();
  appendClosedRoundedPath(path, corners);
  return path;
}

/** Per-vertex radii on a closed polygon. */
export function createRoundedPathWithRadiiSvgD(
  points: readonly Point2[],
  radii: readonly number[],
  closed = true,
): string {
  return createRoundedPathSvgD(points, (_, i) => Math.max(0, radii[i] ?? 0), closed);
}
