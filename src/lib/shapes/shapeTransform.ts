import type { EditorNode } from "@/stores/useEditorStore";
import { computeResizedBounds, type Bounds, type ResizeHandle, type ResizeModifiers } from "@/lib/resize";
import { normalizeRotationDegrees } from "@/lib/transformMath";
import { generatePolygonPoints, generateStarPoints } from "./pathGenerators";

export function resizeShape(
  shapeNode: EditorNode,
  handle: ResizeHandle,
  startBounds: Bounds,
  pointerLocal: { x: number; y: number },
  modifiers: ResizeModifiers,
): Partial<EditorNode> {
  const kind =
    shapeNode.type === "rectangle" ||
    shapeNode.type === "ellipse" ||
    shapeNode.type === "line" ||
    shapeNode.type === "path"
      ? shapeNode.type
      : "rectangle";

  const next = computeResizedBounds(handle, startBounds, pointerLocal, modifiers, kind);
  const patch: Partial<EditorNode> = { x: next.x, y: next.y, width: next.width, height: next.height };

  if (shapeNode.type === "path" && shapeNode.polygonSides) {
    patch.pathPoints = generatePolygonPoints(shapeNode.polygonSides, next.width, next.height);
  }
  if (shapeNode.type === "path" && shapeNode.starPoints) {
    patch.pathPoints = generateStarPoints(
      shapeNode.starPoints,
      shapeNode.starInnerRadius ?? 0.4,
      next.width,
      next.height,
    );
  }
  return patch;
}

export function rotateShape(
  shapeNode: EditorNode,
  pointerWorld: { x: number; y: number },
  modifiers: { shiftKey: boolean },
  centerWorld: { x: number; y: number },
  startRotation: number,
  startAngle: number,
): number {
  const angle = Math.atan2(pointerWorld.y - centerWorld.y, pointerWorld.x - centerWorld.x);
  const deltaDeg = ((angle - startAngle) * 180) / Math.PI;
  let next = normalizeRotationDegrees(startRotation + deltaDeg);
  if (modifiers.shiftKey) next = normalizeRotationDegrees(Math.round(next / 15) * 15);
  return next;
}
