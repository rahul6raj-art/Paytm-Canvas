import type { EditorNode } from "@/stores/useEditorStore";
import { newPathPointId, type PathPoint } from "@/lib/pathGeometry";
import { screenPxToWorld } from "@/lib/canvasVisual";
import { resizeCornerRadiiForCount } from "@/lib/cornerRadius";
import { fitVerticesToBoundingBox } from "@/lib/geometry/fitVerticesToBox";
import {
  cornerRadiusToPercent,
  maxUniformFilletRadius,
  percentToCornerRadius,
  scaleRadiiToEdgeConstraints,
} from "@/lib/geometry/roundedPolygon";
import {
  maxCornerRadiusAtVertex,
  roundedPolygonPathD,
  roundedPolygonPathDWithRadii,
  vertexInwardBisector,
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
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const raw: Point2[] = [];
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    raw.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return fitVerticesToBoundingBox(raw, w, h);
}

export function maxPolygonCornerRadius(
  sides: number,
  width: number,
  height: number,
  cornerSmoothing = 0,
): number {
  return maxUniformFilletRadius(
    polygonVertices(sides, width, height),
    cornerSmoothing,
  );
}

export function polygonCornerRadiusPercent(
  sides: number,
  width: number,
  height: number,
  cornerRadius: number,
  cornerSmoothing = 0,
): number {
  return cornerRadiusToPercent(
    polygonVertices(sides, width, height),
    cornerRadius,
    cornerSmoothing,
  );
}

export function polygonCornerRadiusFromPercent(
  sides: number,
  width: number,
  height: number,
  radiusPercent: number,
  cornerSmoothing = 0,
): number {
  return percentToCornerRadius(
    polygonVertices(sides, width, height),
    radiusPercent,
    cornerSmoothing,
  );
}

export function clampPolygonCornerRadius(
  sides: number,
  width: number,
  height: number,
  radius: number,
  cornerSmoothing = 0,
): number {
  return Math.max(
    0,
    Math.min(maxPolygonCornerRadius(sides, width, height, cornerSmoothing), radius),
  );
}

export function clampPolygonVertexCornerRadii(
  sides: number,
  width: number,
  height: number,
  radii: readonly number[],
  cornerSmoothing = 0,
): number[] {
  const n = clampPolygonSides(sides);
  const verts = polygonVertices(n, width, height);
  const maxR = maxUniformFilletRadius(verts, cornerSmoothing);
  const clamped = Array.from({ length: n }, (_, i) =>
    Math.max(0, Math.min(maxR, radii[i] ?? radii[0] ?? 0)),
  );
  return scaleRadiiToEdgeConstraints(verts, clamped, cornerSmoothing);
}

export function getPolygonVertexCornerRadii(
  node: Pick<
    EditorNode,
    "polygonSides" | "cornerRadius" | "cornerRadii" | "width" | "height" | "cornerSmoothing"
  >,
): number[] {
  const sides = clampPolygonSides(node.polygonSides ?? DEFAULT_POLYGON_SIDES);
  const smoothing = node.cornerSmoothing ?? 0;
  const base = resizeCornerRadiiForCount(
    node.cornerRadii,
    sides,
    node.cornerRadius ?? 0,
  );
  return clampPolygonVertexCornerRadii(sides, node.width, node.height, base, smoothing);
}

