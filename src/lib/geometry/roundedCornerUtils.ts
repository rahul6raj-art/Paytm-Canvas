export type Point2 = { x: number; y: number };

export type RoundedCorner = {
  vertex: Point2;
  radius: number;
  start: Point2;
  end: Point2;
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

/** Max fillet radius for quadratic corner fillets (Figma-style). */
export function maxQuadraticCornerRadiusAtVertex(
  prev: Point2,
  curr: Point2,
  next: Point2,
): number {
  return Math.min(distance(curr, prev), distance(curr, next)) / 2;
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

  const maxRadius = Math.min(lenPrev, lenNext) / 2;
  const radius = clamp(requestedRadius || 0, 0, maxRadius);

  return {
    vertex: curr,
    radius,
    start: {
      x: curr.x + toPrev.x * radius,
      y: curr.y + toPrev.y * radius,
    },
    end: {
      x: curr.x + toNext.x * radius,
      y: curr.y + toNext.y * radius,
    },
  };
}
