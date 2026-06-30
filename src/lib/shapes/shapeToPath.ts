import { finiteDimension } from "@/lib/transformMath";
import {
  clampCornerRadii,
  getNodeCornerRadii,
  roundedRectPathDForNode,
  type CornerRadii,
} from "@/lib/cornerRadius";
import { newPathPointId, normalizePathNode, pathToSvgD, type PathPoint } from "@/lib/pathGeometry";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  effectiveEllipseArc,
  ellipsePointAtDeg,
  fullEllipseBezierPathPoints,
  hasEllipseArcInnerHole,
  isFullEllipseArc,
} from "@/lib/shapes/ellipseArc";
import { generatePolygonPoints } from "./pathGenerators";
import {
  clampPolygonSides,
  clampPolygonVertexCornerRadii,
  DEFAULT_POLYGON_SIDES,
  isPolygonNode,
  polygonPathDForNode,
  polygonPathPoints,
} from "./polygonGeometry";
import { getPolygonPreview } from "./polygonDrag";
import { createRoundedVectorPathSvgD } from "@/lib/geometry";
import {
  clampStarPointCount,
  clampStarRatio,
  clampStarVertexCornerRadii,
  DEFAULT_STAR_INNER_RATIO,
  DEFAULT_STAR_POINTS,
  isStarNode,
  maxCornerRadiusAtVertex,
  starPathDForNode,
  starPathPoints,
} from "./starGeometry";
import { getStarPreview } from "./starDrag";

const CORNER_EPS = 0.75;

function rectCornerEpsilon(width: number, height: number): number {
  return Math.max(CORNER_EPS, Math.min(Math.max(1, width), Math.max(1, height)) * 0.015);
}

const RECT_CORNER_TARGETS: readonly { corner: 0 | 1 | 2 | 3; at: (w: number, h: number) => { x: number; y: number } }[] = [
  { corner: 0, at: (_w, _h) => ({ x: 0, y: 0 }) },
  { corner: 1, at: (w, _h) => ({ x: w, y: 0 }) },
  { corner: 2, at: (w, h) => ({ x: w, y: h }) },
  { corner: 3, at: (_w, h) => ({ x: 0, y: h }) },
];

/** Map a local anchor position to rectangle corner index (TL, TR, BR, BL). */
export function classifyPathPointToCorner(
  x: number,
  y: number,
  width: number,
  height: number,
  epsilon = rectCornerEpsilon(width, height),
): 0 | 1 | 2 | 3 | null {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  for (const { corner, at } of RECT_CORNER_TARGETS) {
    const target = at(w, h);
    if (Math.abs(x - target.x) <= epsilon && Math.abs(y - target.y) <= epsilon) {
      return corner;
    }
  }
  return null;
}

/** Four rectangle corners in local space (TL, TR, BR, BL). */
export function rectCornerPathPoints(w: number, h: number, existing?: PathPoint[]): PathPoint[] {
  const width = Math.max(1, w);
  const height = Math.max(1, h);
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  return corners.map((p, i) => ({
    id: existing?.[i]?.id ?? newPathPointId(),
    x: p.x,
    y: p.y,
    handleIn: undefined,
    handleOut: undefined,
  }));
}

export type VectorEditableShapeType = "rectangle" | "ellipse" | "line" | "polygon" | "path";

export function isVectorEditableShape(
  node: Pick<EditorNode, "type" | "locked" | "visible"> | null | undefined,
): node is EditorNode & { type: VectorEditableShapeType } {
  if (!node || node.locked || node.visible === false) return false;
  return (
    node.type === "rectangle" ||
    node.type === "ellipse" ||
    node.type === "line" ||
    node.type === "arrow" ||
    node.type === "polygon" ||
    node.type === "path"
  );
}

/** True when Enter / vector edit must flatten parametric shapes into editable path anchors. */
export function needsVectorPathConversion(node: EditorNode | null | undefined): boolean {
  if (!isVectorEditableShape(node)) return false;
  if (node.type !== "path") return true;
  if (isStarNode(node) || isPolygonNode(node)) return true;
  return !node.pathPoints?.length;
}

