import type { EditorNode } from "@/stores/useEditorStore";
import { normalizePathNode } from "@/lib/pathGeometry";
import { RESIZE_MIN_DIMENSION } from "@/lib/resize";
import {
  DEFAULT_SHAPE_FILL,
  DEFAULT_SHAPE_STROKE,
  editorNodeKindForShapeType,
  shapeTypeLabel,
  type ShapeType,
} from "./shapeModel";
import { generateArrowPoints, generatePolygonPoints, generateStarPoints } from "./pathGenerators";

export type Point = { x: number; y: number };

export type ShapeModifiers = {
  shiftKey: boolean;
  altKey: boolean;
};

const MIN = RESIZE_MIN_DIMENSION;

/**
 * Compute axis-aligned bounds from a drag gesture.
 * Shift preserves aspect ratio; Alt draws from center (start = center).
 */
export function boundsFromDrag(
  start: Point,
  end: Point,
  modifiers: ShapeModifiers,
  opts?: { preserveAspect?: boolean; minSize?: number },
): { x: number; y: number; width: number; height: number } {
  const minSize = opts?.minSize ?? MIN;
  let x0 = start.x;
  let y0 = start.y;
  let x1 = end.x;
  let y1 = end.y;

  if (modifiers.shiftKey || opts?.preserveAspect) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const size = Math.max(Math.abs(dx), Math.abs(dy), minSize);
    x1 = x0 + Math.sign(dx || 1) * size;
    y1 = y0 + Math.sign(dy || 1) * size;
  }

  if (modifiers.altKey) {
    const cx = start.x;
    const cy = start.y;
    const hw = Math.max(minSize / 2, Math.abs(x1 - cx));
    const hh = Math.max(minSize / 2, Math.abs(y1 - cy));
    if (modifiers.shiftKey || opts?.preserveAspect) {
      const half = Math.max(hw, hh);
      return {
        x: cx - half,
        y: cy - half,
        width: half * 2,
        height: half * 2,
      };
    }
    return {
      x: cx - hw,
      y: cy - hh,
      width: hw * 2,
      height: hh * 2,
    };
  }

  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  let width = Math.max(minSize, Math.abs(x1 - x0));
  let height = Math.max(minSize, Math.abs(y1 - y0));

  if (modifiers.shiftKey || opts?.preserveAspect) {
    const size = Math.max(width, height);
    width = size;
    height = size;
    if (x1 < x0) return { x: x0 - size, y: y1 < y0 ? y0 - size : y, width, height };
    if (y1 < y0) return { x, y: y0 - size, width, height };
  }

  return { x, y, width, height };
}

/** Round bounds to whole world pixels for crisp rendering at 100% zoom. */
function roundBounds(b: { x: number; y: number; width: number; height: number }): typeof b {
  return {
    x: Math.round(b.x),
    y: Math.round(b.y),
    width: Math.max(MIN, Math.round(b.width)),
    height: Math.max(MIN, Math.round(b.height)),
  };
}

/** Line/arrow: compute box + rotation from endpoint drag. */
export function lineGeometryFromDrag(
  start: Point,
  end: Point,
  modifiers: ShapeModifiers,
): { x: number; y: number; width: number; height: number; rotation: number } {
  let ex = end.x;
  let ey = end.y;
  if (modifiers.shiftKey) {
    const dx = ex - start.x;
    const dy = ey - start.y;
    if (Math.abs(dx) > Math.abs(dy)) ey = start.y;
    else ex = start.x;
  }

  const dx = ex - start.x;
  const dy = ey - start.y;
  const length = Math.max(MIN, Math.hypot(dx, dy));
  const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  const height = 8;
  return {
    x: start.x,
    y: start.y - height / 2,
    width: length,
    height,
    rotation,
  };
}

/**
 * Build a shape editor node from drag endpoints (world space).
 * Does not assign id/parent — caller inserts into the document.
 */
