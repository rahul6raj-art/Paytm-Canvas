import type { EditorNode } from "@/stores/useEditorStore";
import { computeResizedBounds, type Bounds, type ResizeHandle, type ResizeModifiers } from "@/lib/resize";
import { rotationDeltaDegrees, snapRotationDegrees } from "@/lib/rotation/rotateMath";
import { isPolygonNode, polygonGeometryPatch } from "./polygonGeometry";
import { starGeometryPatch } from "./starGeometry";

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
    shapeNode.type === "arrow" ||
    shapeNode.type === "path"
      ? shapeNode.type
      : "rectangle";

  const next = computeResizedBounds(handle, startBounds, pointerLocal, modifiers, kind);
  const patch: Partial<EditorNode> = { x: next.x, y: next.y, width: next.width, height: next.height };

  if (isPolygonNode(shapeNode)) {
    Object.assign(
      patch,
      polygonGeometryPatch(
        { ...shapeNode, width: next.width, height: next.height },
        { polygonSides: shapeNode.polygonSides, cornerRadius: shapeNode.cornerRadius },
      ),
    );
  }
  if (shapeNode.type === "path" && shapeNode.starPoints) {
    Object.assign(
      patch,
      starGeometryPatch(
        { ...shapeNode, width: next.width, height: next.height },
        {
          starPoints: shapeNode.starPoints,
          starInnerRadius: shapeNode.starInnerRadius,
          cornerRadius: shapeNode.cornerRadius,
        },
      ),
    );
  }
  return patch;
}

export function rotateShape(
  _shapeNode: EditorNode,
  pointerWorld: { x: number; y: number },
  modifiers: { shiftKey: boolean },
  centerWorld: { x: number; y: number },
  startRotation: number,
  startAngle: number,
): number {
  const deltaDeg = rotationDeltaDegrees(pointerWorld, centerWorld, startAngle);
  return snapRotationDegrees(startRotation + deltaDeg, modifiers.shiftKey);
}
