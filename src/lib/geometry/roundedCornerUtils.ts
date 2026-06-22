export type Point2 = { x: number; y: number };

export type RoundedCorner = {
  /** Figma corner-radius parameter (bisector / edge-trim distance). */
  vertex: Point2;
  radius: number;
  /** Circular arc radius for the fillet curve (equals `radius` at 90° corners). */
  arcRadius: number;
  start: Point2;
  end: Point2;
  /** SVG elliptical-arc sweep flag (0 | 1). */
  arcSweep: 0 | 1;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function normalize(v: Point2): Point2 {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-12) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/** Interior angle (radians) between incoming and outgoing edges at `curr`. */
export function interiorAngleAtVertex(prev: Point2, curr: Point2, next: Point2): number {
  const toPrev = normalize({ x: prev.x - curr.x, y: prev.y - curr.y });
  const toNext = normalize({ x: next.x - curr.x, y: next.y - curr.y });
  const dot = clamp(toPrev.x * toNext.x + toPrev.y * toNext.y, -1, 1);
  return Math.acos(dot);
}

/**
 * Figma vertex corner radius clamp: adjacent fillets overlap when R exceeds half
 * the shorter edge (same rule for polygons, stars, and vector points).
 */
export function maxFigmaVertexCornerRadius(lenPrev: number, lenNext: number): number {
  return Math.min(lenPrev, lenNext) / 2;
}

/** @deprecated Use `maxFigmaVertexCornerRadius` — kept for existing imports. */
export function maxQuadraticCornerRadiusAtVertex(
  prev: Point2,
  curr: Point2,
  next: Point2,
): number {
  return maxFigmaVertexCornerRadius(distance(curr, prev), distance(curr, next));
}

/**
 * Figma maps the UI corner-radius value R to a circular fillet whose tangent
 * points sit R px along each edge. Geometric arc radius = R * tan(θ/2).
 */
export function figmaCornerRadiusToArcRadius(
  cornerRadius: number,
  interiorAngle: number,
): number {
  const half = interiorAngle / 2;
  if (half < 1e-6 || cornerRadius <= 0) return 0;
  return cornerRadius * Math.tan(half);
}

/** SVG sweep flag for a convex exterior fillet (SVG y-down coordinates). */
export function circularFilletArcSweep(prev: Point2, curr: Point2, next: Point2): 0 | 1 {
  const v0x = prev.x - curr.x;
  const v0y = prev.y - curr.y;
  const v1x = next.x - curr.x;
  const v1y = next.y - curr.y;
  const cross = v0x * v1y - v0y * v1x;
  return cross > 0 ? 0 : 1;
}

export function calculateRoundedCorner(
  prev: Point2,
  curr: Point2,
  next: Point2,
  requestedRadius: number,
): RoundedCorner {
  const toPrev = normalize({ x: prev.x - curr.x, y: prev.y - curr.y });
  const toNext = normalize({ x: next.x - curr.x, y: next.y - curr.y });

  const lenPrev = distance(curr, prev);
  const lenNext = distance(curr, next);

  const maxRadius = maxFigmaVertexCornerRadius(lenPrev, lenNext);
  const radius = clamp(requestedRadius || 0, 0, maxRadius);
  const interiorAngle = interiorAngleAtVertex(prev, curr, next);
  const arcRadius = figmaCornerRadiusToArcRadius(radius, interiorAngle);

  return {
    vertex: curr,
    radius,
    arcRadius,
    start: {
      x: curr.x + toPrev.x * radius,
      y: curr.y + toPrev.y * radius,
    },
    end: {
      x: curr.x + toNext.x * radius,
      y: curr.y + toNext.y * radius,
    },
    arcSweep: circularFilletArcSweep(prev, curr, next),
  };
}
