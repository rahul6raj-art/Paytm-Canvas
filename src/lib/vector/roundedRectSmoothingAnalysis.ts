import { tessellateSvgPathD } from "@/lib/outlineStroke";
import type { RoundedRectPathParams } from "@/lib/vector/roundedRectPath";
import {
  buildPiecewiseSmoothedRoundedRectPath,
  buildRoundedRectPath,
  buildSuperellipseRoundedRectPath,
  sideJoin,
} from "@/lib/vector/roundedRectPath";

export type SmoothingPathModel = "piecewise" | "superellipse" | "canvas";

export type CornerTransitionMetrics = {
  /** Y where the right edge segment becomes vertical (x = width). */
  verticalTangentY: number;
  /** Arc length along the contour from corner start to vertical tangent. */
  transitionArcLength: number;
  /** Peak curvature κ in the transition zone before the vertical edge. */
  peakCurvature: number;
  /** Mean curvature in the transition zone. */
  meanCurvature: number;
};

export type RoundedRectSmoothingComparison = {
  params: Required<Pick<RoundedRectPathParams, "width" | "height" | "radius" | "smoothing">> & {
    origin: { x: number; y: number };
  };
  canvasPath: string;
  piecewisePath: string;
  superellipsePath: string;
  figmaReferencePath: string | null;
  canvas: CornerTransitionMetrics & { model: "canvas" };
  piecewise: CornerTransitionMetrics & { model: "piecewise-cubic-arc" };
  superellipse: CornerTransitionMetrics & { model: "superellipse" };
};

function clampRadius(params: RoundedRectPathParams): number {
  return typeof params.radius === "number" ? params.radius : params.radius.topRight;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function curvatureAt(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  const ax = b.x - a.x;
  const ay = b.y - a.y;
  const bx = c.x - b.x;
  const by = c.y - b.y;
  const cross = ax * by - ay * bx;
  const v1 = Math.hypot(ax, ay);
  const v2 = Math.hypot(bx, by);
  if (v1 < 1e-9 || v2 < 1e-9) return 0;
  return Math.abs((2 * cross) / (v1 * v2 * (v1 + v2)));
}

/** Measure top-right corner transition into the vertical right edge. */
export function measureTopRightCornerTransition(
  pathD: string,
  width: number,
  height: number,
  radius: number,
  smoothing: number,
): CornerTransitionMetrics {
  const pts = tessellateSvgPathD(pathD, 2);
  if (pts.length < 4) {
    return { verticalTangentY: 0, transitionArcLength: 0, peakCurvature: 0, meanCurvature: 0 };
  }

  const p = Math.min((1 + smoothing) * radius, Math.min(width, height) / 2);
  const cornerStart = { x: width - p, y: 0 };
  const tangentTargetY = sideJoin(height, p);
  let startIdx = 0;
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = dist(pts[i]!, cornerStart);
    if (d < best) {
      best = d;
      startIdx = i;
    }
  }

  let verticalIdx = startIdx;
  for (let i = startIdx; i < pts.length; i++) {
    const pt = pts[i]!;
    if (Math.abs(pt.x - width) > 0.75) continue;
    if (Math.abs(pt.y - tangentTargetY) <= 1.5) {
      verticalIdx = i;
      break;
    }
  }

  const transition: typeof pts = [];
  let arcLength = 0;
  for (let i = startIdx; i <= verticalIdx; i++) {
    transition.push(pts[i]!);
    if (i > startIdx) arcLength += dist(pts[i - 1]!, pts[i]!);
  }

  const curvatures: number[] = [];
  for (let i = 1; i + 1 < transition.length; i++) {
    curvatures.push(curvatureAt(transition[i - 1]!, transition[i]!, transition[i + 1]!));
  }

  const peakCurvature = curvatures.length ? Math.max(...curvatures) : 0;
  const meanCurvature = curvatures.length
    ? curvatures.reduce((sum, k) => sum + k, 0) / curvatures.length
    : 0;

  return {
    verticalTangentY: pts[verticalIdx]?.y ?? 0,
    transitionArcLength: arcLength,
    peakCurvature,
    meanCurvature,
  };
}

export function buildRoundedRectSmoothingComparison(
  params: RoundedRectPathParams,
): RoundedRectSmoothingComparison {
  const width = params.width;
  const height = params.height;
  const smoothing = params.smoothing ?? 0;
  const radius = clampRadius(params);
  const origin = params.origin ?? { x: 0, y: 0 };

  const canvasPath = buildRoundedRectPath(params);
  const piecewisePath = buildPiecewiseSmoothedRoundedRectPath(
    origin.x,
    origin.y,
    width,
    height,
    typeof params.radius === "number"
      ? { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius }
      : params.radius,
    smoothing,
  );
  const superellipsePath = buildSuperellipseRoundedRectPath(
    origin.x,
    origin.y,
    width,
    height,
    typeof params.radius === "number"
      ? { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius }
      : params.radius,
    smoothing,
  );

  let figmaReferencePath: string | null = null;

  return {
    params: { width, height, radius, smoothing, origin },
    canvasPath,
    piecewisePath,
    superellipsePath,
    figmaReferencePath,
    canvas: { model: "canvas", ...measureTopRightCornerTransition(canvasPath, width, height, radius, smoothing) },
    piecewise: {
      model: "piecewise-cubic-arc",
      ...measureTopRightCornerTransition(piecewisePath, width, height, radius, smoothing),
    },
    superellipse: {
      model: "superellipse",
      ...measureTopRightCornerTransition(superellipsePath, width, height, radius, smoothing),
    },
  };
}

export function logRoundedRectSmoothingComparison(params: RoundedRectPathParams): RoundedRectSmoothingComparison {
  const comparison = buildRoundedRectSmoothingComparison(params);
  console.log("\n── rounded rect smoothing comparison ──");
  console.log("params:", comparison.params);
  console.log("canvas path:", comparison.canvasPath);
  console.log("piecewise path:", comparison.piecewisePath);
  console.log("superellipse path:", comparison.superellipsePath);
  if (comparison.figmaReferencePath) {
    console.log("figma-squircle path:", comparison.figmaReferencePath);
  }
  console.log("metrics:", {
    canvas: comparison.canvas,
    piecewise: comparison.piecewise,
    superellipse: comparison.superellipse,
  });
  return comparison;
}