export function createShapeNode(
  shapeType: ShapeType,
  startPoint: Point,
  endPoint: Point,
  modifiers: ShapeModifiers,
  style?: Partial<Pick<EditorNode, "fill" | "strokeColor" | "strokeWidth" | "cornerRadius" | "polygonSides" | "starPoints" | "starInnerRadius">>,
): EditorNode {
  const base = {
    id: "",
    parentId: null as string | null,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: style?.fill ?? DEFAULT_SHAPE_FILL,
    fillEnabled: true,
    fillOpacity: 1,
    strokeColor: style?.strokeColor ?? DEFAULT_SHAPE_STROKE,
    strokeWidth: style?.strokeWidth ?? 0,
    strokeStyle: "solid" as const,
    strokePosition: "center" as const,
    opacity: 1,
  };

  if (shapeType === "line" || shapeType === "arrow") {
    const raw = lineGeometryFromDrag(startPoint, endPoint, modifiers);
    const geom = { ...roundBounds(raw), rotation: raw.rotation };
    if (shapeType === "arrow") {
      const pts = generateArrowPoints(geom.width, geom.height);
      let node: EditorNode = {
        ...base,
        type: "path",
        name: shapeTypeLabel("arrow"),
        x: geom.x,
        y: geom.y,
        width: geom.width,
        height: geom.height,
        rotation: geom.rotation,
        pathPoints: pts,
        pathClosed: false,
        fillEnabled: false,
        fill: "transparent",
        strokeWidth: style?.strokeWidth ?? 3,
      };
      node = normalizePathNode(node);
      return node;
    }
    return {
      ...base,
      type: "line",
      name: shapeTypeLabel("line"),
      x: geom.x,
      y: geom.y,
      width: geom.width,
      height: geom.height,
      rotation: geom.rotation,
      fillEnabled: false,
      fill: "transparent",
      fillOpacity: 0,
      strokeColor: style?.strokeColor ?? DEFAULT_SHAPE_FILL,
      strokeWidth: style?.strokeWidth ?? 3,
    };
  }

  const bounds = roundBounds(
    boundsFromDrag(startPoint, endPoint, modifiers, {
      preserveAspect: shapeType === "ellipse",
    }),
  );

  if (shapeType === "rectangle") {
    return {
      ...base,
      type: "rectangle",
      name: shapeTypeLabel("rectangle"),
      ...bounds,
      cornerRadius: style?.cornerRadius ?? 0,
    };
  }

  if (shapeType === "ellipse") {
    return {
      ...base,
      type: "ellipse",
      name: shapeTypeLabel("ellipse"),
      ...bounds,
      cornerRadius: 0,
    };
  }

  const sides = style?.polygonSides ?? 6;
  const inner = style?.starInnerRadius ?? 0.4;
  const pts =
    shapeType === "star"
      ? generateStarPoints(style?.starPoints ?? 5, inner, bounds.width, bounds.height)
      : generatePolygonPoints(sides, bounds.width, bounds.height);

  let node: EditorNode = {
    ...base,
    type: "path",
    name: shapeTypeLabel(shapeType),
    ...bounds,
    pathPoints: pts,
    pathClosed: true,
    polygonSides: shapeType === "polygon" ? sides : undefined,
    starPoints: shapeType === "star" ? (style?.starPoints ?? 5) : undefined,
    starInnerRadius: shapeType === "star" ? inner : undefined,
    strokeWidth: shapeType === "polygon" || shapeType === "star" ? 0 : base.strokeWidth,
  };
  node = normalizePathNode(node);
  return node;
}

/** Map active canvas tool id to shape type (null if not a shape tool). */
export function toolToShapeType(tool: string): ShapeType | null {
  switch (tool) {
    case "rect":
      return "rectangle";
    case "ellipse":
      return "ellipse";
    case "line":
      return "line";
    case "arrow":
      return "arrow";
    case "polygon":
      return "polygon";
    case "star":
      return "star";
    case "triangle":
      return "polygon";
    default:
      return null;
  }
}
