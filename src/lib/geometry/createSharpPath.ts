import type { Point2 } from "./roundedCornerUtils";

/** Sharp polygon path as SVG `d` (M/L commands). */
export function createSharpPathSvgD(points: readonly Point2[], closed = true): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0]!.x} ${points[0]!.y}`;

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < n; i++) {
    d += ` L ${points[i]!.x} ${points[i]!.y}`;
  }
  if (closed) d += " Z";
  return d;
}

/** Sharp polygon path as Canvas Path2D. */
export function createSharpPath2D(points: readonly Point2[], closed = true): Path2D {
  const path = new Path2D();
  if (points.length === 0) return path;
  path.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i]!.x, points[i]!.y);
  }
  if (closed) path.closePath();
  return path;
}
