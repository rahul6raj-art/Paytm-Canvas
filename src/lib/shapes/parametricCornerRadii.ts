import type { EditorNode } from "@/stores/useEditorStore";
import {
  getNodeCornerRadii,
  hasIndependentVertexCornerRadii,
  resizeCornerRadiiForCount,
} from "@/lib/cornerRadius";
import {
  clampPolygonSides,
  clampPolygonVertexCornerRadii,
  DEFAULT_POLYGON_SIDES,
  getPolygonVertexCornerRadii,
  isPolygonNode,
} from "@/lib/shapes/polygonGeometry";
import {
  clampStarPointCount,
  clampStarVertexCornerRadii,
  DEFAULT_STAR_POINTS,
  getStarVertexCornerRadii,
  isStarNode,
} from "@/lib/shapes/starGeometry";
import {
  getPathVertexCornerRadii,
  pathSupportsCornerRadius,
} from "@/lib/shapes/shapeToPath";

export {
  resizeCornerRadiiForCount,
  hasIndependentVertexCornerRadii,
  clampPolygonVertexCornerRadii,
  getPolygonVertexCornerRadii,
  clampStarVertexCornerRadii,
  getStarVertexCornerRadii,
};

export function shapeUsesVertexCornerRadii(
  node: Pick<EditorNode, "type" | "polygonSides" | "starPoints" | "pathPoints" | "pathClosed">,
): boolean {
  if (node.type === "rectangle" || node.type === "frame") return false;
  return (
    isPolygonNode(node) ||
    isStarNode(node) ||
    node.type === "path"
  );
}

/** Per-vertex radii for polygon, star, vector path, or rect (4). */
export function getShapeVertexCornerRadii(
  node: Pick<
    EditorNode,
    | "type"
    | "width"
    | "height"
    | "polygonSides"
    | "starPoints"
    | "starInnerRadius"
    | "cornerRadius"
    | "cornerRadii"
    | "starOuterCornerRadius"
    | "starInnerCornerRadius"
    | "pathPoints"
    | "pathClosed"
  >,
): number[] {
  if (isPolygonNode(node)) return getPolygonVertexCornerRadii(node);
  if (isStarNode(node)) return getStarVertexCornerRadii(node);
  if (node.type === "path") return getPathVertexCornerRadii(node);
  return [...getNodeCornerRadii(node)];
}

export function polygonCornerRadiusLabels(sides: number): string[] {
  const n = clampPolygonSides(sides);
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

export function starCornerRadiusLabels(pointCount: number): string[] {
  const spikes = clampStarPointCount(pointCount);
  const labels: string[] = [];
  for (let i = 0; i < spikes; i++) {
    labels.push(`O${i + 1}`);
    labels.push(`I${i + 1}`);
  }
  return labels;
}

export function shapeSupportsIndividualCornerRadius(
  node: Pick<
    EditorNode,
    "type" | "polygonSides" | "starPoints" | "pathPoints" | "pathClosed"
  >,
): boolean {
  if (node.type === "rectangle" || node.type === "frame" || node.type === "polygon") {
    return true;
  }
  if (isPolygonNode(node) || isStarNode(node)) return true;
  return pathSupportsCornerRadius({ ...node, width: 1, height: 1 });
}
