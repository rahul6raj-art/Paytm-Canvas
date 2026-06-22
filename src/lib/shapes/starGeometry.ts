import type { EditorNode } from "@/stores/useEditorStore";
import { newPathPointId, type PathPoint } from "@/lib/pathGeometry";
import { resizeCornerRadiiForCount } from "@/lib/cornerRadius";
import {
  createRoundedPathSvgD,
  createRoundedPathWithRadiiSvgD,
  type Point2,
} from "@/lib/geometry";
import {
  maxFilletRadiusAtVertex,
  maxUniformFilletRadius,
  scaleRadiiToEdgeConstraints,
} from "@/lib/geometry/roundedPolygon";

export type { Point2 };

export const STAR_POINTS_MIN = 3;
export const STAR_POINTS_MAX = 100;
export const DEFAULT_STAR_POINTS = 5;
export const DEFAULT_STAR_INNER_RATIO = 0.4;

export function isStarNode(
  node: Pick<EditorNode, "type" | "starPoints"> | null | undefined,
): boolean {
  return node?.type === "path" && node.starPoints != null;
}

export function clampStarPointCount(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_STAR_POINTS;
  return Math.max(STAR_POINTS_MIN, Math.min(STAR_POINTS_MAX, Math.round(n)));
}

export function clampStarRatio(r: number): number {
  if (!Number.isFinite(r)) return DEFAULT_STAR_INNER_RATIO;
  return Math.max(0, Math.min(1, r));
}

