import type { EditorNode } from "@/stores/useEditorStore";
import type { PathPoint } from "@/lib/pathGeometry";

/** Logical shape kinds (maps to EditorNode types internally). */
export type ShapeType = "rectangle" | "ellipse" | "line" | "arrow" | "polygon" | "star";

export type StrokeStyle = "solid" | "dashed" | "dotted";

/** Unified shape view used by helpers (maps store nodes ↔ shape model). */
export type ShapeModel = {
  id: string;
  type: "shape";
  shapeType: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity: number;
  cornerRadius?: number;
  points?: number;
  innerRadius?: number;
  pathPoints?: PathPoint[];
  pathClosed?: boolean;
  locked: boolean;
  visible: boolean;
};

/** Default fill for shapes (rect, ellipse, path, etc.) — not device frames. */
export const DEFAULT_SHAPE_FILL = "#cfcfcf";
/** Default fill for frame / device screen nodes. */
export const DEFAULT_FRAME_FILL = "#ffffff";
export const DEFAULT_SHAPE_STROKE = "#ffffff";
/** Filled shapes start with no stroke; lines/arrows set width explicitly at creation. */
export const DEFAULT_STROKE_WIDTH = 0;

export function inferShapeType(node: EditorNode): ShapeType | null {
  if (node.type === "rectangle") return "rectangle";
  if (node.type === "ellipse") return "ellipse";
  if (node.type === "arrow") return "arrow";
  if (node.type === "line") {
    return node.arrowHead ? "arrow" : "line";
  }
  if (node.type === "polygon") return "polygon";
  if (node.type === "path") {
    if (node.starPoints != null) return "star";
    if (node.polygonSides != null) return "polygon";
    return null;
  }
  return null;
}

/** Convert an editor node into the unified shape model (null if not a shape). */
export function editorNodeToShape(node: EditorNode): ShapeModel | null {
  const shapeType = inferShapeType(node);
  if (!shapeType) return null;
  return {
    id: node.id,
    type: "shape",
    shapeType,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation ?? 0,
    fill: node.fillEnabled === false ? "transparent" : (node.fill ?? DEFAULT_SHAPE_FILL),
    stroke: node.strokeColor ?? DEFAULT_SHAPE_STROKE,
    strokeWidth: node.strokeWidth ?? 0,
    strokeStyle: node.strokeStyle ?? "solid",
    opacity: node.opacity ?? 1,
    cornerRadius: node.cornerRadius,
    points: node.polygonSides ?? node.starPoints,
    innerRadius: node.starInnerRadius,
    pathPoints: node.pathPoints,
    pathClosed: node.pathClosed,
    locked: node.locked,
    visible: node.visible,
  };
}

export function shapeTypeLabel(shapeType: ShapeType): string {
  switch (shapeType) {
    case "rectangle":
      return "Rectangle";
    case "ellipse":
      return "Ellipse";
    case "line":
      return "Line";
    case "arrow":
      return "Arrow";
    case "polygon":
      return "Polygon";
    case "star":
      return "Star";
  }
}

export function editorNodeKindForShapeType(shapeType: ShapeType): EditorNode["type"] {
  if (shapeType === "rectangle") return "rectangle";
  if (shapeType === "ellipse") return "ellipse";
  if (shapeType === "line") return "line";
  if (shapeType === "arrow") return "arrow";
  if (shapeType === "polygon") return "polygon";
  if (shapeType === "star") return "path";
  return "path";
}
