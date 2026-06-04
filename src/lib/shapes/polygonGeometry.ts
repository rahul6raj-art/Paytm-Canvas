import type { EditorNode } from "@/stores/useEditorStore";
import { newPathPointId, type PathPoint } from "@/lib/pathGeometry";
import { screenPxToWorld } from "@/lib/canvasVisual";
import {
  maxCornerRadiusAtVertex,
  roundedPolygonPathD,
  type Point2,
} from "@/lib/shapes/starGeometry";

export const POLYGON_SIDES_MIN = 3;
export const POLYGON_SIDES_MAX = 100;
export const DEFAULT_POLYGON_SIDES = 6;

export function isPolygonNode(
  node: Pick<EditorNode, "type" | "polygonSides" | "starPoints"> | null | undefined,
): boolean {
  if (!node) return false;
  if (node.type === "polygon") return true;
  return node.type === "path" && node.polygonSides != null && node.starPoints == null;
}

export function clampPolygonSides(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_POLYGON_SIDES;
  return Math.max(POLYGON_SIDES_MIN, Math.min(POLYGON_SIDES_MAX, Math.round(n)));
}

/** Regular polygon vertices in local box space (first vertex at top). */
export function polygonVertices(
  sides: number,
  width: number,
  height: number,
): Point2[] {
  const n = clampPolygonSides(sides);
  const cx = width / 2;
  const cy = height / 2;
  const rx = Math.max(1e-6, width / 2);
  const ry = Math.max(1e-6, height / 2);
  const verts: Point2[] = [];
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    verts.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return verts;
}

export function maxPolygonCornerRadius(
  sides: number,
  width: number,
  height: number,
): number {
  const verts = polygonVertices(sides, width, height);
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

export function clampPolygonCornerRadius(
  sides: number,
  width: number,
  height: number,
  radius: number,
): number {
  return Math.max(0, Math.min(maxPolygonCornerRadius(sides, width, height), radius));
}

export function polygonPathD(
  width: number,
  height: number,
  sides: number,
  cornerRadius = 0,
): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const n = clampPolygonSides(sides);
  const cr = clampPolygonCornerRadius(n, w, h, cornerRadius);
  return roundedPolygonPathD(polygonVertices(n, w, h), cr);
}

export type PolygonParams = {
  sides: number;
  cornerRadius: number;
};

export function effectivePolygonParams(
  node: Pick<EditorNode, "polygonSides" | "cornerRadius" | "width" | "height">,
): PolygonParams {
  const sides = clampPolygonSides(node.polygonSides ?? DEFAULT_POLYGON_SIDES);
  const cornerRadius = clampPolygonCornerRadius(
    sides,
    node.width,
    node.height,
    node.cornerRadius ?? 0,
  );
  return { sides, cornerRadius };
}

export function polygonPathDForNode(
  node: Pick<EditorNode, "width" | "height" | "polygonSides" | "cornerRadius">,
  override?: Partial<PolygonParams>,
): string {
  const base = effectivePolygonParams(node);
  const sides = override?.sides ?? base.sides;
  const cornerRadius = override?.cornerRadius ?? base.cornerRadius;
  return polygonPathD(node.width, node.height, sides, cornerRadius);
}

/** Legacy path anchor points (sharp vertices). */
export function polygonPathPoints(
  sides: number,
  width: number,
  height: number,
): PathPoint[] {
  return polygonVertices(sides, width, height).map((p) => ({
    id: newPathPointId(),
    x: p.x,
    y: p.y,
  }));
}

export function polygonGeometryPatch(
  node: Pick<EditorNode, "width" | "height" | "polygonSides" | "cornerRadius">,
  partial: Partial<{ polygonSides: number; cornerRadius: number }>,
): Pick<EditorNode, "polygonSides" | "cornerRadius" | "pathPoints"> {
  const sides = clampPolygonSides(partial.polygonSides ?? node.polygonSides ?? DEFAULT_POLYGON_SIDES);
  const cornerRadius = clampPolygonCornerRadius(
    sides,
    node.width,
    node.height,
    partial.cornerRadius ?? node.cornerRadius ?? 0,
  );
  return {
    polygonSides: sides,
    cornerRadius,
    pathPoints: polygonPathPoints(sides, node.width, node.height),
  };
}

