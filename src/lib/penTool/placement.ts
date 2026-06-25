import { snapPointToAngle } from "./angleSnap";
import {
  penCloseHitRadiusWorld,
  penCurveDragThresholdWorld,
} from "./coordinates";
import type { PenPlacement } from "./types";

/** Minimum screen pixels of drag before creating a smooth point (avoids jitter). */
export { PEN_CURVE_DRAG_THRESHOLD as PEN_CURVE_DRAG_THRESHOLD_SCREEN } from "./types";

/** Pointer movement from press to release — not handle length from snapped anchor. */
export function placementDragDistance(placement: PenPlacement): number {
  const raw = placement.rawDrag ?? placement.drag;
  const press = placement.pressRaw ?? placement.anchor;
  return Math.hypot(raw.x - press.x, raw.y - press.y);
}

export function isCurveDrag(distanceWorld: number, zoom: number): boolean {
  return distanceWorld >= penCurveDragThresholdWorld(zoom);
}

export function shouldShowCurvePlacement(placement: PenPlacement, zoom: number): boolean {
  return isCurveDrag(placementDragDistance(placement), zoom);
}

export function canClosePathAt(
  worldPoint: { x: number; y: number },
  firstWorld: { x: number; y: number },
  pointCount: number,
  zoom: number,
): boolean {
  // Need at least two segments before close (Figma-style); avoids closing when placing the 3rd anchor.
  if (pointCount < 3) return false;
  const radius = penCloseHitRadiusWorld(zoom);
  return Math.hypot(worldPoint.x - firstWorld.x, worldPoint.y - firstWorld.y) <= radius;
}

/** Snap live hover / preview target from the previous committed anchor. */
export function resolvePenHoverPreview(
  rawWorld: { x: number; y: number },
  previousAnchor: { x: number; y: number } | null,
  shiftKey: boolean,
): { x: number; y: number } {
  if (!shiftKey || !previousAnchor) return { ...rawWorld };
  return snapPointToAngle(previousAnchor, rawWorld);
}

/** @alias — segment preview from pointer + shift (evaluated on every move/key change). */
export function resolvePenSegmentPreview(
  rawWorld: { x: number; y: number },
  previousAnchor: { x: number; y: number } | null,
  shiftKey: boolean,
): { x: number; y: number } {
  return resolvePenHoverPreview(rawWorld, previousAnchor, shiftKey);
}

/** Snap click-drag handle direction from the fixed click anchor (angle snap, preserve distance). */
export function resolvePenDragPreview(
  anchor: { x: number; y: number },
  rawDrag: { x: number; y: number },
  shiftKey: boolean,
): { x: number; y: number } {
  if (!shiftKey) return { ...rawDrag };
  return snapPointToAngle(anchor, rawDrag);
}

/** Resolve click anchor: close-path takes priority over shift snap. */
export function resolvePenClickAnchor(
  rawWorld: { x: number; y: number },
  previousAnchor: { x: number; y: number } | null,
  firstWorld: { x: number; y: number } | null,
  pointCount: number,
  shiftKey: boolean,
  zoom: number,
): { anchor: { x: number; y: number }; closePath: boolean } {
  if (firstWorld && canClosePathAt(rawWorld, firstWorld, pointCount, zoom)) {
    return { anchor: { ...rawWorld }, closePath: true };
  }
  return {
    anchor: resolvePenHoverPreview(rawWorld, previousAnchor, shiftKey),
    closePath: false,
  };
}

/** @deprecated alias */
export function constrainPenHoverPoint(
  hover: { x: number; y: number },
  previousAnchor: { x: number; y: number } | null,
  shiftKey: boolean,
): { x: number; y: number } {
  return resolvePenHoverPreview(hover, previousAnchor, shiftKey);
}

export { penCloseHitRadiusWorld, penCurveDragThresholdWorld };
