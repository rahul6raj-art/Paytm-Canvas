export { type ShapeModel, type ShapeType, type StrokeStyle, editorNodeToShape, inferShapeType, shapeTypeLabel } from "./shapeModel";
export {
  createShapeNode,
  boundsFromDrag,
  lineGeometryFromDrag,
  toolToShapeType,
  type Point,
  type ShapeModifiers,
} from "./shapeCreation";
export { getShapeBounds, hitTestShape } from "./shapeBounds";
export { renderShape } from "./shapeRender";
export { resizeShape, rotateShape } from "./shapeTransform";
export { applyBooleanOperation, type BooleanOperation as BooleanOp } from "./shapeBoolean";
export { snapBoundsMovement } from "./shapeSnap";
export { generatePolygonPoints, generateStarPoints, generateArrowPoints } from "./pathGenerators";