/** Ray-cast point-in-polygon (local space). */
export function pointInPolygon(
  x: number,
  y: number,
  vertices: Point2[],
): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i]!.x;
    const yi = vertices[i]!.y;
    const xj = vertices[j]!.x;
    const yj = vertices[j]!.y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function minDistanceToPolygonEdges(
  x: number,
  y: number,
  vertices: Point2[],
): number {
  const n = vertices.length;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = x - a.x;
    const apy = y - a.y;
    const ab2 = abx * abx + aby * aby;
    let t = ab2 < 1e-12 ? 0 : (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const qx = a.x + abx * t;
    const qy = a.y + aby * t;
    min = Math.min(min, Math.hypot(x - qx, y - qy));
  }
  return min;
}

/** Hit-test in node-local coordinates (unrotated box space). */
export function hitTestPolygonLocal(
  localX: number,
  localY: number,
  node: Pick<
    EditorNode,
    "width" | "height" | "polygonSides" | "cornerRadius" | "strokeWidth" | "fillEnabled"
  >,
  zoom: number,
): boolean {
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  if (localX < -1 || localY < -1 || localX > w + 1 || localY > h + 1) return false;

  const params = effectivePolygonParams(node);
  const d = polygonPathD(w, h, params.sides, params.cornerRadius);
  const sw = node.strokeWidth ?? 0;
  const tol = Math.max(sw / 2, screenPxToWorld(8, zoom));
  const fill = node.fillEnabled !== false;

  if (typeof Path2D !== "undefined" && typeof document !== "undefined") {
    try {
      const path = new Path2D(d);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (fill && ctx.isPointInPath(path, localX, localY)) return true;
        if (sw > 0 && typeof ctx.isPointInStroke === "function") {
          ctx.lineWidth = Math.max(sw, tol * 2);
          if (ctx.isPointInStroke(path, localX, localY)) return true;
        }
      }
    } catch {
      /* fallback below */
    }
  }

  const verts = polygonVertices(params.sides, w, h);
  if (fill && pointInPolygon(localX, localY, verts)) return true;
  if (sw > 0 || !fill) {
    return minDistanceToPolygonEdges(localX, localY, verts) <= tol;
  }
  return false;
}

/** Side-count handle on the first edge midpoint (local). */
export function polygonSidesHandleLocal(
  sides: number,
  width: number,
  height: number,
): Point2 {
  const verts = polygonVertices(sides, width, height);
  const a = verts[1]!;
  const b = verts[2] ?? verts[1]!;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Map pointer distance from center to polygon side count. */
export function polygonSidesFromLocalPoint(
  localX: number,
  localY: number,
  width: number,
  height: number,
): number {
  const cx = width / 2;
  const cy = height / 2;
  const dist = Math.hypot(localX - cx, localY - cy);
  const maxDist = Math.max(1, Math.hypot(width, height) / 2);
  const t = Math.max(0, Math.min(1, dist / maxDist));
  const sides = 3 + Math.round(t * (100 - 3));
  return clampPolygonSides(sides);
}

/** Corner-radius handle at top vertex (local). */
export function polygonCornerRadiusHandleLocal(
  sides: number,
  width: number,
  height: number,
  cornerRadius: number,
): Point2 {
  const verts = polygonVertices(sides, width, height);
  const curr = verts[0]!;
  const prev = verts[verts.length - 1]!;
  const next = verts[1]!;
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
  if (bl < 1e-6) bx = 0;
  else {
    bx /= bl;
    by /= bl;
  }
  const r = clampPolygonCornerRadius(sides, width, height, cornerRadius);
  return { x: curr.x + bx * r, y: curr.y + by * r };
}

export function polygonCornerRadiusFromLocalPoint(
  localX: number,
  localY: number,
  sides: number,
  width: number,
  height: number,
): number {
  const verts = polygonVertices(sides, width, height);
  const curr = verts[0]!;
  const prev = verts[verts.length - 1]!;
  const next = verts[1]!;
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
  if (bl < 1e-6) return 0;
  bx /= bl;
  by /= bl;
  const metric = (localX - curr.x) * bx + (localY - curr.y) * by;
  return clampPolygonCornerRadius(sides, width, height, Math.max(0, metric));
}
