import {
  clampCornerRadii,
  getNodeCornerRadii,
  roundedRectPathD,
  type CornerRadii,
} from "@/lib/cornerRadius";
import { newPathPointId, normalizePathNode, pathToSvgD, type PathPoint } from "@/lib/pathGeometry";
import type { EditorNode } from "@/stores/useEditorStore";
import { generatePolygonPoints } from "./pathGenerators";

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

export type VectorEditableShapeType = "rectangle" | "ellipse" | "line" | "path";

export function isVectorEditableShape(
  node: Pick<EditorNode, "type" | "locked" | "visible"> | null | undefined,
): node is EditorNode & { type: VectorEditableShapeType } {
  if (!node || node.locked || node.visible === false) return false;
  return (
    node.type === "rectangle" ||
    node.type === "ellipse" ||
    node.type === "line" ||
    node.type === "path"
  );
}

export function shapeToPathPoints(
  node: Pick<EditorNode, "type" | "width" | "height" | "pathPoints" | "pathClosed" | "cornerRadius" | "cornerRadii">,
): { pathPoints: PathPoint[]; pathClosed: boolean } | null {
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);

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
    return {
      pathPoints: generatePolygonPoints(64, w, h),
      pathClosed: true,
    };
  }

  if (node.type === "line") {
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

/** SVG path `d` for display/hit-testing (uses corner radii when applicable). */
export function pathOutlineD(
  node: Pick<
    EditorNode,
    "type" | "width" | "height" | "pathPoints" | "pathClosed" | "cornerRadius" | "cornerRadii"
  >,
): string {
  if (node.type !== "path") return "";
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

export function radiusFromCornerDrag(
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
      return Math.max(0, localX);
    case 1:
      return Math.max(0, w - localX);
    case 2:
      return Math.max(0, h - localY);
    case 3:
      return Math.max(0, h - localY);
    default:
      return 0;
  }
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
  };
  return normalizePathNode(next);
}