export function shapeToPathPoints(
  node: Pick<
    EditorNode,
    | "type"
    | "width"
    | "height"
    | "pathPoints"
    | "pathClosed"
    | "cornerRadius"
    | "cornerRadii"
    | "arcStartDeg"
    | "arcSweepDeg"
    | "arcInnerRadiusRatio"
    | "polygonSides"
    | "starPoints"
    | "starInnerRadius"
  >,
): { pathPoints: PathPoint[]; pathClosed: boolean } | null {
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);

  if (node.type === "polygon") {
    const sides = node.polygonSides ?? DEFAULT_POLYGON_SIDES;
    return {
      pathPoints: generatePolygonPoints(sides, w, h),
      pathClosed: true,
    };
  }

  if (isStarNode(node)) {
    return {
      pathPoints: starPathPoints(
        node.starPoints ?? DEFAULT_STAR_POINTS,
        node.starInnerRadius ?? DEFAULT_STAR_INNER_RATIO,
        w,
        h,
      ),
      pathClosed: true,
    };
  }

  if (isPolygonNode(node)) {
    const sides = node.polygonSides ?? DEFAULT_POLYGON_SIDES;
    return {
      pathPoints: generatePolygonPoints(sides, w, h),
      pathClosed: true,
    };
  }

  if (node.type === "path" && node.pathPoints?.length) {
    return {
      pathPoints: node.pathPoints.map((p) => ({ ...p })),
      pathClosed: node.pathClosed ?? false,
    };
  }

  if (node.type === "rectangle") {
    return {
      pathPoints: rectCornerPathPoints(w, h),
      pathClosed: true,
    };
  }

  if (node.type === "ellipse") {
    const arc = effectiveEllipseArc(node);
    if (isFullEllipseArc(arc.sweepDeg) && !hasEllipseArcInnerHole(arc.innerRadiusRatio)) {
      return {
        pathPoints: fullEllipseBezierPathPoints(w, h),
        pathClosed: true,
      };
    }
    const cx = w / 2;
    const cy = h / 2;
    const outerRx = w / 2;
    const outerRy = h / 2;
    const innerRx = outerRx * arc.innerRadiusRatio;
    const innerRy = outerRy * arc.innerRadiusRatio;
    const pts: PathPoint[] = [];
    if (!hasEllipseArcInnerHole(arc.innerRadiusRatio)) {
      pts.push({ id: newPathPointId(), x: cx, y: cy });
    }
    const steps = Math.max(8, Math.ceil((arc.sweepDeg / 360) * 64));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const deg = arc.startDeg + arc.sweepDeg * t;
      const p = ellipsePointAtDeg(cx, cy, outerRx, outerRy, deg);
      pts.push({ id: newPathPointId(), x: p.x, y: p.y });
    }
    if (hasEllipseArcInnerHole(arc.innerRadiusRatio)) {
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        const deg = arc.startDeg + arc.sweepDeg * t;
        const p = ellipsePointAtDeg(cx, cy, innerRx, innerRy, deg);
        pts.push({ id: newPathPointId(), x: p.x, y: p.y });
      }
    }
    return { pathPoints: pts, pathClosed: true };
  }

  if (node.type === "line" || node.type === "arrow") {
    const y = h / 2;
    return {
      pathPoints: [
        { id: newPathPointId(), x: 0, y },
        { id: newPathPointId(), x: w, y },
      ],
      pathClosed: false,
    };
  }

  return null;
}

export function pathHasCurveHandles(points: PathPoint[] | undefined): boolean {
  return (points ?? []).some((p) => p.handleIn || p.handleOut);
}

