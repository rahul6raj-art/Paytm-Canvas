import { getNodeCornerRadii, roundedRectPathD, roundedRectPolygonPoints } from "@/lib/cornerRadius";
import type { EditorNode } from "@/stores/useEditorStore";
import { ROOT } from "@/stores/useEditorStore";
import {
  getRenderedWorldTopLeft,
  getNodeWorldMatrixFromChildOrder,
  layerPanelChildIds,
  topLevelSelectedIds,
} from "@/lib/editorGraph";
import { pathToSvgD, svgPathDToPathPoints } from "@/lib/pathGeometry";
import { effectiveEllipseArc, ellipseArcPathD, ellipseLocalPolygonPoints } from "@/lib/shapes/ellipseArc";
import { isPolygonNode, polygonVertices } from "@/lib/shapes/polygonGeometry";
import {
  applyMatrixToPoint,
  getNodeTransformedWorldBounds,
  getNodeWorldMatrix,
} from "@/lib/transformMath";
import { clipperApplyBoolean } from "@/lib/geometry/clipperKernel";
import {
  buildMaskClipPathDForGroup,
  isBooleanGroup,
  isMaskGroup,
  maskGroupChildHitOrder,
  type MaskClipPathResult,
} from "@/lib/mask";
import { tessellatePathPoints, tessellateSvgPathD } from "@/lib/outlineStroke";
import { DEFAULT_SHAPE_FILL, editorNodeToShape } from "@/lib/shapes/shapeModel";
import { worldRect } from "@/lib/tree";

export type { MaskClipPathResult };
export { isBooleanGroup, isMaskGroup, maskGroupChildHitOrder, buildMaskClipPathDForGroup };

export type BooleanOperation = "union" | "subtract" | "intersect" | "exclude";

export type BooleanInput = {
  id: string;
  /** Closed polygon in world space. */
  polygon: { x: number; y: number }[];
  fill: string;
};

export type BooleanResult = {
  /** SVG path `d` in local bbox coordinates. */
  pathD: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillRule?: "nonzero" | "evenodd";
  fill: string;
};

export const BOOLEAN_OPERATION_LABELS: Record<BooleanOperation, string> = {
  union: "Union",
  subtract: "Subtract",
  intersect: "Intersect",
  exclude: "Exclude",
};

/** Nodes eligible for boolean / mask (lines excluded in v1). */
export function isBooleanEligibleNode(node: EditorNode | undefined): boolean {
  if (!node || !node.visible || node.locked) return false;
  if (node.type === "line" || node.type === "arrow") return false;
  if (
    node.type === "rectangle" ||
    node.type === "ellipse" ||
    node.type === "polygon" ||
    node.type === "path"
  ) {
    return true;
  }
  if (node.type === "group" && node.isBooleanGroup && !node.maskId) return true;
  return false;
}

type WorldBounds = { x: number; y: number; width: number; height: number };

function boundsOfPolygonPoints(points: { x: number; y: number }[]): WorldBounds | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) return null;
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * World bounds of the visible boolean result via Clipper2 (not operand AABB heuristics).
 */
