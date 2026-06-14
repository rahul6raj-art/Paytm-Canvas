import type { EditorNode } from "@/stores/useEditorStore";
import { DEFAULT_FRAME_FILL } from "@/lib/shapes/shapeModel";
import { RESIZE_MIN_DIMENSION } from "@/lib/resize";
import {
  boundsFromDrag,
  type Point,
  type ShapeDragPhase,
  type ShapeModifiers,
} from "@/lib/shapes/shapeCreation";

const MIN = RESIZE_MIN_DIMENSION;

function minSizeForPhase(phase: ShapeDragPhase): number {
  return phase === "live" ? 0 : MIN;
}

function roundBounds(
  b: { x: number; y: number; width: number; height: number },
  minSize: number,
): typeof b {
  return {
    x: Math.round(b.x),
    y: Math.round(b.y),
    width: Math.max(minSize, Math.round(b.width)),
    height: Math.max(minSize, Math.round(b.height)),
  };
}

/** Geometry patch while live-dragging a new frame. */
export function frameGeometryPatchFromDrag(
  start: Point,
  end: Point,
  modifiers: ShapeModifiers,
  phase: ShapeDragPhase = "commit",
): Pick<EditorNode, "x" | "y" | "width" | "height"> {
  const minSize = minSizeForPhase(phase);
  return roundBounds(
    boundsFromDrag(start, end, modifiers, { minSize }),
    minSize,
  );
}

/** Draft frame node from drag endpoints (caller assigns id / inserts). */
export function createFrameNodeFromDrag(
  start: Point,
  end: Point,
  modifiers: ShapeModifiers,
  name: string,
  phase: ShapeDragPhase = "commit",
): Omit<EditorNode, "id" | "parentId"> {
  const bounds = frameGeometryPatchFromDrag(start, end, modifiers, phase);
  return {
    type: "frame",
    name,
    ...bounds,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: DEFAULT_FRAME_FILL,
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center",
  };
}