/** Closed path with four rectangle corners — corner radius lives on the node (handles allowed). */
export function isRoundedRectPath(
  node: Pick<EditorNode, "type" | "width" | "height" | "pathPoints" | "pathClosed">,
): boolean {
  if (node.type !== "path" || node.pathClosed === false) return false;
  const pts = node.pathPoints ?? [];
  if (pts.length !== 4) return false;
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  const eps = rectCornerEpsilon(w, h);
  const assigned = new Set<number>();
  for (const p of pts) {
    const corner = classifyPathPointToCorner(p.x, p.y, w, h, eps);
    if (corner == null || assigned.has(corner)) return false;
    assigned.add(corner);
  }
  return assigned.size === 4;
}

/** Closed path with exactly four corner anchors (any quadrilateral). */
export function isFourCornerClosedPath(
  node: Pick<EditorNode, "type" | "pathPoints" | "pathClosed">,
): boolean {
  if (node.type !== "path" || node.pathClosed === false) return false;
  return (node.pathPoints ?? []).length === 4;
}

/** Closed straight-segment path with 3+ corner anchors (triangles, quads, etc.). */
export function isCornerRoundablePath(
  node: Pick<EditorNode, "type" | "pathPoints" | "pathClosed">,
): boolean {
  if ((node.type !== "path" && node.type !== "polygon") || node.pathClosed === false) return false;
  const pts = node.pathPoints ?? [];
  return pts.length >= 3 && !pathHasCurveHandles(pts);
}

export function pathSupportsCornerRadius(
  node: Pick<EditorNode, "type" | "width" | "height" | "pathPoints" | "pathClosed">,
): boolean {
  return isCornerRoundablePath(node);
}

/** Per-vertex corner radii aligned with path point order. */
export function getPathVertexCornerRadii(
  node: Pick<EditorNode, "cornerRadius" | "cornerRadii" | "pathPoints">,
): number[] {
  const pts = node.pathPoints ?? [];
  const n = pts.length;
  if (n === 0) return [];
  const uniform = Math.max(0, node.cornerRadius ?? 0);
  const out = Array.from({ length: n }, () => uniform);
  for (let i = 0; i < n; i++) {
    const ptRadius = pts[i]?.cornerRadius;
    if (ptRadius != null) out[i] = Math.max(0, ptRadius);
    else if (node.cornerRadii?.[i] != null) out[i] = Math.max(0, node.cornerRadii[i]!);
  }
  return out;
}

export function hasPathCornerRadius(
  node: Pick<EditorNode, "cornerRadius" | "cornerRadii" | "pathPoints" | "type" | "pathClosed">,
): boolean {
  if (!isCornerRoundablePath(node)) return false;
  return getPathVertexCornerRadii(node).some((r) => r > 0);
}

/** Clamp per-corner radii for an arbitrary closed polygon path. */
export function clampPathCornerRadii(
  pathPoints: PathPoint[],
  radii: readonly number[],
): number[] {
  const verts = pathPoints.map((p) => ({ x: p.x, y: p.y }));
  const n = verts.length;
  if (n < 3) return [];
  return Array.from({ length: n }, (_, i) => {
    const r = Math.max(0, radii[i] ?? 0);
    const prev = verts[(i - 1 + n) % n]!;
    const curr = verts[i]!;
    const next = verts[(i + 1) % n]!;
    const maxAt = maxCornerRadiusAtVertex(prev, curr, next);
    return Math.max(0, Math.min(r, maxAt));
  });
}

/** Map a path point id to corner index (path point order, or TL/TR/BR/BL for rect-like paths). */
export function pathPointCornerIndex(
  node: Pick<EditorNode, "pathPoints" | "width" | "height" | "type" | "pathClosed">,
  pointId: string | null | undefined,
): number | null {
  if (!pointId) return null;
  const pts = node.pathPoints ?? [];
  const idx = pts.findIndex((p) => p.id === pointId);
  if (idx < 0) return null;
  if (isRoundedRectPath(node)) {
    const pt = pts[idx]!;
    const corner = classifyPathPointToCorner(pt.x, pt.y, node.width, node.height);
    if (corner != null) return corner;
  }
  if (isCornerRoundablePath(node)) return idx;
  return null;
}

