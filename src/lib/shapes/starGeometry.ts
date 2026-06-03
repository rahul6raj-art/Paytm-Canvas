import type { EditorNode } from "@/stores/useEditorStore";
import { newPathPointId, type PathPoint } from "@/lib/pathGeometry";

export type Point2 = { x: number; y: number };

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

/** Max fillet radius before adjacent corners overlap on a closed polygon. */
export function maxCornerRadiusAtVertex(prev: Point2, curr: Point2, next: Point2): number {
  const v0x = prev.x - curr.x;
  const v0y = prev.y - curr.y;
  const v1x = next.x - curr.x;
  const v1y = next.y - curr.y;
  const len0 = Math.hypot(v0x, v0y);
  const len1 = Math.hypot(v1x, v1y);
  if (len0 < 1e-6 || len1 < 1e-6) return 0;
  const n0x = v0x / len0;
  const n0y = v0y / len0;
  const n1x = v1x / len1;
  const n1y = v1y / len1;
  const dot = Math.max(-1, Math.min(1, n0x * n1x + n0y * n1y));
  const angle = Math.acos(dot);
  const half = angle / 2;
  if (half < 1e-6) return 0;
  return Math.min(len0, len1) * Math.tan(half) * 0.999;
}

export function maxStarCornerRadius(
  pointCount: number,
  ratio: number,
  width: number,
  height: number,
): number {
  const verts = starVertices(pointCount, ratio, width, height);
  const n = verts.length;
  let max = Infinity;
  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n]!;
    const curr = verts[i]!;
    const next = verts[(i + 1) % n]!;
    max = Math.min(max, maxCornerRadiusAtVertex(prev, curr, next));
  }
  return Number.isFinite(max) ? max : 0;
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

/** Closed SVG path with circular fillets at every vertex. */
export function roundedPolygonPathD(vertices: Point2[], radius: number): string {
  const n = vertices.length;
  if (n < 3) return "";
  const r = Math.max(0, radius);
  if (r <= 0) {
    const first = vertices[0]!;
    let d = `M ${first.x} ${first.y}`;
    for (let i = 1; i < n; i++) {
      const p = vertices[i]!;
      d += ` L ${p.x} ${p.y}`;
    }
    return `${d} Z`;
  }

  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n]!;
    const curr = vertices[i]!;
    const next = vertices[(i + 1) % n]!;

    const v0x = prev.x - curr.x;
    const v0y = prev.y - curr.y;
    const v1x = next.x - curr.x;
    const v1y = next.y - curr.y;
    const len0 = Math.hypot(v0x, v0y);
    const len1 = Math.hypot(v1x, v1y);
    if (len0 < 1e-6 || len1 < 1e-6) continue;

    const n0x = v0x / len0;
    const n0y = v0y / len0;
    const n1x = v1x / len1;
    const n1y = v1y / len1;

    const dot = Math.max(-1, Math.min(1, n0x * n1x + n0y * n1y));
    const angle = Math.acos(dot);
    const half = angle / 2;
    if (half < 1e-6) continue;

    const maxAt = maxCornerRadiusAtVertex(prev, curr, next);
    const useR = Math.min(r, maxAt);
    const trim = Math.min(useR / Math.tan(half), len0 / 2, len1 / 2);
    const arcR = trim * Math.tan(half);

    const pStart = { x: curr.x + n0x * trim, y: curr.y + n0y * trim };
    const pEnd = { x: curr.x + n1x * trim, y: curr.y + n1y * trim };

    const cross = n0x * n1y - n0y * n1x;
    const sweep = cross < 0 ? 0 : 1;
    const largeArc = angle > Math.PI ? 1 : 0;

    if (!d) d = `M ${pStart.x} ${pStart.y}`;
    else d += ` L ${pStart.x} ${pStart.y}`;
    d += ` A ${arcR} ${arcR} 0 ${largeArc} ${sweep} ${pEnd.x} ${pEnd.y}`;
  }
  return d ? `${d} Z` : "";
}

export function starPathD(
  width: number,
  height: number,
  pointCount: number,
  ratio: number,
  cornerRadius = 0,
): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const spikes = clampStarPointCount(pointCount);
  const r = clampStarRatio(ratio);
  const cr = clampStarCornerRadius(spikes, r, w, h, cornerRadius);
  const verts = starVertices(spikes, r, w, h);
  return roundedPolygonPathD(verts, cr);
}

export type StarParams = {
  pointCount: number;
  ratio: number;
  cornerRadius: number;
};

export function effectiveStarParams(
  node: Pick<
    EditorNode,
    "starPoints" | "starInnerRadius" | "cornerRadius" | "width" | "height"
  >,
): StarParams {
  const pointCount = clampStarPointCount(node.starPoints ?? DEFAULT_STAR_POINTS);
  const ratio = clampStarRatio(node.starInnerRadius ?? DEFAULT_STAR_INNER_RATIO);
  const cornerRadius = clampStarCornerRadius(
    pointCount,
    ratio,
    node.width,
    node.height,
    node.cornerRadius ?? 0,
  );
  return { pointCount, ratio, cornerRadius };
}

export function starPathDForNode(
  node: Pick<
    EditorNode,
    "width" | "height" | "starPoints" | "starInnerRadius" | "cornerRadius"
  >,
  override?: Partial<StarParams>,
): string {
  const base = effectiveStarParams(node);
  const pointCount = override?.pointCount ?? base.pointCount;
  const ratio = override?.ratio ?? base.ratio;
  const cornerRadius = override?.cornerRadius ?? base.cornerRadius;
  return starPathD(node.width, node.height, pointCount, ratio, cornerRadius);
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
    "width" | "height" | "starPoints" | "starInnerRadius" | "cornerRadius"
  >,
  partial: Partial<{
    starPoints: number;
    starInnerRadius: number;
    cornerRadius: number;
  }>,
): Pick<EditorNode, "starPoints" | "starInnerRadius" | "cornerRadius" | "pathPoints"> {
  const pointCount = clampStarPointCount(partial.starPoints ?? node.starPoints ?? DEFAULT_STAR_POINTS);
  const ratio = clampStarRatio(partial.starInnerRadius ?? node.starInnerRadius ?? DEFAULT_STAR_INNER_RATIO);
  const cornerRadius = clampStarCornerRadius(
    pointCount,
    ratio,
    node.width,
    node.height,
    partial.cornerRadius ?? node.cornerRadius ?? 0,
  );
  return {
    starPoints: pointCount,
    starInnerRadius: ratio,
    cornerRadius,
    pathPoints: starPathPoints(pointCount, ratio, node.width, node.height),
  };
}
