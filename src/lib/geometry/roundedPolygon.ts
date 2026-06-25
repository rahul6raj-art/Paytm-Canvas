import {
  clamp,
  circularFilletArcSweep,
  distance,
  interiorAngleAtVertex,
  normalize,
  type Point2,
} from "./roundedCornerUtils";

export type RoundedPolygonOptions = {
  /** Shape-relative rounding amount in [0, 1]. 1 = maximum valid rounding. */
  radiusPercent?: number;
  /** Absolute geometric fillet radius in local px. */
  cornerRadius?: number;
  /** Per-vertex geometric fillet radii (uniformly scaled to satisfy edge constraints). */
  cornerRadii?: readonly number[];
  /** 0 = circular tangent arcs, 1 = Figma-style squircle smoothing. */
  cornerSmoothing?: number;
};

export type ResolvedCornerSegment = {
  vertex: Point2;
  /** Geometric fillet radius. */
  radius: number;
  start: Point2;
  end: Point2;
  /** SVG path fragment from `start` to `end` (includes leading L to start when needed). */
  curveD: string;
};

const EPS = 1e-9;

function cotHalfAngle(interiorAngle: number): number {
  const half = interiorAngle / 2;
  if (half < EPS) return Infinity;
  return 1 / Math.tan(half);
}

/** Edge budget consumed by a fillet of radius `r` at a vertex with interior angle `alpha`. */
export function edgeTrimForFilletRadius(
  radius: number,
  interiorAngle: number,
  cornerSmoothing = 0,
): number {
  if (radius <= 0) return 0;
  const s = clamp(cornerSmoothing, 0, 1);
  return ((1 + s) * radius) / Math.tan(interiorAngle / 2);
}

/**
 * Maximum uniform geometric fillet radius for a closed convex polygon.
 * Uses edge-coupled constraints so adjacent corners never overlap.
 */
export function maxUniformFilletRadius(
  vertices: readonly Point2[],
  cornerSmoothing = 0,
): number {
  const n = vertices.length;
  if (n < 3) return 0;
  const s = clamp(cornerSmoothing, 0, 1);
  const factor = 1 + s;
  let maxR = Infinity;

  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n]!;
    const curr = vertices[i]!;
    const next = vertices[(i + 1) % n]!;
    const alpha = interiorAngleAtVertex(prev, curr, next);
    const halfTan = Math.tan(alpha / 2);
    if (halfTan < EPS) continue;
    const vtxMax = Math.min(distance(curr, prev), distance(curr, next)) * halfTan;
    maxR = Math.min(maxR, vtxMax / factor);
  }

  for (let i = 0; i < n; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    const prev = vertices[(i - 1 + n) % n]!;
    const next = vertices[(i + 2) % n]!;
    const edgeLen = distance(a, b);
    const alphaA = interiorAngleAtVertex(prev, a, b);
    const alphaB = interiorAngleAtVertex(a, b, next);
    const denom = factor * (cotHalfAngle(alphaA) + cotHalfAngle(alphaB));
    if (denom > EPS) maxR = Math.min(maxR, edgeLen / denom);
  }

  return Number.isFinite(maxR) ? Math.max(0, maxR) : 0;
}

export function cornerRadiusToPercent(
  vertices: readonly Point2[],
  cornerRadius: number,
  cornerSmoothing = 0,
): number {
  const maxR = maxUniformFilletRadius(vertices, cornerSmoothing);
  if (maxR <= EPS) return 0;
  return clamp(cornerRadius / maxR, 0, 1);
}

export function percentToCornerRadius(
  vertices: readonly Point2[],
  radiusPercent: number,
  cornerSmoothing = 0,
): number {
  return clamp(radiusPercent, 0, 1) * maxUniformFilletRadius(vertices, cornerSmoothing);
}