/** Inset along the corner bisector for on-canvas handle placement (local coords). */
export function cornerRadiusDisplayInset(
  radius: number,
  minInset: number,
  width: number,
  height: number,
): number {
  const cap = Math.max(0, Math.min(width, height) / 2 - 0.5);
  if (radius > 0) return Math.min(radius, cap);
  return Math.min(Math.max(0, minInset), cap);
}

/** Canvas handle position for adjusting one corner's radius (local coords, inside the shape). */
export function cornerRadiusHandlePosition(
  w: number,
  h: number,
  radii: CornerRadii,
  cornerIndex: 0 | 1 | 2 | 3,
  minInset = 0,
): { x: number; y: number } {
  const width = finiteDimension(w);
  const height = finiteDimension(h);
  const safeMinInset =
    typeof minInset === "number" && Number.isFinite(minInset) && minInset >= 0 ? minInset : 0;
  const [tl, tr, br, bl] = clampCornerRadii(radii, width, height);
  switch (cornerIndex) {
    case 0: {
      const inset = cornerRadiusDisplayInset(tl, safeMinInset, width, height);
      return { x: inset, y: inset };
    }
    case 1: {
      const inset = cornerRadiusDisplayInset(tr, safeMinInset, width, height);
      return { x: width - inset, y: inset };
    }
    case 2: {
      const inset = cornerRadiusDisplayInset(br, safeMinInset, width, height);
      return { x: width - inset, y: height - inset };
    }
    case 3: {
      const inset = cornerRadiusDisplayInset(bl, safeMinInset, width, height);
      return { x: inset, y: height - inset };
    }
    default:
      return { x: 0, y: 0 };
  }
}

/** Live outline for editable paths; flattened import paths keep baked geometry. */
export function resolvePathOutlineD(
  node: Pick<
    EditorNode,
    | "type"
    | "width"
    | "height"
    | "pathPoints"
    | "pathClosed"
    | "cornerRadius"
    | "cornerRadii"
    | "polygonSides"
    | "starPoints"
    | "starInnerRadius"
    | "starOuterCornerRadius"
    | "starInnerCornerRadius"
    | "flattenedPathData"
  >,
  nodeId?: string,
): string {
  const baked = node.flattenedPathData?.trim();
  if (node.type === "path" && baked) {
    return baked;
  }
  if (
    (node.type === "path" || node.type === "polygon") &&
    (node.pathPoints?.length ?? 0) > 0
  ) {
    return vectorShapeOutlineD(node, nodeId);
  }
  return baked ?? vectorShapeOutlineD(node, nodeId);
}

type VectorShapeOutlineNode = Pick<
  EditorNode,
  | "type"
  | "width"
  | "height"
  | "pathPoints"
  | "pathClosed"
  | "cornerRadius"
  | "cornerRadii"
  | "polygonSides"
  | "starPoints"
  | "starInnerRadius"
  | "starOuterCornerRadius"
  | "starInnerCornerRadius"
  | "flattenedPathData"
>;

/** SVG path `d` from live path anchors (vector edit, pen, corner fillets, Bézier handles). */
function pathPointsOutlineD(node: VectorShapeOutlineNode): string {
  const pts = node.pathPoints ?? [];
  if (isRoundedRectPath(node)) {
    return roundedRectPathDForNode(
      node,
      Math.max(1, node.width),
      Math.max(1, node.height),
    );
  }
  if (isCornerRoundablePath(node)) {
    const radii = getPathVertexCornerRadii(node);
    if (radii.some((r) => r > 0)) {
      const clamped = clampPathCornerRadii(pts, radii);
      const roundedPts = pts.map((p, i) => ({
        ...p,
        cornerRadius: clamped[i] ?? 0,
      }));
      return createRoundedVectorPathSvgD({
        points: roundedPts,
        closed: node.pathClosed ?? false,
      });
    }
  }
  return pathToSvgD(pts, node.pathClosed ?? false);
}