/** Sharp star vertices (2 × point count), top spike at 12 o'clock. */
export function starVertices(
  pointCount: number,
  ratio: number,
  width: number,
  height: number,
): Point2[] {
  const spikes = clampStarPointCount(pointCount);
  const r = clampStarRatio(ratio);
  const cx = width / 2;
  const cy = height / 2;
  const outerRx = Math.max(1e-6, width / 2);
  const outerRy = Math.max(1e-6, height / 2);
  const innerRx = outerRx * r;
  const innerRy = outerRy * r;
  const total = spikes * 2;
  const verts: Point2[] = [];
  for (let i = 0; i < total; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / spikes;
    const outer = i % 2 === 0;
    const rx = outer ? outerRx : innerRx;
    const ry = outer ? outerRy : innerRy;
    verts.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return verts;
}

/** Index of the first inner spike (ratio handle). */
export const STAR_RATIO_VERTEX_INDEX = 1;

/** Local position of the ratio handle (first inner vertex). */
export function starRatioHandleLocal(
  pointCount: number,
  ratio: number,
  width: number,
  height: number,
): Point2 {
  const verts = starVertices(pointCount, ratio, width, height);
  return verts[STAR_RATIO_VERTEX_INDEX] ?? verts[0] ?? { x: width / 2, y: 0 };
}

/**
 * Inner/outer ratio from pointer in local box (ellipse-normalized radial along spike 1).
 */
export function starRatioFromLocalPoint(
  localX: number,
  localY: number,
  pointCount: number,
  width: number,
  height: number,
): number {
  const spikes = clampStarPointCount(pointCount);
  const cx = width / 2;
  const cy = height / 2;
  const outerRx = Math.max(1e-6, width / 2);
  const outerRy = Math.max(1e-6, height / 2);
  const angle = -Math.PI / 2 + (STAR_RATIO_VERTEX_INDEX * Math.PI) / spikes;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const nx = (localX - cx) / outerRx;
  const ny = (localY - cy) / outerRy;
  const t = nx * dirX + ny * dirY;
  return clampStarRatio(t);
}

/** Max geometric fillet radius at a vertex (local, before edge coupling). */
export function maxCornerRadiusAtVertex(
  prev: Point2,
  curr: Point2,
  next: Point2,
  cornerSmoothing = 0,
): number {
  return maxFilletRadiusAtVertex(prev, curr, next, cornerSmoothing);
}

export function maxStarCornerRadius(
  pointCount: number,
  ratio: number,
  width: number,
  height: number,
  cornerSmoothing = 0,
): number {
  return maxUniformFilletRadius(
    starVertices(pointCount, ratio, width, height),
    cornerSmoothing,
  );
}

export function clampStarCornerRadius(
  pointCount: number,
  ratio: number,
  width: number,
  height: number,
  radius: number,
): number {
  const maxR = maxStarCornerRadius(pointCount, ratio, width, height);
  return Math.max(0, Math.min(maxR, radius));
}

export function maxStarVertexCornerRadius(
  pointCount: number,
  ratio: number,
  width: number,
  height: number,
  vertexIndex: number,
): number {
  const verts = starVertices(pointCount, ratio, width, height);
  const n = verts.length;
  const i = ((vertexIndex % n) + n) % n;
  const prev = verts[(i - 1 + n) % n]!;
  const curr = verts[i]!;
  const next = verts[(i + 1) % n]!;
  return maxCornerRadiusAtVertex(prev, curr, next);
}

export function clampStarOuterCornerRadius(
  pointCount: number,
  ratio: number,
  width: number,
  height: number,
  radius: number,
): number {
  return Math.max(
    0,
    Math.min(maxStarVertexCornerRadius(pointCount, ratio, width, height, 0), radius),
  );
}

export function clampStarInnerCornerRadius(
  pointCount: number,
  ratio: number,
  width: number,
  height: number,
  radius: number,
): number {
  return Math.max(
    0,
    Math.min(maxStarVertexCornerRadius(pointCount, ratio, width, height, 1), radius),
  );
}

export function clampStarVertexCornerRadii(
  pointCount: number,
  ratio: number,
  width: number,
  height: number,
  radii: readonly number[],
  cornerSmoothing = 0,
): number[] {
  const spikes = clampStarPointCount(pointCount);
  const r = clampStarRatio(ratio);
  const verts = starVertices(spikes, r, width, height);
  const n = verts.length;
  const maxR = maxUniformFilletRadius(verts, cornerSmoothing);
  const clamped = Array.from({ length: n }, (_, i) =>
    Math.max(0, Math.min(maxR, radii[i] ?? radii[0] ?? 0)),
  );
  return scaleRadiiToEdgeConstraints(verts, clamped, cornerSmoothing);
}

export function getStarVertexCornerRadii(
  node: Pick<
    EditorNode,
    | "starPoints"
    | "starInnerRadius"
    | "cornerRadius"
    | "cornerRadii"
    | "starOuterCornerRadius"
    | "starInnerCornerRadius"
    | "width"
    | "height"
    | "cornerSmoothing"
  >,
): number[] {
  const points = clampStarPointCount(node.starPoints ?? DEFAULT_STAR_POINTS);
  const total = points * 2;
  const smoothing = node.cornerSmoothing ?? 0;
  const params = effectiveStarParams(node);
  const defaults = Array.from({ length: total }, (_, i) =>
    i % 2 === 0 ? params.outerCornerRadius : params.innerCornerRadius,
  );
  const base = resizeCornerRadiiForCount(node.cornerRadii, total, node.cornerRadius ?? 0);
  const merged = base.map((r, i) => (node.cornerRadii?.length ? r : defaults[i]!));
  return clampStarVertexCornerRadii(
    points,
    node.starInnerRadius ?? DEFAULT_STAR_INNER_RATIO,
    node.width,
    node.height,
    merged,
    smoothing,
  );
}

/** Inward unit bisector at a vertex (for corner-radius handle placement). */
export function vertexInwardBisector(prev: Point2, curr: Point2, next: Point2): Point2 {
  const v0x = prev.x - curr.x;
  const v0y = prev.y - curr.y;
  const v1x = next.x - curr.x;
  const v1y = next.y - curr.y;
  const len0 = Math.hypot(v0x, v0y);
  const len1 = Math.hypot(v1x, v1y);
  const u0x = len0 > 1e-6 ? v0x / len0 : 0;
  const u0y = len0 > 1e-6 ? v0y / len0 : 0;
  const u1x = len1 > 1e-6 ? v1x / len1 : 0;
  const u1y = len1 > 1e-6 ? v1y / len1 : 0;
  let bx = u0x + u1x;
  let by = u0y + u1y;
  const bl = Math.hypot(bx, by);
  if (bl < 1e-6) return { x: 0, y: -1 };
  return { x: bx / bl, y: by / bl };
}

/** Corner-radius handle on outer top spike (index 0). */
export function starCornerRadiusHandleLocal(
  pointCount: number,
  ratio: number,
  width: number,
  height: number,
  cornerRadius: number,
  vertexIndex = 0,
): Point2 {
  const verts = starVertices(pointCount, ratio, width, height);
  const n = verts.length;
  const i = ((vertexIndex % n) + n) % n;
  const prev = verts[(i - 1 + n) % n]!;
  const curr = verts[i]!;
  const next = verts[(i + 1) % n]!;
  const bis = vertexInwardBisector(prev, curr, next);
  const r = clampStarCornerRadius(pointCount, ratio, width, height, cornerRadius);
  return { x: curr.x + bis.x * r, y: curr.y + bis.y * r };
}

/** Corner radius from pointer distance along inward bisector at a vertex. */
export function starCornerRadiusFromLocalPoint(
  localX: number,
  localY: number,
  pointCount: number,
  ratio: number,
  width: number,
  height: number,
  vertexIndex = 0,
): number {
  const verts = starVertices(pointCount, ratio, width, height);
  const n = verts.length;
  const i = ((vertexIndex % n) + n) % n;
  const prev = verts[(i - 1 + n) % n]!;
  const curr = verts[i]!;
  const next = verts[(i + 1) % n]!;
  const bis = vertexInwardBisector(prev, curr, next);
  const dx = localX - curr.x;
  const dy = localY - curr.y;
  const metric = dx * bis.x + dy * bis.y;
  return clampStarCornerRadius(pointCount, ratio, width, height, Math.max(0, metric));
}

/** Closed SVG path with tangent-arc / squircle polygon rounding. */
export function roundedPolygonPathDWithRadii(
  vertices: Point2[],
  radii: readonly number[],
  cornerSmoothing = 0,
): string {
  return createRoundedPathWithRadiiSvgD(vertices, radii, true, { cornerSmoothing });
}

/** Closed SVG path with uniform tangent-arc / squircle rounding. */
export function roundedPolygonPathD(
  vertices: Point2[],
  radius: number,
  cornerSmoothing = 0,
): string {
  const n = vertices.length;
  return roundedPolygonPathDWithRadii(
    vertices,
    Array.from({ length: n }, () => radius),
    cornerSmoothing,
  );
}

export function starPathD(
  width: number,
  height: number,
  pointCount: number,
  ratio: number,
  cornerRadius = 0,
  outerCornerRadius?: number,
  innerCornerRadius?: number,
): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const spikes = clampStarPointCount(pointCount);
  const r = clampStarRatio(ratio);
  const fallback = clampStarCornerRadius(spikes, r, w, h, cornerRadius);
  const outer = clampStarOuterCornerRadius(
    spikes,
    r,
    w,
    h,
    outerCornerRadius ?? fallback,
  );
  const inner = clampStarInnerCornerRadius(
    spikes,
    r,
    w,
    h,
    innerCornerRadius ?? fallback,
  );
  const verts = starVertices(spikes, r, w, h);
  return createRoundedPathSvgD(
    verts,
    (_point, index) => (index % 2 === 0 ? outer : inner),
    true,
    { cornerSmoothing: 0 },
  );
}

