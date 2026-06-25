import { offsetRoundedRectPathD, roundedRectPathD, type CornerRadii } from "@/lib/cornerRadius";
import type { StrokeLinejoin } from "@/lib/stroke";
import type { StrokeAlign } from "@/lib/strokeSpec";

export { offsetRoundedRectPathD };

export type Point2 = { x: number; y: number };

function dist(x: number, y: number): number {
  return Math.hypot(x, y);
}

function normalize(v: Point2): Point2 {
  const l = dist(v.x, v.y);
  if (l < 1e-9) return { x: 0, y: 0 };
  return { x: v.x / l, y: v.y / l };
}

/** Signed offset distance for stroke centerline from outer contour. */
export function strokeCenterlineOffset(align: StrokeAlign, strokeWidth: number): number {
  const half = Math.max(0, strokeWidth) / 2;
  if (align === "inside") return -half;
  if (align === "outside") return half;
  return 0;
}

/** Offset closed polygon vertices (CCW = positive area → outward is left normal). */
export function offsetPolygonPoints(
  points: Point2[],
  delta: number,
  join: StrokeLinejoin = "miter",
): Point2[] {
  const n = points.length;
  if (n < 3 || Math.abs(delta) < 1e-9) return points.map((p) => ({ ...p }));

  const miterLimit = join === "miter" ? 4 : 1;
  const out: Point2[] = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]!;
    const curr = points[i]!;
    const next = points[(i + 1) % n]!;

    const e1 = normalize({ x: curr.x - prev.x, y: curr.y - prev.y });
    const e2 = normalize({ x: next.x - curr.x, y: next.y - curr.y });
    /** Outward normal for clockwise paths (SVG y-down). */
    const n1 = { x: e1.y, y: -e1.x };
    const n2 = { x: e2.y, y: -e2.x };

    let nx = n1.x + n2.x;
    let ny = n1.y + n2.y;
    const nl = dist(nx, ny);
    if (nl < 1e-9) {
      out.push({ x: curr.x + n1.x * delta, y: curr.y + n1.y * delta });
      continue;
    }
    nx /= nl;
    ny /= nl;

    const cross = e1.x * e2.y - e1.y * e2.x;
    const sinHalf = Math.abs(cross) > 1e-9 ? cross / 2 : 1;
    let miterLen = delta / sinHalf;
    const dot = n1.x * nx + n1.y * ny;
    if (Math.abs(dot) > 1e-9) miterLen = delta / dot;

    if (join === "bevel" || (join === "miter" && Math.abs(miterLen) > Math.abs(delta) * miterLimit)) {
      out.push({ x: curr.x + n1.x * delta, y: curr.y + n1.y * delta });
      continue;
    }

    if (join === "round") {
      out.push({ x: curr.x + nx * delta, y: curr.y + ny * delta });
      continue;
    }

    out.push({ x: curr.x + nx * miterLen, y: curr.y + ny * miterLen });
  }

  return out;
}

export function pointsToClosedPathD(points: Point2[]): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  return `M ${first!.x} ${first!.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")} Z`;
}

/** Inset/outset axis-aligned rectangle (sharp corners). */
export function offsetSharpRectPathD(
  width: number,
  height: number,
  delta: number,
): string {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  if (w <= 0 || h <= 0) return "";
  const x0 = delta;
  const y0 = delta;
  const x1 = w - delta;
  const y1 = h - delta;
  if (x1 - x0 < 1e-6 || y1 - y0 < 1e-6) return "";
  return `M ${x0} ${y0} H ${x1} V ${y1} H ${x0} Z`;
}

/** Ellipse / circle contour offset by adjusting radii. */
export function offsetEllipsePathD(
  width: number,
  height: number,
  delta: number,
  segments = 64,
): string {
  const rx = Math.max(0, width / 2 - delta);
  const ry = Math.max(0, height / 2 - delta);
  if (rx < 1e-6 || ry < 1e-6) return "";
  const cx = width / 2;
  const cy = height / 2;
  const parts: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = cx + rx * Math.cos(t);
    const y = cy + ry * Math.sin(t);
    parts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

/** Offset arbitrary closed polyline path. */
export function offsetClosedPolylinePathD(
  points: Point2[],
  delta: number,
  join: StrokeLinejoin,
): string {
  if (points.length < 3) return "";
  const offset = offsetPolygonPoints(points, delta, join);
  return pointsToClosedPathD(offset);
}

export function offsetContourPathD(
  kind: "sharpRect" | "roundedRect" | "ellipse" | "polygon",
  params: {
    width: number;
    height: number;
    radii?: CornerRadii;
    cornerSmoothing?: number;
    points?: Point2[];
    join?: StrokeLinejoin;
  },
  align: StrokeAlign,
  strokeWidth: number,
): string | null {
  const delta = strokeCenterlineOffset(align, strokeWidth);
  const smoothing = params.cornerSmoothing ?? 0;
  if (Math.abs(delta) < 1e-9) {
    if (kind === "sharpRect") return offsetSharpRectPathD(params.width, params.height, 0);
    if (kind === "roundedRect" && params.radii)
      return roundedRectPathD(params.width, params.height, params.radii, { x: 0, y: 0 }, smoothing);
    if (kind === "ellipse") return offsetEllipsePathD(params.width, params.height, 0);
    if (kind === "polygon" && params.points?.length)
      return pointsToClosedPathD(params.points);
    return null;
  }

  const join = params.join ?? "miter";

  if (kind === "sharpRect") {
    const d = offsetSharpRectPathD(params.width, params.height, delta);
    return d || null;
  }
  if (kind === "roundedRect" && params.radii) {
    const d = offsetRoundedRectPathD(params.width, params.height, params.radii, delta, smoothing);
    return d || null;
  }
  if (kind === "ellipse") {
    const d = offsetEllipsePathD(params.width, params.height, delta);
    return d || null;
  }
  if (kind === "polygon" && params.points?.length) {
    const d = offsetClosedPolylinePathD(params.points, delta, join);
    return d || null;
  }
  return null;
}