/** SVG path `d` for vector shapes (polygon, star, path). */
export function vectorShapeOutlineD(node: VectorShapeOutlineNode, nodeId?: string): string {
  const baked = node.flattenedPathData?.trim();
  if (node.type === "path" && baked) {
    return baked;
  }
  if (
    (node.type === "path" || node.type === "polygon") &&
    (node.pathPoints?.length ?? 0) > 0
  ) {
    return pathPointsOutlineD(node);
  }
  if (isPolygonNode(node)) {
    const preview = nodeId ? getPolygonPreview() : null;
    if (preview && preview.nodeId === nodeId) {
      return polygonPathDForNode(node, {
        sides: preview.sides,
        cornerRadius: preview.cornerRadius,
      });
    }
    return polygonPathDForNode(node);
  }
  if (node.type !== "path") return "";
  if (isStarNode(node)) {
    const preview = nodeId ? getStarPreview() : null;
    if (preview && preview.nodeId === nodeId) {
      return starPathDForNode(node, {
        pointCount: preview.pointCount,
        ratio: preview.ratio,
        cornerRadius: preview.cornerRadius,
        outerCornerRadius: preview.outerCornerRadius,
        innerCornerRadius: preview.innerCornerRadius,
      });
    }
    return starPathDForNode(node);
  }
  return "";
}

/** @deprecated Prefer vectorShapeOutlineD */
export function pathOutlineD(
  node: Parameters<typeof vectorShapeOutlineD>[0],
  nodeId?: string,
): string {
  return vectorShapeOutlineD(node, nodeId);
}

type PathFillHitNode = Pick<
  EditorNode,
  | "type"
  | "pathClosed"
  | "fillEnabled"
  | "fillType"
  | "fill"
  | "fillGradient"
  | "flattenedPathData"
  | "pathPoints"
  | "width"
  | "height"
  | "cornerRadius"
  | "cornerRadii"
  | "polygonSides"
  | "starPoints"
  | "starInnerRadius"
  | "starOuterCornerRadius"
  | "starInnerCornerRadius"
>;

/** Whether pointer hits should include the filled interior (not just stroke). */
export function pathNodeUsesFillHit(
  node: Pick<
    EditorNode,
    "type" | "pathClosed" | "fillEnabled" | "fillType" | "fill" | "fillGradient"
  >,
): boolean {
  if (node.type === "polygon") return true;
  if (node.pathClosed) return true;
  if (node.fillEnabled === false) return false;
  if (node.fillType === "gradient" || node.fillGradient) return true;
  const fill = node.fill;
  return Boolean(fill && fill !== "none" && fill !== "transparent");
}

/** SVG hit-test path — closes open filled paths the same way SVG fill does. */
export function vectorShapeHitOutlineD(node: PathFillHitNode, nodeId?: string): string {
  if (!pathNodeUsesFillHit(node)) {
    return vectorShapeOutlineD(node, nodeId);
  }
  if (node.type === "polygon" || node.pathClosed) {
    return vectorShapeOutlineD(node, nodeId);
  }
  const baked = node.flattenedPathData?.trim();
  if (baked) return baked;
  const d = vectorShapeOutlineD(node, nodeId).trim();
  if (d && (node.pathPoints?.length ?? 0) >= 2 && !/[zZ]\s*$/.test(d)) {
    return `${d} Z`;
  }
  return d;
}

/** Keep four rectangle anchors; corner radii are stored on the node. */
export function pathPointsFromCornerRadii(
  node: Pick<EditorNode, "width" | "height" | "pathPoints">,
  _radii: CornerRadii,
): PathPoint[] {
  return rectCornerPathPoints(node.width, node.height, node.pathPoints);
}

/** Collapse legacy rounded-rect polygons to four corner anchors. */
function cornerRadiiStyleFromClamped(
  clamped: number[],
): {
  cornerRadius?: number;
  cornerRadii?: number[];
} {
  const allSame = clamped.length > 0 && clamped.every((r) => r === clamped[0]);
  return allSame
    ? { cornerRadius: clamped[0], cornerRadii: undefined }
    : { cornerRadius: undefined, cornerRadii: clamped };
}

