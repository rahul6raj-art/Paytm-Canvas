import type { EditorNode } from "@/stores/useEditorStore";
import { defaultCanvasForegroundColor } from "@/lib/canvasForeground";
import { normalizePathNode } from "@/lib/pathGeometry";
import { RESIZE_MIN_DIMENSION } from "@/lib/resize";
import {
  DEFAULT_LINE_STROKE_WIDTH,
  DEFAULT_SHAPE_FILL,
  editorNodeKindForShapeType,
  shapeTypeLabel,
  type ShapeType,
} from "./shapeModel";
import { generatePolygonPoints, generateStarPoints } from "./pathGenerators";
import { layoutFromLineEndpoints } from "./lineGeometry";
import { arrowEndpointStylePatch, DEFAULT_ARROW_END } from "./arrowGeometry";

export type Point = { x: number; y: number };

export type ShapeModifiers = {
  shiftKey: boolean;
  altKey: boolean;
};

/** Live drag grows from 0px; commit enforces editor minimum size. */
export type ShapeDragPhase = "live" | "commit";

const MIN = RESIZE_MIN_DIMENSION;
const SNAP_45_RAD = Math.PI / 4;

/** Snap the drag endpoint to 0°, 45°, 90°, … (Figma Shift while drawing lines). */
export function constrainLineEndpointTo45Degrees(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { ...end };
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / SNAP_45_RAD) * SNAP_45_RAD;
  return {
    x: start.x + Math.cos(snapped) * len,
    y: start.y + Math.sin(snapped) * len,
  };
}

/**
 * Resolve line endpoints from a drag gesture.
 * Shift snaps angle; Option/Alt uses the press point as the line center (Figma shape modifiers).
 */