export type StarParams = {
  pointCount: number;
  ratio: number;
  cornerRadius: number;
  outerCornerRadius: number;
  innerCornerRadius: number;
};

export function effectiveStarParams(
  node: Pick<
    EditorNode,
    | "starPoints"
    | "starInnerRadius"
    | "cornerRadius"
    | "starOuterCornerRadius"
    | "starInnerCornerRadius"
    | "width"
    | "height"
  >,
): StarParams {
  const pointCount = clampStarPointCount(node.starPoints ?? DEFAULT_STAR_POINTS);
  const ratio = clampStarRatio(node.starInnerRadius ?? DEFAULT_STAR_INNER_RATIO);
  const fallback = clampStarCornerRadius(
    pointCount,
    ratio,
    node.width,
    node.height,
    node.cornerRadius ?? 0,
  );
  const outerCornerRadius = clampStarOuterCornerRadius(
    pointCount,
    ratio,
    node.width,
    node.height,
    node.starOuterCornerRadius ?? fallback,
  );
  const innerCornerRadius = clampStarInnerCornerRadius(
    pointCount,
    ratio,
    node.width,
    node.height,
    node.starInnerCornerRadius ?? fallback,
  );
  return { pointCount, ratio, cornerRadius: fallback, outerCornerRadius, innerCornerRadius };
}

export function starPathDForNode(
  node: Pick<
    EditorNode,
    | "width"
    | "height"
    | "starPoints"
    | "starInnerRadius"
    | "cornerRadius"
    | "cornerRadii"
    | "starOuterCornerRadius"
    | "starInnerCornerRadius"
  >,
  override?: Partial<StarParams>,
): string {
  const base = effectiveStarParams(node);
  const pointCount = override?.pointCount ?? base.pointCount;
  const ratio = override?.ratio ?? base.ratio;
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  const verts = starVertices(pointCount, ratio, w, h);

  if (
    override?.cornerRadius != null ||
    override?.outerCornerRadius != null ||
    override?.innerCornerRadius != null
  ) {
    const cornerRadius = override?.cornerRadius ?? base.cornerRadius;
    const outerCornerRadius = override?.outerCornerRadius ?? base.outerCornerRadius;
    const innerCornerRadius = override?.innerCornerRadius ?? base.innerCornerRadius;
    return starPathD(
      w,
      h,
      pointCount,
      ratio,
      cornerRadius,
      outerCornerRadius,
      innerCornerRadius,
    );
  }

  const radii = getStarVertexCornerRadii({ ...node, starPoints: pointCount, starInnerRadius: ratio });
  return roundedPolygonPathDWithRadii(verts, radii, node.cornerSmoothing ?? 0);
}

