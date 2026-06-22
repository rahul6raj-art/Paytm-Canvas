import type { PathPoint } from "@/lib/pathGeometry";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  getPolygonVertexCornerRadii,
  isPolygonNode,
  polygonVertices,
} from "@/lib/shapes/polygonGeometry";
import {
  getStarVertexCornerRadii,
  isStarNode,
  starVertices,
} from "@/lib/shapes/starGeometry";
import { createRoundedPathWithRadiiSvgD } from "./createRoundedPath";
import { createRoundedVectorPath2D, createRoundedVectorPathSvgD } from "./createRoundedVectorPath";
import type { Point2 } from "./roundedCornerUtils";

export type ShapePathInput = Pick<
  EditorNode,
  | "type"
  | "width"
  | "height"
  | "polygonSides"
  | "cornerRadius"
  | "cornerRadii"
  | "cornerSmoothing"
  | "starPoints"
  | "starInnerRadius"
  | "starOuterCornerRadius"
  | "starInnerCornerRadius"
  | "pathPoints"
  | "pathClosed"
>;

function polygonPointsForNode(node: ShapePathInput): Point2[] {
  const sides = node.polygonSides ?? 6;
  return polygonVertices(sides, node.width, node.height);
}

function starPointsForNode(node: ShapePathInput): Point2[] {
  return starVertices(
    node.starPoints ?? 5,
    node.starInnerRadius ?? 0.4,
    node.width,
    node.height,
  );
}

/** SVG path `d` for polygon, star, or vector path shapes. */
export function createShapePathSvgD(
  node: ShapePathInput,
): string {
  const smoothing = node.cornerSmoothing ?? 0;
  if (isPolygonNode(node)) {
    const points = polygonPointsForNode(node);
    const radii = getPolygonVertexCornerRadii(node);
    return createRoundedPathWithRadiiSvgD(points, radii, true, { cornerSmoothing: smoothing });
  }
  if (node.type !== "path") return "";
  if (isStarNode(node)) {
    const points = starPointsForNode(node);
    const radii = getStarVertexCornerRadii(node);
    return createRoundedPathWithRadiiSvgD(points, radii, true, { cornerSmoothing: smoothing });
  }
  const pts = node.pathPoints ?? [];
  return createRoundedVectorPathSvgD({
    points: pts,
    closed: node.pathClosed ?? false,
    cornerSmoothing: smoothing,
  });
}

export function createShapePath2D(node: ShapePathInput): Path2D {
  if (isPolygonNode(node)) {
    const d = createShapePathSvgD(node);
    return new Path2D(d);
  }
  if (node.type !== "path") return new Path2D();
  if (isStarNode(node)) {
    const d = createShapePathSvgD(node);
    return new Path2D(d);
  }
  const pts = node.pathPoints ?? [];
  return createRoundedVectorPath2D({ points: pts, closed: node.pathClosed ?? false });
}
