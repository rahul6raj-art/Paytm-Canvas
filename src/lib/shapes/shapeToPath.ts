import {
  clampCornerRadii,
  getNodeCornerRadii,
  roundedRectPathD,
  type CornerRadii,
} from "@/lib/cornerRadius";
import { newPathPointId, normalizePathNode, pathToSvgD, type PathPoint } from "@/lib/pathGeometry";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  effectiveEllipseArc,
  ellipsePointAtDeg,
  hasEllipseArcInnerHole,
  isFullEllipseArc,
} from "@/lib/shapes/ellipseArc";
import { generatePolygonPoints } from "./pathGenerators";
import { isPolygonNode, polygonPathDForNode } from "./polygonGeometry";
import { getPolygonPreview } from "./polygonDrag";
import { isStarNode, starPathDForNode } from "./starGeometry";
import { getStarPreview } from "./starDrag";

const CORNER_EPS = 0.75;

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
  >,
): { pathPoints: PathPoint[]; pathClosed: boolean } | null {
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);

  if (node.type === "polygon") {
    const sides = node.polygonSides ?? 6;
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
        pathPoints: generatePolygonPoints(64, w, h),
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

/** Closed path with four rectangle corners (no bezier handles) — corner radius lives on the node. */
export function isRoundedRectPath(
  node: Pick<EditorNode, "type" | "width" | "height" | "pathPoints" | "pathClosed">,
): boolean {
  if (node.type !== "path" || node.pathClosed === false) return false;
  const pts = node.pathPoints ?? [];
  if (pts.length !== 4 || pathHasCurveHandles(pts)) return false;
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  const expected = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  return expected.every((exp, i) => {
    const p = pts[i]!;
    return Math.abs(p.x - exp.x) <= CORNER_EPS && Math.abs(p.y - exp.y) <= CORNER_EPS;
  });
}

export function pathSupportsCornerRadius(
  node: Pick<EditorNode, "type" | "width" | "height" | "pathPoints" | "pathClosed">,
): boolean {
  return isRoundedRectPath(node);
}

/** Map a path point id to corner index (0=TL, 1=TR, 2=BR, 3=BL) for rounded-rect paths. */
export function pathPointCornerIndex(
  node: Pick<EditorNode, "pathPoints">,
  pointId: string | null | undefined,
): 0 | 1 | 2 | 3 | null {
  if (!pointId) return null;
  const idx = (node.pathPoints ?? []).findIndex((p) => p.id === pointId);
  if (idx < 0 || idx > 3) return null;
  return idx as 0 | 1 | 2 | 3;
}

/** Canvas handle position for adjusting one corner's radius (local coords). */
export function cornerRadiusHandlePosition(
  w: number,
  h: number,
  radii: CornerRadii,
  cornerIndex: 0 | 1 | 2 | 3,
): { x: number; y: number } {
  const [tl, tr, br, bl] = clampCornerRadii(radii, w, h);
  const width = Math.max(1, w);
  const height = Math.max(1, h);
  switch (cornerIndex) {
    case 0:
      return { x: tl, y: 0 };
    case 1:
      return { x: width - tr, y: 0 };
    case 2:
      return { x: width, y: height - br };
    case 3:
      return { x: 0, y: height - bl };
    default:
      return { x: 0, y: 0 };
  }
}

/** SVG path `d` for vector shapes (polygon, star, path). */
export function vectorShapeOutlineD(
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
  >,
  nodeId?: string,
): string {
  if (isPolygonNode(node)) {
    const preview = nodeId ? getPolygonPreview() : null;
    if (preview?.nodeId === nodeId) {
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
    if (preview?.nodeId === nodeId) {
      return starPathDForNode(node, {
        pointCount: preview.pointCount,
        ratio: preview.ratio,
        cornerRadius: preview.cornerRadius,
      });
    }
    return starPathDForNode(node);
  }
  const pts = node.pathPoints ?? [];
  if (isRoundedRectPath(node)) {
    return roundedRectPathD(
      Math.max(1, node.width),
      Math.max(1, node.height),
      getNodeCornerRadii(node),
    );
  }
  return pathToSvgD(pts, node.pathClosed ?? false);
}

/** @deprecated Prefer vectorShapeOutlineD */
export function pathOutlineD(
  node: Parameters<typeof vectorShapeOutlineD>[0],
  nodeId?: string,
): string {
  return vectorShapeOutlineD(node, nodeId);
}

/** Keep four rectangle anchors; corner radii are stored on the node. */
export function pathPointsFromCornerRadii(
  node: Pick<EditorNode, "width" | "height" | "pathPoints">,
  _radii: CornerRadii,
): PathPoint[] {
  return rectCornerPathPoints(node.width, node.height, node.pathPoints);
}

/** Collapse legacy rounded-rect polygons to four corner anchors. */
/** Style patch when corner radii change on a rounded-rect path. */
export function cornerRadiiStylePatch(
  node: Pick<EditorNode, "width" | "height" | "pathPoints">,
  radii: CornerRadii,
): {
  cornerRadius?: number;
  cornerRadii?: CornerRadii;
  pathPoints: PathPoint[];
} {
  const allSame = radii[0] === radii[1] && radii[1] === radii[2] && radii[2] === radii[3];
  return {
    ...(allSame
      ? { cornerRadius: radii[0], cornerRadii: undefined }
      : { cornerRadius: undefined, cornerRadii: radii }),
    pathPoints: pathPointsFromCornerRadii(node, radii),
  };
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
  const grabMetric = cornerRadiusMetricAtPoint(cornerIndex, grabX, grabY, width, height);
  const moveMetric = cornerRadiusMetricAtPoint(cornerIndex, moveX, moveY, width, height);
  const next = grabRadius + (moveMetric - grabMetric);
  return Math.min(maxRadius, Math.max(0, next));
}

export function ensureRoundedRectPathPoints(node: EditorNode): EditorNode {
  if (node.type !== "path" || node.pathClosed === false || pathHasCurveHandles(node.pathPoints)) {
    return node;
  }
  if (isRoundedRectPath(node)) return node;
  const pts = node.pathPoints ?? [];
  if (pts.length < 4) return node;
  return {
    ...node,
    pathPoints: rectCornerPathPoints(node.width, node.height, pts),
  };
}

export function convertNodeToPath(node: EditorNode): EditorNode | null {
  if (!isVectorEditableShape(node)) return null;
  if (node.type === "path" && node.pathPoints?.length) {
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
    arrowHead: undefined,
    arcStartDeg: undefined,
    arcSweepDeg: undefined,
    arcInnerRadiusRatio: undefined,
  };
  return normalizePathNode(next);
}