function resolveRequestedRadii(
  vertices: readonly Point2[],
  options: RoundedPolygonOptions,
): number[] {
  const n = vertices.length;
  const smoothing = options.cornerSmoothing ?? 0;
  const maxR = maxUniformFilletRadius(vertices, smoothing);

  if (options.radiusPercent != null) {
    const r = percentToCornerRadius(vertices, options.radiusPercent, smoothing);
    return Array.from({ length: n }, () => r);
  }

  if (options.cornerRadii?.length) {
    return Array.from({ length: n }, (_, i) =>
      clamp(Math.max(0, options.cornerRadii![i] ?? options.cornerRadii![0] ?? 0), 0, maxR),
    );
  }

  const r = clamp(Math.max(0, options.cornerRadius ?? 0), 0, maxR);
  return Array.from({ length: n }, () => r);
}

/** Uniformly scale radii until all edge trim constraints are satisfied. */
export function scaleRadiiToEdgeConstraints(
  vertices: readonly Point2[],
  radii: readonly number[],
  cornerSmoothing = 0,
): number[] {
  const n = vertices.length;
  if (n < 3) return radii.map((r) => Math.max(0, r));
  const s = clamp(cornerSmoothing, 0, 1);
  const factor = 1 + s;
  let scale = 1;

  for (let i = 0; i < n; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    const prev = vertices[(i - 1 + n) % n]!;
    const next = vertices[(i + 2) % n]!;
    const edgeLen = distance(a, b);
    const alphaA = interiorAngleAtVertex(prev, a, b);
    const alphaB = interiorAngleAtVertex(a, b, next);
    const usage =
      radii[i]! * cotHalfAngle(alphaA) + radii[(i + 1) % n]! * cotHalfAngle(alphaB);
    if (usage > EPS) scale = Math.min(scale, edgeLen / (factor * usage));
  }

  return radii.map((r) => Math.max(0, r * scale));
}

type SquircleParams = {
  a: number;
  b: number;
  c: number;
  d: number;
  p: number;
  arcSectionLength: number;
  cornerRadius: number;
  arcMeasure: number;
};

function squircleParamsForCorner(
  geometricRadius: number,
  interiorAngle: number,
  cornerSmoothing: number,
  edgeBudget: number,
): SquircleParams {
  const alpha = interiorAngle;
  const beta = Math.PI - alpha;
  const q = geometricRadius / Math.tan(alpha / 2);
  let s = clamp(cornerSmoothing, 0, 1);
  let p = (1 + s) * q;
  if (p > edgeBudget + EPS) {
    s = Math.max(0, edgeBudget / Math.max(q, EPS) - 1);
    p = Math.min(p, edgeBudget);
  }

  const arcMeasure = beta * (1 - s);
  const sinHalfBeta = Math.sin(beta / 2);
  const arcSectionLength =
    sinHalfBeta > EPS
      ? (Math.sin(arcMeasure / 2) * geometricRadius) / sinHalfBeta
      : 0;

  const angleAlpha = (beta - arcMeasure) / 2;
  const p3ToP4Distance = geometricRadius * Math.tan(angleAlpha / 2);
  const angleBeta = (beta / 2) * s;
  const c = p3ToP4Distance * Math.cos(angleBeta);
  const dLen = c * Math.tan(angleBeta);

  let bLen = (p - arcSectionLength - c - dLen) / 3;
  let aLen = 2 * bLen;
  if (aLen < 0 || bLen < 0) {
    aLen = 0;
    bLen = 0;
  }

  return {
    a: aLen,
    b: bLen,
    c,
    d: dLen,
    p,
    arcSectionLength,
    cornerRadius: geometricRadius,
    arcMeasure,
  };
}

function toLocal(
  point: Point2,
  origin: Point2,
  travel: Point2,
  perp: Point2,
): Point2 {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: dx * travel.x + dy * travel.y,
    y: dx * perp.x + dy * perp.y,
  };
}

function fromLocal(local: Point2, origin: Point2, travel: Point2, perp: Point2): Point2 {
  return {
    x: origin.x + travel.x * local.x + perp.x * local.y,
    y: origin.y + travel.y * local.x + perp.y * local.y,
  };
}

