/**
 * Vector path helpers for Pen tool and path nodes.
 * Points are in the path node's local coordinate system (origin = top-left of the node's bounds).
 */

export interface PathPoint {
  id: string;
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}

export function newPathPointId(): string {
  return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Parse SVG path `d` (M/L/C/H/V/Z) into path points for import / boolean round-trip. */
export function svgPathDToPathPoints(svgPath: string): PathPoint[] {
  const tokens = svgPath.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens?.length) return [];
  const points: PathPoint[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;

  const readNum = () => parseFloat(tokens[i++] ?? "0");

  while (i < tokens.length) {
    const cmd = tokens[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const c = cmd.toUpperCase();

    if (c === "M") {
      const x = readNum() + (rel ? cx : 0);
      const y = readNum() + (rel ? cy : 0);
      cx = x;
      cy = y;
      startX = x;
      startY = y;
      points.push({ id: newPathPointId(), x, y });
    } else if (c === "L") {
      const x = readNum() + (rel ? cx : 0);
      const y = readNum() + (rel ? cy : 0);
      cx = x;
      cy = y;
      points.push({ id: newPathPointId(), x, y });
    } else if (c === "H") {
      const x = readNum() + (rel ? cx : 0);
      cx = x;
      points.push({ id: newPathPointId(), x, y: cy });
    } else if (c === "V") {
      const y = readNum() + (rel ? cy : 0);
      cy = y;
      points.push({ id: newPathPointId(), x: cx, y });
    } else if (c === "C") {
      const c1x = readNum() + (rel ? cx : 0);
      const c1y = readNum() + (rel ? cy : 0);
      const c2x = readNum() + (rel ? cx : 0);
      const c2y = readNum() + (rel ? cy : 0);
      const x = readNum() + (rel ? cx : 0);
      const y = readNum() + (rel ? cy : 0);
      const prev = points[points.length - 1];
      if (prev) {
        prev.handleOut = { x: c1x - prev.x, y: c1y - prev.y };
      }
      points.push({
        id: newPathPointId(),
        x,
        y,
        handleIn: prev ? { x: c2x - x, y: c2y - y } : undefined,
      });
      cx = x;
      cy = y;
    } else if (c === "Z") {
      cx = startX;
      cy = startY;
    }
  }
  return points;
}

export function pathBounds(points: PathPoint[]): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
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
    if (p.handleIn) bump(p.x + p.handleIn.x, p.y + p.handleIn.y);
    if (p.handleOut) bump(p.x + p.handleOut.x, p.y + p.handleOut.y);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return { x: minX, y: minY, width, height };
}

/** Translate path points so min is (0,0) and expand node x/y/width/height accordingly. */
export function normalizePathNode<T extends { type: string; x: number; y: number; width: number; height: number; pathPoints?: PathPoint[] }>(
  node: T,
): T {
  if (node.type !== "path" || !node.pathPoints?.length) return node;
  const b = pathBounds(node.pathPoints);
  const translated = node.pathPoints.map((p) => ({
    ...p,
    x: p.x - b.x,
    y: p.y - b.y,
  }));
  return {
    ...node,
    x: node.x + b.x,
    y: node.y + b.y,
    width: Math.max(1, b.width),
    height: Math.max(1, b.height),
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
  const c1x = p0.x + (p0.handleOut?.x ?? 0);
  const c1y = p0.y + (p0.handleOut?.y ?? 0);
  const c2x = p1.x + (p1.handleIn?.x ?? 0);
  const c2y = p1.y + (p1.handleIn?.y ?? 0);
  let minD = Infinity;
  let prev = { x: p0.x, y: p0.y };
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const cur = cubicPoint(t, { x: p0.x, y: p0.y }, { x: c1x, y: c1y }, { x: c2x, y: c2y }, { x: p1.x, y: p1.y });
    minD = Math.min(minD, distPointToSegment(px, py, prev.x, prev.y, cur.x, cur.y));
    prev = cur;
  }
  return minD;
}

export function pathToSvgD(points: PathPoint[], closed: boolean): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1]!;
    const p1 = points[i]!;
    const hasCurve = Boolean(p0.handleOut || p1.handleIn);
    if (hasCurve) {
      const c1x = p0.x + (p0.handleOut?.x ?? 0);
      const c1y = p0.y + (p0.handleOut?.y ?? 0);
      const c2x = p1.x + (p1.handleIn?.x ?? 0);
      const c2y = p1.y + (p1.handleIn?.y ?? 0);
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p1.x} ${p1.y}`;
    } else {
      d += ` L ${p1.x} ${p1.y}`;
    }
  }
  if (closed && points.length >= 2) d += " Z";
  return d;
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
    const hasCurve = Boolean(a.handleOut || b.handleIn);
    const d = hasCurve ? distPointToBezier(localX, localY, a, b) : distPointToSegment(localX, localY, a.x, a.y, b.x, b.y);
    if (d <= tol) return true;
  }
  if (closed && points.length >= 2) {
    const a = points[points.length - 1]!;
    const b = points[0]!;
    const hasCurve = Boolean(a.handleOut || b.handleIn);
    const d = hasCurve ? distPointToBezier(localX, localY, a, b) : distPointToSegment(localX, localY, a.x, a.y, b.x, b.y);
    if (d <= tol) return true;
  }
  return false;
}

export function rekeyPathPoints(points: PathPoint[]): PathPoint[] {
  return points.map((p) => ({ ...p, id: newPathPointId() }));
}
