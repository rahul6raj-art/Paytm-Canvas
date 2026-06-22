import type { Point2 } from "./roundedCornerUtils";
import {
  buildRoundedPolygonPath2D,
  buildRoundedPolygonPathSvgD,
  type RoundedPolygonOptions,
} from "./roundedPolygon";

export type RadiusForPointFn = (point: Point2, index: number) => number;

export type RoundedPathOptions = RoundedPolygonOptions;

function optionsFromRadiusFn(
  points: readonly Point2[],
  getRadiusForPoint: RadiusForPointFn,
  extra: RoundedPathOptions = {},
): RoundedPolygonOptions {
  return {
    ...extra,
    cornerRadii: points.map((p, i) => Math.max(0, getRadiusForPoint(p, i))),
  };
}

/** Closed path with Figma-style tangent-arc / squircle polygon rounding. */
export function createRoundedPathSvgD(
  points: readonly Point2[],
  getRadiusForPoint: RadiusForPointFn,
  closed = true,
  options: RoundedPathOptions = {},
): string {
  const n = points.length;
  if (n === 0) return "";
  if (n < 3) {
    if (n === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }
  if (!closed) {
    return buildRoundedPolygonPathSvgD(
      points,
      optionsFromRadiusFn(points, getRadiusForPoint, options),
      false,
    );
  }
  return buildRoundedPolygonPathSvgD(
    points,
    optionsFromRadiusFn(points, getRadiusForPoint, options),
    true,
  );
}

export function createRoundedPath2D(
  points: readonly Point2[],
  getRadiusForPoint: RadiusForPointFn,
  closed = true,
  options: RoundedPathOptions = {},
): Path2D {
  return buildRoundedPolygonPath2D(
    points,
    optionsFromRadiusFn(points, getRadiusForPoint, options),
    closed,
  );
}

export function createOpenRoundedPathSvgD(
  points: readonly Point2[],
  getRadiusForPoint: RadiusForPointFn,
  options: RoundedPathOptions = {},
): string {
  return createRoundedPathSvgD(points, getRadiusForPoint, false, options);
}

export function createOpenRoundedPath2D(
  points: readonly Point2[],
  getRadiusForPoint: RadiusForPointFn,
  options: RoundedPathOptions = {},
): Path2D {
  return createRoundedPath2D(points, getRadiusForPoint, false, options);
}

/** Per-vertex radii on a closed polygon. */
export function createRoundedPathWithRadiiSvgD(
  points: readonly Point2[],
  radii: readonly number[],
  closed = true,
  options: RoundedPathOptions = {},
): string {
  return buildRoundedPolygonPathSvgD(
    points,
    { ...options, cornerRadii: radii.map((r) => Math.max(0, r)) },
    closed,
  );
}