/** Style patch when corner radii change on a vector path or rounded rect. */
export function cornerRadiiStylePatch(
  node: Pick<
    EditorNode,
    | "type"
    | "width"
    | "height"
    | "pathPoints"
    | "pathClosed"
    | "polygonSides"
    | "starPoints"
    | "starInnerRadius"
    | "cornerRadius"
    | "cornerRadii"
    | "starOuterCornerRadius"
    | "starInnerCornerRadius"
  >,
  radii: readonly number[],
): {
  cornerRadius?: number;
  cornerRadii?: number[];
  pathPoints?: PathPoint[];
  starOuterCornerRadius?: number;
  starInnerCornerRadius?: number;
  flattenedPathData?: undefined;
} {
  if (isPolygonNode(node)) {
    const sides = clampPolygonSides(node.polygonSides ?? DEFAULT_POLYGON_SIDES);
    const radiiInput = Array.from({ length: sides }, (_, i) => Math.max(0, radii[i] ?? 0));
    const clamped = clampPolygonVertexCornerRadii(sides, node.width, node.height, radiiInput);
    const style = cornerRadiiStyleFromClamped(clamped);
    if (node.type === "path") {
      return {
        ...style,
        pathPoints: polygonPathPoints(sides, node.width, node.height),
        flattenedPathData: undefined,
      };
    }
    return style;
  }

  if (isStarNode(node)) {
    const pointCount = clampStarPointCount(node.starPoints ?? DEFAULT_STAR_POINTS);
    const ratio = clampStarRatio(node.starInnerRadius ?? DEFAULT_STAR_INNER_RATIO);
    const total = pointCount * 2;
    const radiiInput = Array.from({ length: total }, (_, i) => Math.max(0, radii[i] ?? 0));
    const clamped = clampStarVertexCornerRadii(
      pointCount,
      ratio,
      node.width,
      node.height,
      radiiInput,
    );
    const style = cornerRadiiStyleFromClamped(clamped);
    if (style.cornerRadius != null) {
      return {
        ...style,
        starOuterCornerRadius: style.cornerRadius,
        starInnerCornerRadius: style.cornerRadius,
        pathPoints: starPathPoints(pointCount, ratio, node.width, node.height),
        flattenedPathData: undefined,
      };
    }
    return {
      ...style,
      starOuterCornerRadius: undefined,
      starInnerCornerRadius: undefined,
      pathPoints: starPathPoints(pointCount, ratio, node.width, node.height),
      flattenedPathData: undefined,
    };
  }

  if (node.type === "rectangle" || node.type === "frame") {
    const radiiInput = Array.from({ length: 4 }, (_, i) => Math.max(0, radii[i] ?? 0));
    const clamped = [...clampCornerRadii(radiiInput as CornerRadii, node.width, node.height)];
    return cornerRadiiStyleFromClamped(clamped);
  }

  const ptCount = isRoundedRectPath(node) ? 4 : (node.pathPoints?.length ?? 0);
  const radiiInput = Array.from({ length: ptCount }, (_, i) => Math.max(0, radii[i] ?? 0));
  const clamped: number[] = isRoundedRectPath(node)
    ? [...clampCornerRadii(radiiInput as CornerRadii, node.width, node.height)]
    : clampPathCornerRadii(node.pathPoints ?? [], radiiInput);
  const style = cornerRadiiStyleFromClamped(clamped);
  if (isRoundedRectPath(node)) {
    return {
      ...style,
      pathPoints: pathPointsFromCornerRadii(node, clamped as CornerRadii),
    };
  }
  if (isCornerRoundablePath(node)) {
    const existing = node.pathPoints ?? [];
    const pathPoints = existing.map((p, i) => ({
      ...p,
      cornerRadius: clamped[i] ?? 0,
    }));
    return { ...style, pathPoints, flattenedPathData: undefined };
  }
  return style;
}

