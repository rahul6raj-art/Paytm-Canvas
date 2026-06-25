import { getNodeCornerRadii, outlineRoundedRectRingPathD, type StrokeBandAlign } from "@/lib/cornerRadius";
import { buildRoundedPolygonPathSvgD } from "@/lib/geometry/roundedPolygon";
import { newPathPointId, type PathPoint } from "@/lib/pathGeometry";
import { getShapeVertexCornerRadii } from "@/lib/shapes/parametricCornerRadii";
import {
  clampPolygonSides,
  isPolygonNode,
  polygonVertices,
} from "@/lib/shapes/polygonGeometry";
import { clampPathCornerRadii, hasPathCornerRadius } from "@/lib/shapes/shapeToPath";
import {
  clampStarPointCount,
  clampStarRatio,
  isStarNode,
  starVertices,
} from "@/lib/shapes/starGeometry";
import { offsetPolygonPoints, pointsToClosedPathD, type Point2 } from "@/lib/strokeOffset";
import type { EditorNode } from "@/stores/useEditorStore";

/** True when stroke should use filled outline geometry (not native SVG stroke). */
export function shapeHasRoundedCornerStroke(
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
  >,
): boolean {
  if (node.type === "rectangle" || node.type === "frame") {
    return getNodeCornerRadii(node).some((r) => r > 0);
  }
  if (hasPathCornerRadius(node)) return true;
  if (node.type === "polygon" && (node.cornerRadius ?? 0) > 0) return true;
  if (isPolygonNode(node)) {
    return getShapeVertexCornerRadii(node).some((r) => r > 0);
  }
  if (isStarNode(node)) {
    return getShapeVertexCornerRadii(node).some((r) => r > 0);
  }
  return false;
}

function strokeRingVertices(
  node: Pick<
    EditorNode,
    | "type"
    | "width"
    | "height"
    | "pathPoints"
    | "polygonSides"
    | "starPoints"
    | "starInnerRadius"
  >,
): Point2[] | null {
  if ((node.type === "path" || node.type === "polygon") && (node.pathPoints?.length ?? 0) >= 3) {
    return (node.pathPoints ?? []).map((p) => ({ x: p.x, y: p.y }));
  }
  if (isPolygonNode(node) || node.type === "polygon") {
    const sides = clampPolygonSides(node.polygonSides ?? 6);
    return polygonVertices(sides, node.width, node.height);
  }
  if (isStarNode(node)) {
    const spikes = clampStarPointCount(node.starPoints ?? 5);
    const ratio = clampStarRatio(node.starInnerRadius ?? 0.4);
    return starVertices(spikes, ratio, node.width, node.height);
  }
  return null;
}

function clampRadiiForVertices(vertices: readonly Point2[], radii: readonly number[]): number[] {
  const pathPoints: PathPoint[] = vertices.map((p) => ({
    id: newPathPointId(),
    x: p.x,
    y: p.y,
  }));
  return clampPathCornerRadii(pathPoints, radii);
}

/**
 * Parallel-offset a filleted polygon boundary (same model as offsetRoundedRectPathD):
 * move vertices along edge normals and adjust corner radii by the same delta.
 */
function buildOffsetRoundedBoundaryPathD(
  vertices: readonly Point2[],
  radii: readonly number[],
  delta: number,
  cornerSmoothing = 0,
): string | null {
  const n = vertices.length;
  if (n < 3) return null;

  if (Math.abs(delta) < 1e-9) {
    if (!radii.some((r) => r > 0)) return pointsToClosedPathD([...vertices]);
    const clamped = clampRadiiForVertices(vertices, radii);
    if (!clamped.some((r) => r > 0)) return pointsToClosedPathD([...vertices]);
    return buildRoundedPolygonPathSvgD(vertices, { cornerRadii: clamped, cornerSmoothing }, true);
  }

  const moved = offsetPolygonPoints([...vertices], delta, "miter");
  if (moved.length < 3) return null;

  const adjusted = radii.map((r, i) => Math.max(0, (radii[i] ?? radii[i % radii.length] ?? 0) + delta));
  if (!adjusted.some((r) => r > 0)) {
    return pointsToClosedPathD(moved);
  }

  const clamped = clampRadiiForVertices(moved, adjusted);
  if (!clamped.some((r) => r > 0)) return pointsToClosedPathD(moved);
  return buildRoundedPolygonPathSvgD(moved, { cornerRadii: clamped, cornerSmoothing }, true);
}

/** Figma-style even-odd stroke band using true parallel offset of fillet geometry. */
export function outlineRoundedVectorRingPathD(
  vertices: readonly Point2[],
  radii: readonly number[],
  strokeWidth: number,
  align: StrokeBandAlign,
  cornerSmoothing = 0,
): { pathD: string; fillRule: "evenodd" | "nonzero" } | null {
  const n = vertices.length;
  if (n < 3 || strokeWidth < 1e-9) return null;
  if (!radii.some((r) => r > 0)) return null;

  const half = strokeWidth / 2;
  let outerD: string | null;
  let innerD: string | null;
  if (align === "center") {
    outerD = buildOffsetRoundedBoundaryPathD(vertices, radii, half, cornerSmoothing);
    innerD = buildOffsetRoundedBoundaryPathD(vertices, radii, -half, cornerSmoothing);
  } else if (align === "inside") {
    outerD = buildOffsetRoundedBoundaryPathD(vertices, radii, 0, cornerSmoothing);
    innerD = buildOffsetRoundedBoundaryPathD(vertices, radii, -strokeWidth, cornerSmoothing);
  } else {
    outerD = buildOffsetRoundedBoundaryPathD(vertices, radii, strokeWidth, cornerSmoothing);
    innerD = buildOffsetRoundedBoundaryPathD(vertices, radii, 0, cornerSmoothing);
  }

  if (!outerD) return null;
  if (!innerD) return { pathD: outerD, fillRule: "nonzero" };
  return { pathD: `${outerD} ${innerD}`, fillRule: "evenodd" };
}

/** Rects/frames use analytic fillet rings; other shapes offset the fill boundary for uniform width. */
export function useAnalyticRoundedStrokeRing(
  node: Pick<EditorNode, "type">,
): boolean {
  return node.type === "rectangle" || node.type === "frame";
}

export function roundedVectorStrokeRingForNode(
  node: EditorNode,
  strokeWidth: number,
  align: StrokeBandAlign,
): { pathD: string; fillRule: "evenodd" | "nonzero" } | null {
  if (node.type === "rectangle" || node.type === "frame") {
    const w = Math.max(1, node.width);
    const h = Math.max(1, node.height);
    const radii = getNodeCornerRadii(node);
    return outlineRoundedRectRingPathD(
      w,
      h,
      radii,
      strokeWidth,
      align,
      node.cornerSmoothing ?? 0,
    );
  }

  if (!shapeHasRoundedCornerStroke(node)) return null;
  const vertices = strokeRingVertices(node);
  if (!vertices?.length) return null;
  const rawRadii = getShapeVertexCornerRadii(node);
  const radii =
    rawRadii.length === vertices.length
      ? clampRadiiForVertices(vertices, rawRadii)
      : rawRadii;
  return outlineRoundedVectorRingPathD(
    vertices,
    radii,
    strokeWidth,
    align,
    node.cornerSmoothing ?? 0,
  );
}