function fmt(n: number): string {
  const v = Math.abs(n) < 1e-6 ? 0 : n;
  return Number(v.toFixed(4)).toString();
}

/** Emit squircle corner in local travel/perp frame (travel = into corner, perp = inward). */
function squircleCornerCurveD(
  params: SquircleParams,
  travel: Point2,
  perp: Point2,
  origin: Point2,
  leave: Point2,
  prev: Point2,
  next: Point2,
): { start: Point2; end: Point2; curveD: string } {
  const { a, b, c, d, p, arcSectionLength, cornerRadius } = params;
  const startLocal = { x: -p, y: 0 };
  const start = fromLocal(startLocal, origin, travel, perp);

  if (cornerRadius <= EPS || p <= EPS) {
    const end = origin;
    return { start, end, curveD: `L ${fmt(start.x)} ${fmt(start.y)} L ${fmt(end.x)} ${fmt(end.y)}` };
  }

  const leaveLocal = toLocal(
    { x: origin.x + leave.x, y: origin.y + leave.y },
    origin,
    travel,
    perp,
  );
  const leaveLen = Math.hypot(leaveLocal.x, leaveLocal.y);
  const lx = leaveLocal.x / leaveLen;
  const ly = leaveLocal.y / leaveLen;

  const c1 = { x: startLocal.x + a, y: 0 };
  const c2 = { x: startLocal.x + a + b, y: 0 };
  const c3 = { x: startLocal.x + a + b + c, y: d };
  const arcStart = c3;
  const arcEnd = {
    x: arcStart.x - arcSectionLength * lx,
    y: arcStart.y + arcSectionLength * ly,
  };
  const arcK = (4 / 3) * Math.tan(params.arcMeasure / 4);
  const arcC1 = {
    x: arcStart.x - arcSectionLength * arcK * lx,
    y: arcStart.y,
  };
  const arcC2 = {
    x: arcEnd.x,
    y: arcEnd.y - arcSectionLength * arcK * ly,
  };
  const c4 = { x: arcEnd.x - d * lx, y: arcEnd.y - d * ly };
  const c5 = { x: c4.x - c * lx, y: c4.y - c * ly };
  const c6 = { x: c5.x - b * lx, y: c5.y - b * ly };
  const endLocal = { x: p * lx, y: p * ly };
  const end = fromLocal(endLocal, origin, travel, perp);

  const p1 = fromLocal(c1, origin, travel, perp);
  const p2 = fromLocal(c2, origin, travel, perp);
  const p3 = fromLocal(c3, origin, travel, perp);
  const pArc1 = fromLocal(arcC1, origin, travel, perp);
  const pArc2 = fromLocal(arcC2, origin, travel, perp);
  const pArc = fromLocal(arcEnd, origin, travel, perp);
  const p4 = fromLocal(c4, origin, travel, perp);
  const p5 = fromLocal(c5, origin, travel, perp);
  const p6 = fromLocal(c6, origin, travel, perp);

  const sweep = circularFilletArcSweep(prev, origin, next);
  const curveD = [
    `L ${fmt(start.x)} ${fmt(start.y)}`,
    `C ${fmt(p1.x)} ${fmt(p1.y)} ${fmt(p2.x)} ${fmt(p2.y)} ${fmt(p3.x)} ${fmt(p3.y)}`,
    `C ${fmt(pArc1.x)} ${fmt(pArc1.y)} ${fmt(pArc2.x)} ${fmt(pArc2.y)} ${fmt(pArc.x)} ${fmt(pArc.y)}`,
    `C ${fmt(p4.x)} ${fmt(p4.y)} ${fmt(p5.x)} ${fmt(p5.y)} ${fmt(p6.x)} ${fmt(p6.y)}`,
    `L ${fmt(end.x)} ${fmt(end.y)}`,
  ].join(" ");

  return { start, end, curveD };
}