export function boundsForBooleanChildren(
  operation: BooleanOperation,
  childIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder?: Record<string, string[]>,
): WorldBounds {
  const inputs = shapesToBooleanInput(childIds, nodes, childOrder);
  if (inputs.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  if (inputs.length === 1) {
    return boundsOfPolygonPoints(inputs[0]!.polygon) ?? boundsOfPolygons(inputs);
  }

  const result = applyBooleanOperation(operation, inputs);
  if (result) {
    return { x: result.x, y: result.y, width: result.width, height: result.height };
  }

  if (operation === "intersect") {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return boundsOfPolygons(inputs);
}

export function getBooleanGroupVisibleWorldBounds(
  groupId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): WorldBounds {
  const g = nodes[groupId];
  if (!isBooleanGroup(g)) {
    const wb = getNodeTransformedWorldBounds(groupId, nodes);
    return { x: wb.x, y: wb.y, width: wb.width, height: wb.height };
  }
  const childIds = layerPanelChildIds(groupId, nodes, childOrder).filter((cid) => {
    const c = nodes[cid];
    return c && c.visible && !c.locked;
  });
  if (childIds.length === 0) {
    const wb = getNodeTransformedWorldBounds(groupId, nodes);
    return { x: wb.x, y: wb.y, width: Math.max(1, wb.width), height: Math.max(1, wb.height) };
  }
  return boundsForBooleanChildren(g.booleanOperation ?? "union", childIds, nodes, childOrder);
}

/** Mask groups use visible-region AABB for selection, not a single child transform. */
export function maskGroupFrameNodeId(_node: EditorNode | undefined): string | null {
  return null;
}

export function getBooleanEligibleSelection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): string[] {
  return topLevelSelectedIds(selectedIds, nodes).filter((id) => isBooleanEligibleNode(nodes[id]));
}

/** Topmost sibling by paint order (last in parent's childOrder). */
export function topmostAmongSiblings(
  ids: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string {
  const parentId = nodes[ids[0]!]?.parentId ?? null;
  const listKey = parentId ?? ROOT;
  const list = childOrder[listKey] ?? [];
  let best = ids[0]!;
  let bestIdx = -1;
  for (const id of ids) {
    const idx = list.indexOf(id);
    if (idx > bestIdx) {
      bestIdx = idx;
      best = id;
    }
  }
  return best;
}

/** Local-space SVG subpath for a shape node (inside its own box). */
export function nodeToLocalSvgSubpath(node: EditorNode): string {
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  if (node.type === "path" && node.pathPoints?.length) {
    return pathToSvgD(node.pathPoints, node.pathClosed ?? false) || "";
  }
  if (node.type === "ellipse") {
    const arc = effectiveEllipseArc(node);
    return ellipseArcPathD(w, h, arc.startDeg, arc.sweepDeg, arc.innerRadiusRatio);
  }
  if (node.type === "rectangle") {
    const radii = getNodeCornerRadii(node);
    return roundedRectPathD(w, h, radii);
  }
  return "";
}

/** World-space closed polygon approximation for a node. */
export function shapeNodeToWorldPolygon(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  opts?: { ellipseSegments?: number; childOrder?: Record<string, string[]> },
): { x: number; y: number }[] {
  const node = nodes[nodeId];
  if (!node) return [];
  const segs = opts?.ellipseSegments ?? 64;
  const m = opts?.childOrder
    ? getNodeWorldMatrixFromChildOrder(nodeId, nodes, opts.childOrder)
    : getNodeWorldMatrix(nodeId, nodes);
  if (!m) return [];
  const localPts = (() => {
    const w = Math.max(1, node.width);
    const h = Math.max(1, node.height);
    if (isPolygonNode(node)) {
      const sides = node.polygonSides ?? 6;
      return polygonVertices(sides, w, h);
    }
    if (node.type === "path") {
      if (node.pathPoints?.length && (node.pathClosed ?? false)) {
        const tess = tessellatePathPoints(node.pathPoints, true);
        if (tess.length >= 3) return tess;
      }
      if (node.flattenedPathData) {
        const tess = tessellateSvgPathD(node.flattenedPathData);
        if (tess.length >= 3) return tess;
      }
      let pts = node.pathPoints ?? [];
      if (pts.length < 3 && node.flattenedPathData) {
        const fromD = svgPathDToPathPoints(node.flattenedPathData);
        if (fromD.length >= 3) pts = fromD;
      }
      if (pts.length >= 3 && (node.pathClosed ?? false)) {
        return pts.map((p) => ({ x: p.x, y: p.y }));
      }
      if (node.pathPoints?.length) {
        const wb = getNodeTransformedWorldBounds(nodeId, nodes);
        return [
          { x: 0, y: 0 },
          { x: node.width, y: 0 },
          { x: node.width, y: node.height },
          { x: 0, y: node.height },
        ];
      }
    }
    if (node.type === "ellipse") {
      const arc = effectiveEllipseArc(node);
      return ellipseLocalPolygonPoints(w, h, arc, segs);
    }
    if (node.type === "rectangle") {
      return roundedRectPolygonPoints(w, h, getNodeCornerRadii(node));
    }
    if (node.type === "group" && node.isBooleanGroup) {
      const wb = getNodeTransformedWorldBounds(nodeId, nodes);
      return [
        { x: 0, y: 0 },
        { x: wb.width, y: 0 },
        { x: wb.width, y: wb.height },
        { x: 0, y: wb.height },
      ];
    }
    return [];
  })();
  return localPts.map((p) => applyMatrixToPoint(m, p));
}

export function shapesToBooleanInput(
  ids: string[],
  nodes: Record<string, EditorNode>,
  childOrder?: Record<string, string[]>,
): BooleanInput[] {
  return ids
    .map((id) => {
      const node = nodes[id];
      if (!node || !isBooleanEligibleNode(node)) return null;
      const polygon = shapeNodeToWorldPolygon(id, nodes, { childOrder });
      if (polygon.length < 3) return null;
      return {
        id,
        polygon,
        fill: node.fillEnabled === false ? "transparent" : (node.fill ?? DEFAULT_SHAPE_FILL),
      };
    })
    .filter(Boolean) as BooleanInput[];
}

function polygonToPathD(points: { x: number; y: number }[], originX: number, originY: number): string {
  if (points.length < 2) return "";
  let d = `M ${points[0]!.x - originX} ${points[0]!.y - originY}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i]!.x - originX} ${points[i]!.y - originY}`;
  }
  return `${d} Z`;
}

/** Operand paint order — first (bottom) shape is subtract subject when applicable. */
export function orderedBooleanChildIds(
  childIds: string[],
  _operation: BooleanOperation,
): string[] {
  return childIds;
}

/** World-space polygons → single SVG path `d` in group-local coordinates (Clipper2). */
export function buildCompositePathDForGroup(
  groupId: string,
  childIds: string[],
  nodes: Record<string, EditorNode>,
  operation: BooleanOperation,
  childOrder?: Record<string, string[]>,
): { d: string; fillRule: "nonzero" | "evenodd"; fill: string } | null {
  const ordered = orderedBooleanChildIds(childIds, operation);
  const inputs = shapesToBooleanInput(ordered, nodes, childOrder);
  if (inputs.length < 2) return null;

  const origin = booleanGroupLocalOrigin(groupId, nodes, childOrder);
  const result = applyBooleanOperation(operation, inputs, { pathOrigin: origin });
  if (!result) return null;

  return {
    d: result.pathD,
    fillRule: result.fillRule ?? "nonzero",
    fill: result.fill,
  };
}

export type SubtractCompositePaths = {
  baseD: string;
  subtractD: string;
  fill: string;
};

export type BooleanRenderModel =
  | { op: "union"; pathDs: string[]; fill: string }
  | { op: "subtract"; baseD: string; subtractD: string; fill: string }
  | { op: "intersect"; pathDs: string[]; fill: string }
  | { op: "exclude"; pathDs: string[]; fill: string }
  | {
      op: "clipper";
      pathD: string;
      fillRule: "nonzero" | "evenodd";
      fill: string;
    };

function booleanGroupLocalOrigin(
  groupId: string,
  nodes: Record<string, EditorNode>,
  childOrder?: Record<string, string[]>,
): { x: number; y: number } {
  if (childOrder) {
    return getRenderedWorldTopLeft(groupId, nodes, childOrder);
  }
  const w = worldRect(groupId, nodes);
  return { x: w.x, y: w.y };
}

function collectOperandPathDs(
  groupId: string,
  childIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder?: Record<string, string[]>,
): { pathDs: string[]; fill: string } | null {
  const { x: originX, y: originY } = booleanGroupLocalOrigin(groupId, nodes, childOrder);
  const pathDs: string[] = [];
  let fill = DEFAULT_SHAPE_FILL;

  for (const cid of childIds) {
    const node = nodes[cid];
    if (!node) continue;
    const poly = shapeNodeToWorldPolygon(cid, nodes, { childOrder });
    if (poly.length < 3) continue;
    pathDs.push(polygonToPathD(poly, originX, originY));
    if (pathDs.length === 1 && node.fillEnabled !== false) {
      fill = node.fill ?? fill;
    }
  }

  if (pathDs.length === 0) return null;
  return { pathDs, fill };
}

/**
 * Base + subtract paths in group-local space for SVG mask rendering.
 * Mask: bases white, subtract black — correct set difference (unlike evenodd on overlaps).
 */
export function buildSubtractCompositeForGroup(
  groupId: string,
  childIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder?: Record<string, string[]>,
): SubtractCompositePaths | null {
  const ordered = orderedBooleanChildIds(childIds, "subtract");
  if (ordered.length < 2) return null;

  const collected = collectOperandPathDs(groupId, ordered, nodes, childOrder);
  if (!collected || collected.pathDs.length < 2) return null;

  const subtractD = collected.pathDs[collected.pathDs.length - 1]!;
  const baseD = collected.pathDs.slice(0, -1).join(" ");
  if (!baseD || !subtractD) return null;

  return { baseD, subtractD, fill: collected.fill };
}

/**
 * Canvas/export boolean preview — Clipper2 for all operand counts (≥2).
 */
export function buildBooleanRenderForGroup(
  groupId: string,
  childIds: string[],
  nodes: Record<string, EditorNode>,
  operation: BooleanOperation,
  childOrder?: Record<string, string[]>,
): BooleanRenderModel | null {
  const visibleKids = childIds.filter((cid) => {
    const c = nodes[cid];
    return c && c.visible && !c.locked;
  });
  if (visibleKids.length < 2) return null;

  const ordered = orderedBooleanChildIds(visibleKids, operation);
  const inputs = shapesToBooleanInput(ordered, nodes, childOrder);
  if (inputs.length < 2) return null;

  const origin = booleanGroupLocalOrigin(groupId, nodes, childOrder);
  const clipped = applyBooleanOperation(operation, inputs, { pathOrigin: origin });
  if (!clipped) return null;

  return {
    op: "clipper",
    pathD: clipped.pathD,
    fillRule: clipped.fillRule ?? "nonzero",
    fill: clipped.fill,
  };
}

function boundsOfPolygons(inputs: BooleanInput[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const inp of inputs) {
    for (const p of inp.polygon) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Flatten/export boolean pipeline — Clipper2 kernel (same path as canvas preview).
 */
export function applyBooleanOperation(
  operation: BooleanOperation,
  inputs: BooleanInput[],
  options?: { pathOrigin?: { x: number; y: number } },
): BooleanResult | null {
  if (inputs.length < 2) return null;
  const fill = inputs[0]!.fill;
  return clipperApplyBoolean(
    operation,
    inputs.map((inp) => ({ polygon: inp.polygon })),
    fill,
    options,
  );
}

export function booleanResultToPathNode(
  result: BooleanResult,
  template: EditorNode,
  parentId: string | null,
): EditorNode {
  return {
    id: `path-bool-${Date.now()}`,
    parentId,
    type: "path",
    name: "Flattened",
    x: result.x,
    y: result.y,
    width: result.width,
    height: result.height,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    pathPoints: [],
    pathClosed: true,
    flattenedPathData: result.pathD,
    fill: result.fill,
    fillEnabled: true,
    fillOpacity: template.fillOpacity ?? 1,
    strokeWidth: template.strokeWidth ?? 0,
    strokeColor: template.strokeColor,
    strokePosition: template.strokePosition ?? "center",
    opacity: template.opacity ?? 1,
  };
}

/** Flatten a boolean group into SVG path data (stored on group or new path). */
export function flattenBooleanGroup(
  group: EditorNode,
  childIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder?: Record<string, string[]>,
): BooleanResult | null {
  const op = group.booleanOperation ?? "union";
  const ordered = orderedBooleanChildIds(childIds, op);
  const inputs = shapesToBooleanInput(ordered, nodes, childOrder);
  if (inputs.length < 2) return null;
  return applyBooleanOperation(op, inputs);
}

/** SVG path in group-local coordinates for clip/mask defs. */
export function nodeToGroupLocalSvgPath(
  node: EditorNode,
  groupX: number,
  groupY: number,
): string {
  const sub = nodeToLocalSvgSubpath(node);
  if (!sub) return "";
  const tx = node.x - groupX;
  const ty = node.y - groupY;
  if (node.rotation) {
    const cx = tx + node.width / 2;
    const cy = ty + node.height / 2;
    return `<path d="${sub}" transform="translate(${tx} ${ty}) rotate(${node.rotation} ${node.width / 2} ${node.height / 2})" />`;
  }
  return `<path d="${sub}" transform="translate(${tx} ${ty})" />`;
}

export function booleanGroupBounds(childIds: string[], nodes: Record<string, EditorNode>) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of childIds) {
    const w = worldRect(id, nodes);
    minX = Math.min(minX, w.x);
    minY = Math.min(minY, w.y);
    maxX = Math.max(maxX, w.x + w.width);
    maxY = Math.max(maxY, w.y + w.height);
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}
