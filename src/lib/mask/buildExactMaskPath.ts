import { getNodeCornerRadii, roundedRectPathD } from "@/lib/cornerRadius";
import { getRenderedWorldTopLeft } from "@/lib/editorGraph";
import { warnMaskFallback } from "@/lib/mask/maskDiagnostics";
import type { ExactPathD, MaskClipPathResult } from "@/lib/mask/types";
import { pathToSvgD } from "@/lib/pathGeometry";
import { effectiveEllipseArc, ellipseArcPathD } from "@/lib/shapes/ellipseArc";
import { isPolygonNode, polygonPathDForNode } from "@/lib/shapes/polygonGeometry";
import { isStarNode, starPathDForNode } from "@/lib/shapes/starGeometry";
import { vectorShapeOutlineD } from "@/lib/shapes/shapeToPath";
import {
  absoluteSegmentsToPathD,
  parseSvgPathToAbsolute,
} from "@/lib/svgImport/parseSvgPath";
import {
  applyMatrixToPoint,
  getNodeTransformedWorldBounds,
  getNodeWorldMatrix,
  invertMatrix,
  multiplyMatrix,
  type Matrix2D,
} from "@/lib/transformMath";
import { worldRect } from "@/lib/tree";
import type { EditorNode } from "@/stores/useEditorStore";
import { getNodeWorldMatrixFromChildOrder } from "@/lib/editorGraph";

function fillRuleForNode(node: EditorNode, pathD: string): "nonzero" | "evenodd" {
  if (node.pathFillRule === "evenodd") return "evenodd";
  const moves = (pathD.match(/\bM\b/gi) ?? []).length;
  if (moves > 1) return "evenodd";
  return "nonzero";
}

/**
 * Exact SVG path `d` in the node's local coordinate space (preserves curves, arcs, holes).
 */
export function shapeNodeToExactPathD(node: EditorNode, nodeId?: string): ExactPathD | null {
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);

  let pathD = "";

  if (node.type === "path") {
    if (isStarNode(node)) {
      pathD = starPathDForNode(node);
    } else if (node.pathPoints?.length) {
      pathD = pathToSvgD(node.pathPoints, node.pathClosed ?? false);
    } else if (node.flattenedPathData?.trim()) {
      pathD = node.flattenedPathData.trim();
    } else {
      pathD = vectorShapeOutlineD(node, nodeId);
    }
  } else if (node.type === "ellipse") {
    const arc = effectiveEllipseArc(node);
    pathD = ellipseArcPathD(w, h, arc.startDeg, arc.sweepDeg, arc.innerRadiusRatio);
  } else if (node.type === "rectangle") {
    pathD = roundedRectPathD(w, h, getNodeCornerRadii(node));
  } else if (isPolygonNode(node)) {
    pathD = polygonPathDForNode(node);
  } else {
    return null;
  }

  if (!pathD.trim()) return null;
  return { pathD, fillRule: fillRuleForNode(node, pathD) };
}

export function applyMatrixToPathD(pathD: string, matrix: Matrix2D): string | null {
  const segs = parseSvgPathToAbsolute(pathD);
  if (segs.length === 0) return null;

  const transformed = segs.map((seg) => {
    if (seg.type === "M" || seg.type === "L") {
      const p = applyMatrixToPoint(matrix, { x: seg.x, y: seg.y });
      return { ...seg, x: p.x, y: p.y };
    }
    if (seg.type === "C") {
      const p1 = applyMatrixToPoint(matrix, { x: seg.x1, y: seg.y1 });
      const p2 = applyMatrixToPoint(matrix, { x: seg.x2, y: seg.y2 });
      const p = applyMatrixToPoint(matrix, { x: seg.x, y: seg.y });
      return {
        type: "C" as const,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        x: p.x,
        y: p.y,
      };
    }
    return seg;
  });

  const out = absoluteSegmentsToPathD(transformed);
  return out.trim() ? out : null;
}

export function transformPathD(pathD: string, matrix: Matrix2D): string | null {
  return applyMatrixToPathD(pathD, matrix);
}

export function getNodeWorldTransform(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder?: Record<string, string[]>,
): Matrix2D | null {
  if (childOrder) {
    return getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  }
  return getNodeWorldMatrix(nodeId, nodes);
}

export function getGroupWorldTransform(
  groupId: string,
  nodes: Record<string, EditorNode>,
  childOrder?: Record<string, string[]>,
): Matrix2D | null {
  return getNodeWorldTransform(groupId, nodes, childOrder);
}

export { invertMatrix } from "@/lib/transformMath";

export function worldPathDToGroupLocalPathD(
  worldPathD: string,
  groupWorldM: Matrix2D,
): string | null {
  const groupInv = invertMatrix(groupWorldM);
  if (!groupInv) return null;
  return applyMatrixToPathD(worldPathD, groupInv);
}

export function maskLocalPathDToGroupLocalPathD(
  maskLocalPathD: string,
  maskWorldM: Matrix2D,
  groupWorldM: Matrix2D,
): string | null {
  const groupInv = invertMatrix(groupWorldM);
  if (!groupInv) return null;
  const maskToGroupM = multiplyMatrix(groupInv, maskWorldM);
  return applyMatrixToPathD(maskLocalPathD, maskToGroupM);
}

function polygonToPathD(points: { x: number; y: number }[], originX: number, originY: number): string {
  if (points.length < 2) return "";
  let d = `M ${points[0]!.x - originX} ${points[0]!.y - originY}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i]!.x - originX} ${points[i]!.y - originY}`;
  }
  return `${d} Z`;
}

/** Exact mask clip path in mask-group local coordinates. */
export function buildMaskClipPathForGroup(
  groupId: string,
  maskChildId: string,
  nodes: Record<string, EditorNode>,
  childOrder?: Record<string, string[]>,
): MaskClipPathResult | null {
  const mask = nodes[maskChildId];
  if (!mask) return null;

  const exact = shapeNodeToExactPathD(mask, maskChildId);
  if (exact?.pathD) {
    const maskWorldM = getNodeWorldTransform(maskChildId, nodes, childOrder);
    const groupWorldM = getGroupWorldTransform(groupId, nodes, childOrder);
    if (maskWorldM && groupWorldM) {
      const clipD = maskLocalPathDToGroupLocalPathD(exact.pathD, maskWorldM, groupWorldM);
      if (clipD) {
        return { clipD, clipRule: exact.fillRule };
      }
    }
  }

  warnMaskFallback(
    groupId,
    maskChildId,
    "exact clip path unavailable; using polygon approximation",
  );

  const origin = childOrder
    ? getRenderedWorldTopLeft(groupId, nodes, childOrder)
    : (() => {
        const w = worldRect(groupId, nodes);
        return { x: w.x, y: w.y };
      })();
  const wb = getNodeTransformedWorldBounds(maskChildId, nodes);
  const fallback = [
    { x: wb.x, y: wb.y },
    { x: wb.x + wb.width, y: wb.y },
    { x: wb.x + wb.width, y: wb.y + wb.height },
    { x: wb.x, y: wb.y + wb.height },
  ];
  const clipD = polygonToPathD(fallback, origin.x, origin.y);
  return clipD ? { clipD, clipRule: "nonzero" } : null;
}
