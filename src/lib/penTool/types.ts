/** Bézier anchor in a vector path (Figma-style). */
export type VectorPoint = {
  x: number;
  y: number;
  inHandle?: { x: number; y: number };
  outHandle?: { x: number; y: number };
  type: "corner" | "smooth";
  selected?: boolean;
};

/** Pen tool pointer interaction states. */
export type PenPointerState =
  | "idle"
  | "drawing"
  | "draggingNewHandle"
  | "draggingAnchor"
  | "draggingInHandle"
  | "draggingOutHandle";

export type PenPlacement = {
  anchor: { x: number; y: number };
  /** Handle endpoint (shift-snapped from anchor when Shift held). */
  drag: { x: number; y: number };
  /** Raw pointer in world space (for segment snap from previous anchor). */
  rawDrag?: { x: number; y: number };
  /** Raw pointer at pointerdown (before anchor shift snap). */
  pressRaw?: { x: number; y: number };
  shiftKey?: boolean;
};

export const PEN_CURVE_DRAG_THRESHOLD = 5;
export const PEN_CLOSE_HIT_RADIUS = 10;