function circularCornerCurveD(
  prev: Point2,
  curr: Point2,
  next: Point2,
  radius: number,
): { start: Point2; end: Point2; curveD: string } {
  const uIn = normalize({ x: prev.x - curr.x, y: prev.y - curr.y });
  const uOut = normalize({ x: next.x - curr.x, y: next.y - curr.y });
  const alpha = interiorAngleAtVertex(prev, curr, next);
  const trim = radius / Math.tan(alpha / 2);
  const start = { x: curr.x + uIn.x * trim, y: curr.y + uIn.y * trim };
  const end = { x: curr.x + uOut.x * trim, y: curr.y + uOut.y * trim };

  if (radius <= EPS) {
    return { start, end, curveD: `L ${fmt(start.x)} ${fmt(start.y)} L ${fmt(curr.x)} ${fmt(curr.y)}` };
  }

  const sweep = circularFilletArcSweep(prev, curr, next);
  return {
    start,
    end,
    curveD: `L ${fmt(start.x)} ${fmt(start.y)} A ${fmt(radius)} ${fmt(radius)} 0 0 ${sweep} ${fmt(end.x)} ${fmt(end.y)}`,
  };
}

function inwardPerp(travel: Point2, interiorBisector: Point2): Point2 {
  let perp = { x: -travel.y, y: travel.x };
  if (perp.x * interiorBisector.x + perp.y * interiorBisector.y < 0) {
    perp = { x: -perp.x, y: -perp.y };
  }
  return perp;
}

function buildCornerSegment(
  prev: Point2,
  curr: Point2,
  next: Point2,
  radius: number,
  cornerSmoothing: number,
  edgeBudget: number,
): ResolvedCornerSegment {
  const travel = normalize({ x: curr.x - prev.x, y: curr.y - prev.y });
  const leave = normalize({ x: next.x - curr.x, y: next.y - curr.y });
  const uIn = normalize({ x: prev.x - curr.x, y: prev.y - curr.y });
  const uOut = normalize({ x: next.x - curr.x, y: next.y - curr.y });
  const bis = normalize({ x: uIn.x + uOut.x, y: uIn.y + uOut.y });
  const perp = inwardPerp(travel, bis);
  const alpha = interiorAngleAtVertex(prev, curr, next);
  const r = Math.max(0, radius);

  if (r <= EPS) {
    return {
      vertex: curr,
      radius: 0,
      start: curr,
      end: curr,
      curveD: `L ${fmt(curr.x)} ${fmt(curr.y)}`,
    };
  }

  const s = clamp(cornerSmoothing, 0, 1);
  if (s <= EPS) {
    const circular = circularCornerCurveD(prev, curr, next, r);
    return { vertex: curr, radius: r, ...circular };
  }

  const params = squircleParamsForCorner(r, alpha, s, edgeBudget);
  const squircle = squircleCornerCurveD(params, travel, perp, curr, leave, prev, next);
  return { vertex: curr, radius: r, ...squircle };
}

function edgeBudgetForCorner(
  vertices: readonly Point2[],
  radii: readonly number[],
  index: number,
  cornerSmoothing: number,
): number {
  const n = vertices.length;
  const prev = vertices[(index - 1 + n) % n]!;
  const curr = vertices[index]!;
  const next = vertices[(index + 1) % n]!;
  const lenIn = distance(curr, prev);
  const lenOut = distance(curr, next);
  const alphaIn = interiorAngleAtVertex(
    vertices[(index - 2 + n) % n]!,
    prev,
    curr,
  );
  const alphaOut = interiorAngleAtVertex(prev, curr, next);
  const alphaNext = interiorAngleAtVertex(curr, next, vertices[(index + 2) % n]!);
  const s = clamp(cornerSmoothing, 0, 1);
  const factor = 1 + s;
  const incoming =
    lenIn - factor * radii[(index - 1 + n) % n]! * cotHalfAngle(alphaIn);
  const outgoing = lenOut - factor * radii[(index + 1) % n]! * cotHalfAngle(alphaNext);
  const localEdge = Math.min(incoming, outgoing);
  const selfEdge = Math.min(
    lenIn - factor * radii[index]! * cotHalfAngle(alphaOut),
    lenOut - factor * radii[index]! * cotHalfAngle(alphaOut),
  );
  return Math.max(0, Math.min(localEdge, selfEdge, lenIn / 2, lenOut / 2));
}

