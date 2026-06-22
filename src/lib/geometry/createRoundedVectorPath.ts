import type { PathPoint } from "@/lib/pathGeometry";
import {
  createOpenRoundedPath2D,
  createOpenRoundedPathSvgD,
  createRoundedPath2D,
  createRoundedPathSvgD,
} from "./createRoundedPath";
import type { Point2 } from "./roundedCornerUtils";

export type VectorPathInput = {
  points: readonly PathPoint[];
  closed: boolean;
  cornerSmoothing?: number;
};

function pathPointHasHandles(point: PathPoint): boolean {
  return !!(point.handleIn || point.handleOut);
}

function plainPoints(points: readonly PathPoint[]): Point2[] {
  return points.map((p) => ({ x: p.x, y: p.y }));
}

function radiusForVectorPoint(points: readonly PathPoint[], index: number): number {
  const pt = points[index];
  if (!pt || pathPointHasHandles(pt)) return 0;
  return Math.max(0, pt.cornerRadius ?? 0);
}

/** Rounded vector path as SVG `d` (tangent-arc / squircle fillets on sharp nodes). */
export function createRoundedVectorPathSvgD(vector: VectorPathInput): string {
  const { points, closed, cornerSmoothing = 0 } = vector;
  if (!points.length) return "";

  const plain = plainPoints(points);
  const options = { cornerSmoothing };
  if (closed) {
    return createRoundedPathSvgD(plain, (_, i) => radiusForVectorPoint(points, i), true, options);
  }
  return createOpenRoundedPathSvgD(plain, (_, i) => radiusForVectorPoint(points, i), options);
}

export function createRoundedVectorPath2D(vector: VectorPathInput): Path2D {
  const { points, closed, cornerSmoothing = 0 } = vector;
  if (!points.length) return new Path2D();

  const plain = plainPoints(points);
  const options = { cornerSmoothing };
  if (closed) {
    return createRoundedPath2D(plain, (_, i) => radiusForVectorPoint(points, i), true, options);
  }
  return createOpenRoundedPath2D(plain, (_, i) => radiusForVectorPoint(points, i), options);
}
