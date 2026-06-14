import { Clipper, Path64, Paths64, Point64 } from "clipper2-js";

export type Point2 = { x: number; y: number };

/** Integer scale for Clipper2 coordinates — all paths use the same factor. */
export const BOOLEAN_CLIPPER_SCALE = 10_000;

const COLLINEAR_EPS = 1e-6;
const SIMPLIFY_EPS = 0.25;

function isFinitePoint(p: Point2): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

function pointsNear(a: Point2, b: Point2, eps = COLLINEAR_EPS): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

function cross2(a: Point2, b: Point2, c: Point2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Remove duplicate adjacent vertices and zero-length segments. */
function dedupeAdjacent(points: Point2[]): Point2[] {
  const out: Point2[] = [];
  for (const p of points) {
    if (!isFinitePoint(p)) continue;
    if (out.length === 0 || !pointsNear(out[out.length - 1]!, p)) {
      out.push(p);
    }
  }
  if (out.length >= 2 && pointsNear(out[0]!, out[out.length - 1]!)) {
    out.pop();
  }
  return out;
}

/** Drop middle points that lie on the line between neighbors. */
function simplifyCollinear(points: Point2[]): Point2[] {
  if (points.length < 3) return points;
  const out: Point2[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]!;
    const curr = points[i]!;
    const next = points[(i + 1) % n]!;
    if (Math.abs(cross2(prev, curr, next)) <= COLLINEAR_EPS) continue;
    out.push(curr);
  }
  return out.length >= 3 ? out : points;
}

/** Ensure counter-clockwise winding for positive (outer) contours. */
function ensurePositiveWinding(points: Point2[]): Point2[] {
  if (points.length < 3) return points;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0) return [...points].reverse();
  return points;
}

/**
 * Normalize a single closed contour before Clipper:
 * finite coords, dedupe, collinear simplify, min 3 vertices, CCW winding.
 */
export function normalizePolygonContour(polygon: Point2[]): Point2[] | null {
  if (!polygon || polygon.length < 3) return null;
  let pts = dedupeAdjacent(polygon.filter(isFinitePoint));
  if (pts.length < 3) return null;
  pts = simplifyCollinear(pts);
  if (pts.length < 3) return null;
  pts = ensurePositiveWinding(pts);
  return pts.length >= 3 ? pts : null;
}

export function polygonToPath64(polygon: Point2[]): Path64 {
  const path = new Path64();
  for (const p of polygon) {
    path.push(
      new Point64(
        Math.round(p.x * BOOLEAN_CLIPPER_SCALE),
        Math.round(p.y * BOOLEAN_CLIPPER_SCALE),
      ),
    );
  }
  return path;
}

export function path64ToPolygon(path: Path64): Point2[] {
  return path.map((pt) => ({
    x: pt.x / BOOLEAN_CLIPPER_SCALE,
    y: pt.y / BOOLEAN_CLIPPER_SCALE,
  }));
}

/** Post-Clipper cleanup: strip duplicates, simplify, drop degenerate contours. */
export function normalizePaths64Solution(paths: Paths64): Paths64 {
  const out = new Paths64();
  for (const path of paths) {
    if (path.length < 3) continue;
    let cleaned = Clipper.stripDuplicates(path, true);
    if (cleaned.length < 3) continue;
    cleaned = Clipper.simplifyPath(cleaned, SIMPLIFY_EPS, true);
    if (cleaned.length < 3) continue;
    cleaned = Clipper.trimCollinear(cleaned, false);
    if (cleaned.length < 3) continue;
    out.push(cleaned);
  }
  return out;
}
