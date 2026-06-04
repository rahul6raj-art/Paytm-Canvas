import { getNodeCornerRadii, roundedRectPathD, roundedRectPolygonPoints } from "@/lib/cornerRadius";
import type { EditorNode } from "@/stores/useEditorStore";
import { ROOT } from "@/stores/useEditorStore";
import { getRenderedWorldTopLeft, topLevelSelectedIds } from "@/lib/editorGraph";
import { pathToSvgD, svgPathDToPathPoints } from "@/lib/pathGeometry";
import { generatePolygonPoints } from "@/lib/shapes/pathGenerators";
import { isPolygonNode, polygonVertices } from "@/lib/shapes/polygonGeometry";
import {
  applyMatrixToPoint,
  getNodeTransformedWorldBounds,
  getNodeWorldMatrix,
} from "@/lib/transformMath";
import { DEFAULT_SHAPE_FILL, editorNodeToShape } from "@/lib/shapes/shapeModel";
import { worldRect } from "@/lib/tree";

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

export function isMaskGroup(node: EditorNode | undefined): boolean {
  return Boolean(node?.type === "group" && node.maskId);
}

export function isBooleanGroup(node: EditorNode | undefined): boolean {
  return Boolean(node?.type === "group" && node.isBooleanGroup && !node.maskId);
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

function intersectBoundsAabb(a: WorldBounds, b: WorldBounds): WorldBounds | null {
  const minX = Math.max(a.x, b.x);
  const minY = Math.max(a.y, b.y);
  const maxX = Math.min(a.x + a.width, b.x + b.width);
  const maxY = Math.min(a.y + a.height, b.y + b.height);
  if (maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * World bounds of the visible boolean result (not the union of all operand bounding boxes).
 */
export function boundsForBooleanChildren(
  operation: BooleanOperation,
  childIds: string[],
  nodes: Record<string, EditorNode>,
): WorldBounds {
  const inputs = shapesToBooleanInput(childIds, nodes);
  if (inputs.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  if (inputs.length === 1) {
    return boundsOfPolygonPoints(inputs[0]!.polygon) ?? boundsOfPolygons(inputs);
  }

  switch (operation) {
    case "subtract": {
      const topId = childIds[childIds.length - 1]!;
      const base = inputs.filter((i) => i.id !== topId);
      return boundsOfPolygons(base.length > 0 ? base : inputs);
    }
    case "intersect": {
      const boxes = inputs
        .map((i) => boundsOfPolygonPoints(i.polygon))
        .filter((b): b is WorldBounds => b != null);
      if (boxes.length === 0) return boundsOfPolygons(inputs);
      let acc = boxes[0]!;
      for (let i = 1; i < boxes.length; i++) {
        const next = intersectBoundsAabb(acc, boxes[i]!);
        if (!next) return boundsOfPolygons(inputs);
        acc = next;
      }
      return acc;
    }
    case "union":
    case "exclude":
    default:
      return boundsOfPolygons(inputs);
  }
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
  const childIds = (childOrder[groupId] ?? []).filter((cid) => {
    const c = nodes[cid];
    return c && c.visible && !c.locked;
  });
  if (childIds.length === 0) {
    const wb = getNodeTransformedWorldBounds(groupId, nodes);
    return { x: wb.x, y: wb.y, width: Math.max(1, wb.width), height: Math.max(1, wb.height) };
  }
  return boundsForBooleanChildren(g.booleanOperation ?? "union", childIds, nodes);
}

/** Mask groups use visible-region AABB for selection, not a single child transform. */
export function maskGroupFrameNodeId(_node: EditorNode | undefined): string | null {
  return null;
}

/** Paint-order for hit tests: masked content above mask shape (Figma). */
export function maskGroupChildHitOrder(
  parent: Pick<EditorNode, "type" | "maskId">,
  childIds: string[],
): string[] {
  if (parent.type !== "group" || !parent.maskId) return childIds;
  const maskId = parent.maskId;
  const content = childIds.filter((id) => id !== maskId);
  return [...content, maskId];
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
    const pts = generatePolygonPoints(64, w, h);
    if (!pts.length) return "";
    let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i]!.x} ${pts[i]!.y}`;
    return `${d} Z`;
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
  opts?: { ellipseSegments?: number },
): { x: number; y: number }[] {
  const node = nodes[nodeId];
  if (!node) return [];
  const segs = opts?.ellipseSegments ?? 64;
  const m = getNodeWorldMatrix(nodeId, nodes);
  if (!m) return [];
  const localPts = (() => {
    const w = Math.max(1, node.width);
    const h = Math.max(1, node.height);
    if (isPolygonNode(node)) {
      const sides = node.polygonSides ?? 6;
      return polygonVertices(sides, w, h);
    }
    if (node.type === "path") {
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
      return generatePolygonPoints(segs, w, h).map((p) => ({ x: p.x, y: p.y }));
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
): BooleanInput[] {
  return ids
    .map((id) => {
      const node = nodes[id];
      if (!node || !isBooleanEligibleNode(node)) return null;
      const polygon = shapeNodeToWorldPolygon(id, nodes);
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

/** Operand order for evenodd subtract: all bases first, topmost (subtracted) shape last. */
export function orderedBooleanChildIds(
  childIds: string[],
  operation: BooleanOperation,
): string[] {
  if (operation !== "subtract" || childIds.length < 2) return childIds;
  const topId = childIds[childIds.length - 1]!;
  const rest = childIds.filter((id) => id !== topId);
  return [...rest, topId];
}

/** World-space polygons → single SVG path `d` in group-local coordinates. */
export function buildCompositePathDForGroup(
  groupId: string,
  childIds: string[],
  nodes: Record<string, EditorNode>,
  operation: BooleanOperation,
  childOrder?: Record<string, string[]>,
): { d: string; fillRule: "nonzero" | "evenodd"; fill: string } | null {
  const origin = childOrder
    ? getRenderedWorldTopLeft(groupId, nodes, childOrder)
    : (() => {
        const w = worldRect(groupId, nodes);
        return { x: w.x, y: w.y };
      })();
  const originX = origin.x;
  const originY = origin.y;
  const parts: string[] = [];
  let fill = DEFAULT_SHAPE_FILL;

  const ordered = orderedBooleanChildIds(childIds, operation);
  for (const cid of ordered) {
    const node = nodes[cid];
    if (!node) continue;
    const poly = shapeNodeToWorldPolygon(cid, nodes);
    if (poly.length < 3) continue;
    parts.push(polygonToPathD(poly, originX, originY));
    if (parts.length === 1 && node.fillEnabled !== false) {
      fill = node.fill ?? fill;
    }
  }

  if (parts.length === 0) return null;
  if (parts.length < 2 && operation !== "union") return null;

  const fillRule: "nonzero" | "evenodd" =
    operation === "subtract" || operation === "exclude" ? "evenodd" : "nonzero";

  return { d: parts.join(" "), fillRule, fill };
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
  | { op: "exclude"; pathDs: string[]; fill: string };

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
    const poly = shapeNodeToWorldPolygon(cid, nodes);
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
 * Canvas/export boolean preview — mask/clip stacking per op (not combined evenodd paths).
 */
export function buildBooleanRenderForGroup(
  groupId: string,
  childIds: string[],
  nodes: Record<string, EditorNode>,
  operation: BooleanOperation,
  childOrder?: Record<string, string[]>,
): BooleanRenderModel | null {
  if (operation === "subtract") {
    const sub = buildSubtractCompositeForGroup(groupId, childIds, nodes, childOrder);
    if (!sub) return null;
    return { op: "subtract", baseD: sub.baseD, subtractD: sub.subtractD, fill: sub.fill };
  }

  const collected = collectOperandPathDs(groupId, childIds, nodes, childOrder);
  if (!collected) return null;

  const { pathDs, fill } = collected;

  switch (operation) {
    case "union":
      return pathDs.length >= 1 ? { op: "union", pathDs, fill } : null;
    case "intersect":
      return pathDs.length >= 2 ? { op: "intersect", pathDs, fill } : null;
    case "exclude":
      return pathDs.length >= 2 ? { op: "exclude", pathDs, fill } : null;
    default:
      return null;
  }
}

/** Mask clip path in group-local coordinates. */
export function buildMaskClipPathDForGroup(
  groupId: string,
  maskChildId: string,
  nodes: Record<string, EditorNode>,
  childOrder?: Record<string, string[]>,
): string | null {
  const origin = childOrder
    ? getRenderedWorldTopLeft(groupId, nodes, childOrder)
    : (() => {
        const w = worldRect(groupId, nodes);
        return { x: w.x, y: w.y };
      })();
  const poly = shapeNodeToWorldPolygon(maskChildId, nodes);
  if (poly.length < 3) {
    const mask = nodes[maskChildId];
    if (!mask) return null;
    const wb = getNodeTransformedWorldBounds(maskChildId, nodes);
    const fallback = [
      { x: wb.x, y: wb.y },
      { x: wb.x + wb.width, y: wb.y },
      { x: wb.x + wb.width, y: wb.y + wb.height },
      { x: wb.x, y: wb.y + wb.height },
    ];
    return polygonToPathD(fallback, origin.x, origin.y);
  }
  return polygonToPathD(poly, origin.x, origin.y);
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
 * v1 boolean pipeline — builds SVG path data for flatten/export.
 * Replace internals with a real clipper engine later; API stays stable.
 */
export function applyBooleanOperation(
  operation: BooleanOperation,
  inputs: BooleanInput[],
): BooleanResult | null {
  if (inputs.length < 2) return null;
  const bounds = boundsOfPolygons(inputs);
  const fill = inputs[0]!.fill;

  if (operation === "union") {
    const parts = inputs.map((inp) => polygonToPathD(inp.polygon, bounds.x, bounds.y));
    return {
      pathD: parts.join(" "),
      ...bounds,
      fill,
      fillRule: "nonzero",
    };
  }

  if (operation === "exclude") {
    const parts = inputs.map((inp) => polygonToPathD(inp.polygon, bounds.x, bounds.y));
    return {
      pathD: parts.join(" "),
      ...bounds,
      fill,
      fillRule: "evenodd",
    };
  }

  if (operation === "intersect") {
    const parts = inputs.map((inp) => polygonToPathD(inp.polygon, bounds.x, bounds.y));
    return {
      pathD: parts.join(" "),
      ...bounds,
      fill,
      fillRule: "nonzero",
    };
  }

  if (operation === "subtract") {
    const base = inputs.slice(0, -1);
    const sub = inputs[inputs.length - 1]!;
    const baseParts = base.map((inp) => polygonToPathD(inp.polygon, bounds.x, bounds.y));
    const subPart = polygonToPathD(sub.polygon, bounds.x, bounds.y);
    return {
      pathD: `${baseParts.join(" ")} ${subPart}`,
      ...bounds,
      fill,
      fillRule: "evenodd",
    };
  }

  return null;
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
): BooleanResult | null {
  const op = group.booleanOperation ?? "union";
  const inputs = shapesToBooleanInput(childIds, nodes);
  if (inputs.length < 2) return null;

  if (op === "subtract" && inputs.length >= 2) {
    const topId = childIds[childIds.length - 1]!;
    const rest = childIds.filter((id) => id !== topId);
    const reordered = [...rest.map((id) => inputs.find((i) => i.id === id)!), inputs.find((i) => i.id === topId)!];
    return applyBooleanOperation("subtract", reordered.filter(Boolean));
  }

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