export function polygonPathD(
  width: number,
  height: number,
  sides: number,
  cornerRadius = 0,
  cornerSmoothing = 0,
): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const n = clampPolygonSides(sides);
  const cr = clampPolygonCornerRadius(n, w, h, cornerRadius, cornerSmoothing);
  return roundedPolygonPathD(polygonVertices(n, w, h), cr, cornerSmoothing);
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
  node: Pick<
    EditorNode,
    "width" | "height" | "polygonSides" | "cornerRadius" | "cornerRadii" | "cornerSmoothing"
  >,
  override?: Partial<PolygonParams & { cornerSmoothing?: number }>,
): string {
  const sides = clampPolygonSides(override?.sides ?? node.polygonSides ?? DEFAULT_POLYGON_SIDES);
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  const smoothing = override?.cornerSmoothing ?? node.cornerSmoothing ?? 0;
  const verts = polygonVertices(sides, w, h);
  if (override?.cornerRadius != null) {
    const cr = clampPolygonCornerRadius(sides, w, h, override.cornerRadius, smoothing);
    return roundedPolygonPathDWithRadii(
      verts,
      Array.from({ length: sides }, () => cr),
      smoothing,
    );
  }
  const radii = getPolygonVertexCornerRadii({ ...node, polygonSides: sides, cornerSmoothing: smoothing });
  return roundedPolygonPathDWithRadii(verts, radii, smoothing);
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
  node: Pick<EditorNode, "width" | "height" | "polygonSides" | "cornerRadius" | "cornerRadii">,
  partial: Partial<{ polygonSides: number; cornerRadius: number }>,
): Pick<EditorNode, "polygonSides" | "cornerRadius" | "cornerRadii" | "pathPoints"> {
  const sides = clampPolygonSides(partial.polygonSides ?? node.polygonSides ?? DEFAULT_POLYGON_SIDES);
  const base = {
    polygonSides: sides,
    pathPoints: polygonPathPoints(sides, node.width, node.height),
  };

  if (partial.cornerRadius != null) {
    const cornerRadius = clampPolygonCornerRadius(
      sides,
      node.width,
      node.height,
      partial.cornerRadius,
    );
    return { ...base, cornerRadius, cornerRadii: undefined };
  }

  if (node.cornerRadii?.length) {
    const resized = resizeCornerRadiiForCount(
      node.cornerRadii,
      sides,
      node.cornerRadius ?? 0,
    );
    const clamped = getPolygonVertexCornerRadii({
      ...node,
      polygonSides: sides,
      cornerRadii: resized,
    });
    const allSame = clamped.length > 0 && clamped.every((r) => r === clamped[0]);
    return allSame
      ? { ...base, cornerRadius: clamped[0], cornerRadii: undefined }
      : { ...base, cornerRadius: undefined, cornerRadii: clamped };
  }

  const cornerRadius = clampPolygonCornerRadius(
    sides,
    node.width,
    node.height,
    node.cornerRadius ?? 0,
  );
  return { ...base, cornerRadius, cornerRadii: undefined };
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

  const d = polygonPathDForNode(node);
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

  const verts = polygonVertices(node.polygonSides ?? DEFAULT_POLYGON_SIDES, w, h);
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

/** Corner-radius handle at a polygon vertex (local). */
export function polygonCornerRadiusHandleAtVertex(
  sides: number,
  width: number,
  height: number,
  radii: readonly number[],
  vertexIndex: number,
  minInset = 0,
): Point2 {
  const n = clampPolygonSides(sides);
  const clamped = clampPolygonVertexCornerRadii(sides, width, height, radii);
  const verts = polygonVertices(n, width, height);
  const i = ((vertexIndex % n) + n) % n;
  const prev = verts[(i - 1 + n) % n]!;
  const curr = verts[i]!;
  const next = verts[(i + 1) % n]!;
  const bis = vertexInwardBisector(prev, curr, next);
  const r = clamped[i] ?? 0;
  const maxAt = maxCornerRadiusAtVertex(prev, curr, next);
  const inset = r > 0 ? r : Math.max(0, Math.min(minInset, maxAt));
  return { x: curr.x + bis.x * inset, y: curr.y + bis.y * inset };
}

/** @deprecated Use polygonCornerRadiusHandleAtVertex with radii array. */
export function polygonCornerRadiusHandleLocal(
  sides: number,
  width: number,
  height: number,
  cornerRadius: number,
  vertexIndex = 0,
): Point2 {
  const n = clampPolygonSides(sides);
  return polygonCornerRadiusHandleAtVertex(
    sides,
    width,
    height,
    Array.from({ length: n }, () => cornerRadius),
    vertexIndex,
  );
}

export function polygonCornerRadiusFromLocalPoint(
  localX: number,
  localY: number,
  sides: number,
  width: number,
  height: number,
  vertexIndex = 0,
): number {
  const n = clampPolygonSides(sides);
  const verts = polygonVertices(n, width, height);
  const i = ((vertexIndex % n) + n) % n;
  const prev = verts[(i - 1 + n) % n]!;
  const curr = verts[i]!;
  const next = verts[(i + 1) % n]!;
  const bis = vertexInwardBisector(prev, curr, next);
  const metric = (localX - curr.x) * bis.x + (localY - curr.y) * bis.y;
  const maxAt = maxCornerRadiusAtVertex(prev, curr, next);
  return Math.max(0, Math.min(maxAt, metric));
}

export function polygonCornerRadiiPatch(
  node: Pick<EditorNode, "width" | "height" | "polygonSides" | "cornerRadius" | "cornerRadii">,
  radii: readonly number[],
): Pick<EditorNode, "cornerRadius" | "cornerRadii"> {
  const sides = clampPolygonSides(node.polygonSides ?? DEFAULT_POLYGON_SIDES);
  const clamped = clampPolygonVertexCornerRadii(sides, node.width, node.height, radii);
  const allSame = clamped.length > 0 && clamped.every((r) => r === clamped[0]);
  if (allSame) {
    return { cornerRadius: clamped[0], cornerRadii: undefined };
  }
  return { cornerRadius: undefined, cornerRadii: clamped };
}
