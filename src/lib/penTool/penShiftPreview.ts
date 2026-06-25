import { resolvePenDragPreview, resolvePenHoverPreview } from "./placement";

/** Recompute pen hover preview when Shift toggles without a pointer move. */
export function refreshPenHoverPreview(
  rawWorld: { x: number; y: number } | null,
  previousAnchor: { x: number; y: number } | null,
  shiftKey: boolean,
): { x: number; y: number } | null {
  if (!rawWorld) return null;
  return resolvePenHoverPreview(rawWorld, previousAnchor, shiftKey);
}

/** Recompute in-progress handle drag when Shift toggles without a pointer move. */
export function refreshPenPlacementDrag(
  anchor: { x: number; y: number },
  rawDrag: { x: number; y: number },
  shiftKey: boolean,
): { x: number; y: number } {
  return resolvePenDragPreview(anchor, rawDrag, shiftKey);
}

export function isPenShiftKeyEvent(ev: KeyboardEvent): boolean {
  return ev.key === "Shift";
}