export function resolveLineEndpoints(
  start: Point,
  end: Point,
  modifiers: ShapeModifiers,
): { start: Point; end: Point } {
  const endPt = modifiers.shiftKey ? constrainLineEndpointTo45Degrees(start, end) : end;
  if (modifiers.altKey) {
    const dx = endPt.x - start.x;
    const dy = endPt.y - start.y;
    return {
      start: { x: start.x - dx, y: start.y - dy },
      end: { x: start.x + dx, y: start.y + dy },
    };
  }
  return { start, end: endPt };
}

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

  // preserveAspect alone is for corner-anchored ellipse; skip when Alt draws from center.
  if (modifiers.shiftKey || (opts?.preserveAspect && !modifiers.altKey)) {
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

function minSizeForPhase(phase: ShapeDragPhase): number {
  return phase === "live" ? 0 : MIN;
}

/** Round bounds to whole world pixels for crisp rendering at 100% zoom. */
function roundBounds(
  b: { x: number; y: number; width: number; height: number },
  minSize = MIN,
): typeof b {
  return {
    x: Math.round(b.x),
    y: Math.round(b.y),
    width: Math.max(minSize, Math.round(b.width)),
    height: Math.max(minSize, Math.round(b.height)),
  };
}

/** Line/arrow: compute box + rotation from endpoint drag. */
export function lineGeometryFromDrag(
  start: Point,
  end: Point,
  modifiers: ShapeModifiers,
  minSize = MIN,
): { x: number; y: number; width: number; height: number; rotation: number } {
  const { start: s, end: e } = resolveLineEndpoints(start, end, modifiers);
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const length = Math.max(minSize, Math.hypot(dx, dy));
  const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  const height = 0;
  return {
    x: s.x,
    y: s.y,
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
  phase: ShapeDragPhase = "commit",
): EditorNode {
  const minSize = minSizeForPhase(phase);
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
    strokeColor: style?.strokeColor ?? defaultCanvasForegroundColor(),
    strokeWidth: style?.strokeWidth ?? 0,
    strokeStyle: "solid" as const,
    strokePosition: "center" as const,
    opacity: 1,
  };

  if (shapeType === "line" || shapeType === "arrow") {
    const { start: ls, end: le } = resolveLineEndpoints(startPoint, endPoint, modifiers);
    const sw = style?.strokeWidth ?? (shapeType === "line" ? DEFAULT_LINE_STROKE_WIDTH : 3);
    const layout = layoutFromLineEndpoints(ls.x, ls.y, le.x, le.y, sw, minSize);
    if (shapeType === "arrow") {
      return {
        ...base,
        type: "arrow",
        name: shapeTypeLabel("arrow"),
        ...layout,
        ...arrowEndpointStylePatch({
          startArrow: "none",
          endArrow: DEFAULT_ARROW_END,
        }),
        fillEnabled: false,
        fill: "transparent",
        fillOpacity: 0,
        strokeColor: style?.strokeColor ?? defaultCanvasForegroundColor(),
        strokeWidth: sw,
        strokeLinecap: "round",
      };
    }
    return {
      ...base,
      type: "line",
      name: shapeTypeLabel("line"),
      ...layout,
      fillEnabled: false,
      fill: "transparent",
      fillOpacity: 0,
      strokeColor: style?.strokeColor ?? defaultCanvasForegroundColor(),
      strokeWidth: sw,
      strokeLinecap: "round",
    };
  }

  const bounds = roundBounds(
    boundsFromDrag(startPoint, endPoint, modifiers, {
      preserveAspect: shapeType === "ellipse",
      minSize,
    }),
    minSize,
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

  if (shapeType === "polygon") {
    const kind = editorNodeKindForShapeType("polygon");
    return {
      ...base,
      type: kind,
      name: shapeTypeLabel("polygon"),
      ...bounds,
      polygonSides: sides,
      cornerRadius: style?.cornerRadius ?? 0,
      pathPoints: generatePolygonPoints(sides, bounds.width, bounds.height),
      pathClosed: true,
      strokeWidth: 0,
    };
  }

  const pts = generateStarPoints(style?.starPoints ?? 5, inner, bounds.width, bounds.height);
  let node: EditorNode = {
    ...base,
    type: "path",
    name: shapeTypeLabel("star"),
    ...bounds,
    pathPoints: pts,
    pathClosed: true,
    starPoints: style?.starPoints ?? 5,
    starInnerRadius: inner,
    cornerRadius: style?.cornerRadius ?? 0,
    strokeWidth: 0,
  };
  node = normalizePathNode(node);
  return node;
}

/** Geometry patch while live-dragging a new shape (excludes identity / chrome fields). */
export function shapeGeometryPatchFromDrag(
  shapeType: ShapeType,
  startPoint: Point,
  endPoint: Point,
  modifiers: ShapeModifiers,
  style?: Partial<Pick<EditorNode, "polygonSides" | "starPoints" | "starInnerRadius">>,
  phase: ShapeDragPhase = "commit",
): Partial<EditorNode> {
  const draft = createShapeNode(shapeType, startPoint, endPoint, modifiers, style, phase);
  const patch: Partial<EditorNode> = {
    x: draft.x,
    y: draft.y,
    width: draft.width,
    height: draft.height,
    rotation: draft.rotation ?? 0,
  };
  if (draft.lineX1 != null) {
    patch.lineX1 = draft.lineX1;
    patch.lineY1 = draft.lineY1;
    patch.lineX2 = draft.lineX2;
    patch.lineY2 = draft.lineY2;
  }
  if (draft.pathPoints) {
    patch.pathPoints = draft.pathPoints;
    patch.pathClosed = draft.pathClosed;
  }
  if (draft.startArrow != null) {
    patch.startArrow = draft.startArrow;
    patch.endArrow = draft.endArrow;
  }
  if (draft.polygonSides != null) {
    patch.polygonSides = draft.polygonSides;
  }
  if (draft.starPoints != null) {
    patch.starPoints = draft.starPoints;
    patch.starInnerRadius = draft.starInnerRadius;
  }
  return patch;
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
