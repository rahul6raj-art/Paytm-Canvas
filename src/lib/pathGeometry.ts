/**
 * Vector path helpers for Pen tool and path nodes.
 * Points are in the path node's local coordinate system (origin = top-left of the node's bounds).
 */

import { parseSvgPathToAbsolute } from "@/lib/svgImport/parseSvgPath";
import { cubicControlPoints, cubicPathD, segmentUsesCubicBezier } from "@/lib/vector/bezierGeometry";

export interface PathPoint {
  id: string;
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
  /** Corner vs smooth (Figma-style anchor type). */
  pointType?: "corner" | "smooth";
  /** Per-node corner radius for straight-segment vector paths. */
  cornerRadius?: number;
}

export function newPathPointId(): string {
  return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Deep-copy path anchors for resize drag snapshots (live preview must not mutate). */
export function clonePathPoints(points: PathPoint[] | undefined): PathPoint[] | undefined {
  if (!points?.length) return undefined;
  return points.map((p) => ({
    ...p,
    handleIn: p.handleIn ? { ...p.handleIn } : undefined,
    handleOut: p.handleOut ? { ...p.handleOut } : undefined,
  }));
}

/** Scale path anchors and Bézier handles when the path node's frame is resized. */
export function scalePathPoints(points: PathPoint[], sx: number, sy: number): PathPoint[] {
  return points.map((p) => ({
    ...p,
    x: p.x * sx,
    y: p.y * sy,
    handleIn: p.handleIn ? { x: p.handleIn.x * sx, y: p.handleIn.y * sy } : undefined,
    handleOut: p.handleOut ? { x: p.handleOut.x * sx, y: p.handleOut.y * sy } : undefined,
  }));
}

/** Parse SVG path `d` (M/L/H/V/C/S/Q/T/A/Z) into editable path points for import. */
export function svgPathDToPathPoints(svgPath: string): PathPoint[] {
  const segments = parseSvgPathToAbsolute(svgPath);
  const points: PathPoint[] = [];
  for (const seg of segments) {
    if (seg.type === "M") {
      points.push({ id: newPathPointId(), x: seg.x, y: seg.y });
    } else if (seg.type === "L") {
      points.push({ id: newPathPointId(), x: seg.x, y: seg.y });
    } else if (seg.type === "C") {
      const prev = points[points.length - 1];
      if (prev) {
        prev.handleOut = { x: seg.x1 - prev.x, y: seg.y1 - prev.y };
      }
      points.push({
        id: newPathPointId(),
        x: seg.x,
        y: seg.y,
        handleIn: prev ? { x: seg.x2 - seg.x, y: seg.y2 - seg.y } : undefined,
      });
    }
  }
  return points;
}

export function pathBounds(
  points: PathPoint[],
  opts?: { includeHandles?: boolean },
): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const includeHandles = opts?.includeHandles ?? true;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const bump = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const p of points) {
    bump(p.x, p.y);
    if (includeHandles) {
      if (p.handleIn) bump(p.x + p.handleIn.x, p.y + p.handleIn.y);
      if (p.handleOut) bump(p.x + p.handleOut.x, p.y + p.handleOut.y);
    }
  }
  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  return { x: minX, y: minY, width, height };
}

/** Collapse sub-pixel axis span so straight pen strokes get 0 width/height (Figma-style). */
const PATH_AXIS_FLATTEN_PX = 1;

export function flattenNearAxisPathPoints(points: PathPoint[]): PathPoint[] {
  if (points.length < 2) return points;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  let out = points;
  if (spanY > 0 && spanY < PATH_AXIS_FLATTEN_PX) {
    const y = minY;
    out = out.map((p) => ({ ...p, y }));
  }
  if (spanX > 0 && spanX < PATH_AXIS_FLATTEN_PX) {
    const x = minX;
    out = out.map((p) => ({ ...p, x }));
  }
  return out;
}

export function normalizePathNode<T extends { type: string; x: number; y: number; width: number; height: number; pathPoints?: PathPoint[] }>(
  node: T,
): T {
  if (node.type !== "path" || !node.pathPoints?.length) return node;
  const flattened = flattenNearAxisPathPoints(node.pathPoints);
  // Anchor-only bounds: dragging Bézier handles must not rebase the path origin each frame.
  const b = pathBounds(flattened, { includeHandles: false });
  const translated = flattened.map((p) => ({
    ...p,
    x: p.x - b.x,
    y: p.y - b.y,
  }));
  return {
    ...node,
    x: node.x + b.x,
    y: node.y + b.y,
    width: b.width,
    height: b.height,
    pathPoints: translated,
  };
}

function cubicPoint(
  t: number,
  p0: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  p1: { x: number; y: number },
): { x: number; y: number } {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * p0.x + 3 * uu * t * c1.x + 3 * u * tt * c2.x + tt * t * p1.x,
    y: uu * u * p0.y + 3 * uu * t * c1.y + 3 * u * tt * c2.y + tt * t * p1.y,
  };
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function distPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-12) return Math.sqrt(distSq(px, py, ax, ay));
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + abx * t;
  const qy = ay + aby * t;
  return Math.sqrt(distSq(px, py, qx, qy));
}

function distPointToBezier(
  px: number,
  py: number,
  p0: PathPoint,
  p1: PathPoint,
  samples = 24,
): number {
  const { c1, c2, end } = cubicControlPoints(p0, p1);
  let minD = Infinity;
  let prev = { x: p0.x, y: p0.y };
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const cur = cubicPoint(t, { x: p0.x, y: p0.y }, c1, c2, end);
    minD = Math.min(minD, distPointToSegment(px, py, prev.x, prev.y, cur.x, cur.y));
    prev = cur;
  }
  return minD;
}

export function pathToSvgD(points: PathPoint[], closed: boolean): string {
  return cubicPathD(points, closed);
}

/** Local-space hit test: anchor hit (square half-size ≈ threshold). */
export function hitTestPathPoint(localX: number, localY: number, points: PathPoint[], threshold: number): string | null {
  const t2 = threshold * threshold;
  for (const p of points) {
    const dx = p.x - localX;
    const dy = p.y - localY;
    if (dx * dx + dy * dy <= t2) return p.id;
  }
  return null;
}

/** Local-space: distance from point to stroke polyline / cubic segments. */
export function hitTestPathStroke(
  localX: number,
  localY: number,
  points: PathPoint[],
  closed: boolean,
  strokeTolerance: number,
): boolean {
  if (points.length < 2) return false;
  const tol = Math.max(strokeTolerance, 6);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const hasCurve = segmentUsesCubicBezier(a, b);
    const d = hasCurve ? distPointToBezier(localX, localY, a, b) : distPointToSegment(localX, localY, a.x, a.y, b.x, b.y);
    if (d <= tol) return true;
  }
  if (closed && points.length >= 2) {
    const a = points[points.length - 1]!;
    const b = points[0]!;
    const hasCurve = segmentUsesCubicBezier(a, b);
    const d = hasCurve ? distPointToBezier(localX, localY, a, b) : distPointToSegment(localX, localY, a.x, a.y, b.x, b.y);
    if (d <= tol) return true;
  }
  return false;
}

export function rekeyPathPoints(points: PathPoint[]): PathPoint[] {
  return points.map((p) => ({ ...p, id: newPathPointId() }));
}