export function resolveRoundedPolygonCorners(
  vertices: readonly Point2[],
  options: RoundedPolygonOptions = {},
): ResolvedCornerSegment[] {
  const n = vertices.length;
  if (n < 3) return [];
  const smoothing = options.cornerSmoothing ?? 0;
  const requested = resolveRequestedRadii(vertices, options);
  const radii = scaleRadiiToEdgeConstraints(vertices, requested, smoothing);

  return Array.from({ length: n }, (_, i) => {
    const prev = vertices[(i - 1 + n) % n]!;
    const curr = vertices[i]!;
    const next = vertices[(i + 1) % n]!;
    const budget = edgeBudgetForCorner(vertices, radii, i, smoothing);
    return buildCornerSegment(prev, curr, next, radii[i]!, smoothing, budget);
  });
}

export function buildRoundedPolygonPathSvgD(
  vertices: readonly Point2[],
  options: RoundedPolygonOptions = {},
  closed = true,
): string {
  const n = vertices.length;
  if (n === 0) return "";
  if (n === 1) return `M ${fmt(vertices[0]!.x)} ${fmt(vertices[0]!.y)}`;
  if (n === 2) {
    return `M ${fmt(vertices[0]!.x)} ${fmt(vertices[0]!.y)} L ${fmt(vertices[1]!.x)} ${fmt(vertices[1]!.y)}`;
  }
  if (!closed) {
    return buildOpenRoundedPathSvgD(vertices, options);
  }

  const corners = resolveRoundedPolygonCorners(vertices, options);
  if (corners.every((c) => c.radius <= EPS)) {
    let d = `M ${fmt(vertices[0]!.x)} ${fmt(vertices[0]!.y)}`;
    for (let i = 1; i < n; i++) d += ` L ${fmt(vertices[i]!.x)} ${fmt(vertices[i]!.y)}`;
    return `${d} Z`;
  }

  let d = `M ${fmt(corners[0]!.end.x)} ${fmt(corners[0]!.end.y)}`;
  for (let i = 0; i < n; i++) {
    d += ` ${corners[(i + 1) % n]!.curveD}`;
  }
  return `${d} Z`;
}

function buildOpenRoundedPathSvgD(
  vertices: readonly Point2[],
  options: RoundedPolygonOptions,
): string {
  const n = vertices.length;
  let d = `M ${fmt(vertices[0]!.x)} ${fmt(vertices[0]!.y)}`;
  for (let i = 1; i < n - 1; i++) {
    const seg = buildCornerSegment(
      vertices[i - 1]!,
      vertices[i]!,
      vertices[i + 1]!,
      resolveRequestedRadii(vertices, options)[i] ?? 0,
      options.cornerSmoothing ?? 0,
      distance(vertices[i - 1]!, vertices[i]!),
    );
    d += ` ${seg.curveD} L ${fmt(vertices[i + 1]!.x)} ${fmt(vertices[i + 1]!.y)}`;
  }
  return d;
}

export function buildRoundedPolygonPath2D(
  vertices: readonly Point2[],
  options: RoundedPolygonOptions = {},
  closed = true,
): Path2D {
  return new Path2D(buildRoundedPolygonPathSvgD(vertices, options, closed));
}

/** Max geometric fillet radius at a single vertex (before edge coupling). */
export function maxFilletRadiusAtVertex(
  prev: Point2,
  curr: Point2,
  next: Point2,
  cornerSmoothing = 0,
): number {
  const alpha = interiorAngleAtVertex(prev, curr, next);
  const halfTan = Math.tan(alpha / 2);
  if (halfTan < EPS) return 0;
  const factor = 1 + clamp(cornerSmoothing, 0, 1);
  return (Math.min(distance(curr, prev), distance(curr, next)) * halfTan) / factor;
}
