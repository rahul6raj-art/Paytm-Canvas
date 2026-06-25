/**
 * Canonical cubic Bézier path geometry (Figma-style).
 * Shared by pen preview, path commit, canvas rendering, and overlays.
 */

export type CubicPoint = {
  x: number;
  y: number;
  handleIn?: { x: number; y: number } | null;
  handleOut?: { x: number; y: number } | null;
};

type XY = { x: number; y: number };

/** True when segment P0→P1 should render as cubic Bézier (not straight line). */
export function segmentUsesCubicBezier(p0: CubicPoint, p1: CubicPoint): boolean {
  return Boolean(p0.handleOut || p1.handleIn);
}

/** Control points for cubic segment: C1 = P0 + handleOut, C2 = P1 + handleIn. */
export function cubicControlPoints(
  p0: CubicPoint,
  p1: CubicPoint,
): { c1: XY; c2: XY; end: XY } {
  return {
    c1: {
      x: p0.x + (p0.handleOut?.x ?? 0),
      y: p0.y + (p0.handleOut?.y ?? 0),
    },
    c2: {
      x: p1.x + (p1.handleIn?.x ?? 0),
      y: p1.y + (p1.handleIn?.y ?? 0),
    },
    end: { x: p1.x, y: p1.y },
  };
}

/** Append SVG cubic or line segment for P0→P1. */
export function appendCubicSegmentD(
  d: string,
  p0: CubicPoint,
  p1: CubicPoint,
  fmt: (x: number, y: number) => string = (x, y) => `${x} ${y}`,
): string {
  if (!segmentUsesCubicBezier(p0, p1)) {
    return `${d} L ${fmt(p1.x, p1.y)}`;
  }
  const { c1, c2, end } = cubicControlPoints(p0, p1);
  return `${d} C ${fmt(c1.x, c1.y)}, ${fmt(c2.x, c2.y)}, ${fmt(end.x, end.y)}`;
}

/** Build full path `d` from cubic-capable points. */
export function cubicPathD(
  points: readonly CubicPoint[],
  closed = false,
  fmt: (x: number, y: number) => string = (x, y) => `${x} ${y}`,
): string {
  if (points.length === 0) return "";
  let d = `M ${fmt(points[0]!.x, points[0]!.y)}`;
  for (let i = 1; i < points.length; i++) {
    d = appendCubicSegmentD(d, points[i - 1]!, points[i]!, fmt);
  }
  if (closed && points.length >= 2) {
    d = appendCubicSegmentD(d, points[points.length - 1]!, points[0]!, fmt);
    d += " Z";
  }
  return d;
}

/** Live preview segment from P0 to P1 (matches committed cubic logic). */
export function previewSegmentBetween(
  p0: CubicPoint,
  p1: CubicPoint,
): { path: string; isCurve: boolean } {
  const isCurve = segmentUsesCubicBezier(p0, p1);
  const path = appendCubicSegmentD(`M ${p0.x} ${p0.y}`, p0, p1);
  return { path, isCurve };
}