/** Distance along the corner bisector used for radius (Figma-style). */
export function cornerRadiusMetricAtPoint(
  cornerIndex: 0 | 1 | 2 | 3,
  localX: number,
  localY: number,
  width: number,
  height: number,
): number {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  switch (cornerIndex) {
    case 0:
      return Math.min(localX, localY);
    case 1:
      return Math.min(w - localX, localY);
    case 2:
      return Math.min(w - localX, h - localY);
    case 3:
      return Math.min(localX, h - localY);
    default:
      return 0;
  }
}

export function radiusFromCornerDrag(
  cornerIndex: 0 | 1 | 2 | 3,
  localX: number,
  localY: number,
  width: number,
  height: number,
): number {
  return Math.max(0, cornerRadiusMetricAtPoint(cornerIndex, localX, localY, width, height));
}

/**
 * Inward drag delta for a corner (supports horizontal, vertical, and diagonal drags).
 * Each corner's "inward" axes point toward the shape center.
 */
export function cornerRadiusDragDelta(
  cornerIndex: 0 | 1 | 2 | 3,
  grabX: number,
  grabY: number,
  moveX: number,
  moveY: number,
): number {
  const dx = moveX - grabX;
  const dy = moveY - grabY;
  let signX: 1 | -1;
  let signY: 1 | -1;
  switch (cornerIndex) {
    case 0:
      signX = 1;
      signY = 1;
      break;
    case 1:
      signX = -1;
      signY = 1;
      break;
    case 2:
      signX = -1;
      signY = -1;
      break;
    case 3:
      signX = 1;
      signY = -1;
      break;
    default:
      return 0;
  }
  const ix = dx * signX;
  const iy = dy * signY;
  if (ix >= 0 && iy >= 0) return Math.max(ix, iy);
  if (ix <= 0 && iy <= 0) return Math.min(ix, iy);
  if (ix > 0) return ix;
  if (iy > 0) return iy;
  if (ix < 0) return ix;
  if (iy < 0) return iy;
  return 0;
}

/** Continuous radius drag from grab point (avoids jump on pointer down). */
export function radiusFromRelativeCornerDrag(
  cornerIndex: 0 | 1 | 2 | 3,
  grabRadius: number,
  grabX: number,
  grabY: number,
  moveX: number,
  moveY: number,
  width: number,
  height: number,
  maxRadius: number,
): number {
  void width;
  void height;
  const delta = cornerRadiusDragDelta(cornerIndex, grabX, grabY, moveX, moveY);
  const next = grabRadius + delta;
  return Math.min(maxRadius, Math.max(0, next));
}

export function ensureRoundedRectPathPoints(node: EditorNode): EditorNode {
  if (node.type !== "path" || node.pathClosed === false || pathHasCurveHandles(node.pathPoints)) {
    return node;
  }
  if (isRoundedRectPath(node)) return node;
  const pts = node.pathPoints ?? [];
  // Only normalize four-corner quads (e.g. rectangles). Ellipses and polygons have more anchors.
  if (pts.length !== 4) return node;
  return {
    ...node,
    pathPoints: rectCornerPathPoints(node.width, node.height, pts),
  };
}

export function convertNodeToPath(node: EditorNode): EditorNode | null {
  if (!isVectorEditableShape(node)) return null;
  if (node.type === "path" && node.pathPoints?.length && !needsVectorPathConversion(node)) {
    return node;
  }
  const built = shapeToPathPoints(node);
  if (!built) return null;

  const next: EditorNode = {
    ...node,
    type: "path",
    pathPoints: built.pathPoints,
    pathClosed: built.pathClosed,
    polygonSides: undefined,
    starPoints: undefined,
    starInnerRadius: undefined,
    starOuterCornerRadius: undefined,
    starInnerCornerRadius: undefined,
    arrowHead: undefined,
    arcStartDeg: undefined,
    arcSweepDeg: undefined,
    arcInnerRadiusRatio: undefined,
  };
  return normalizePathNode(next);
}