/** Path anchors for bounds / legacy hit tests (sharp vertices). */
export function starPathPoints(
  pointCount: number,
  ratio: number,
  width: number,
  height: number,
): PathPoint[] {
  return starVertices(pointCount, ratio, width, height).map((p) => ({
    id: newPathPointId(),
    x: p.x,
    y: p.y,
  }));
}

/** Inspector / drag patch keeping star metadata and anchors in sync. */
export function starGeometryPatch(
  node: Pick<
    EditorNode,
    | "width"
    | "height"
    | "starPoints"
    | "starInnerRadius"
    | "cornerRadius"
    | "cornerRadii"
    | "starOuterCornerRadius"
    | "starInnerCornerRadius"
  >,
  partial: Partial<{
    starPoints: number;
    starInnerRadius: number;
    cornerRadius: number;
    outerCornerRadius: number;
    innerCornerRadius: number;
  }>,
): Pick<
  EditorNode,
  | "starPoints"
  | "starInnerRadius"
  | "cornerRadius"
  | "cornerRadii"
  | "starOuterCornerRadius"
  | "starInnerCornerRadius"
  | "pathPoints"
> {
  const pointCount = clampStarPointCount(partial.starPoints ?? node.starPoints ?? DEFAULT_STAR_POINTS);
  const ratio = clampStarRatio(partial.starInnerRadius ?? node.starInnerRadius ?? DEFAULT_STAR_INNER_RATIO);
  const base = {
    starPoints: pointCount,
    starInnerRadius: ratio,
    pathPoints: starPathPoints(pointCount, ratio, node.width, node.height),
  };

  if (
    partial.cornerRadius != null &&
    partial.outerCornerRadius == null &&
    partial.innerCornerRadius == null
  ) {
    const fallback = clampStarCornerRadius(
      pointCount,
      ratio,
      node.width,
      node.height,
      partial.cornerRadius,
    );
    return {
      ...base,
      cornerRadius: fallback,
      cornerRadii: undefined,
      starOuterCornerRadius: fallback,
      starInnerCornerRadius: fallback,
    };
  }

  if (partial.outerCornerRadius != null || partial.innerCornerRadius != null) {
    const fallback = clampStarCornerRadius(
      pointCount,
      ratio,
      node.width,
      node.height,
      partial.cornerRadius ?? node.cornerRadius ?? 0,
    );
    const outerCornerRadius = clampStarOuterCornerRadius(
      pointCount,
      ratio,
      node.width,
      node.height,
      partial.outerCornerRadius ?? node.starOuterCornerRadius ?? fallback,
    );
    const innerCornerRadius = clampStarInnerCornerRadius(
      pointCount,
      ratio,
      node.width,
      node.height,
      partial.innerCornerRadius ?? node.starInnerCornerRadius ?? fallback,
    );
    return {
      ...base,
      cornerRadius: node.cornerRadius,
      cornerRadii: undefined,
      starOuterCornerRadius: outerCornerRadius,
      starInnerCornerRadius: innerCornerRadius,
    };
  }

  if (node.cornerRadii?.length) {
    const total = pointCount * 2;
    const resized = resizeCornerRadiiForCount(
      node.cornerRadii,
      total,
      node.cornerRadius ?? 0,
    );
    const clamped = getStarVertexCornerRadii({
      ...node,
      starPoints: pointCount,
      starInnerRadius: ratio,
      cornerRadii: resized,
    });
    const allSame = clamped.length > 0 && clamped.every((r) => r === clamped[0]);
    return allSame
      ? {
          ...base,
          cornerRadius: clamped[0],
          cornerRadii: undefined,
          starOuterCornerRadius: clamped[0],
          starInnerCornerRadius: clamped[0],
        }
      : {
          ...base,
          cornerRadius: undefined,
          cornerRadii: clamped,
          starOuterCornerRadius: undefined,
          starInnerCornerRadius: undefined,
        };
  }

  const params = effectiveStarParams({ ...node, starPoints: pointCount, starInnerRadius: ratio });
  return {
    ...base,
    cornerRadius: params.cornerRadius,
    cornerRadii: undefined,
    starOuterCornerRadius: params.outerCornerRadius,
    starInnerCornerRadius: params.innerCornerRadius,
  };
}
