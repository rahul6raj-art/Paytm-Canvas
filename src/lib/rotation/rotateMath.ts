import { normalizeRotationDegrees } from "@/lib/transformMath";

/** Pointer angle from center in radians (atan2 convention). */
export function pointerAngleRad(
  pointerWorld: { x: number; y: number },
  centerWorld: { x: number; y: number },
): number {
  return Math.atan2(pointerWorld.y - centerWorld.y, pointerWorld.x - centerWorld.x);
}

/** Shortest signed delta in degrees between two pointer angles (handles atan2 branch cut). */
export function shortestAngleDeltaDegrees(fromRad: number, toRad: number): number {
  return (Math.atan2(Math.sin(toRad - fromRad), Math.cos(toRad - fromRad)) * 180) / Math.PI;
}

/** Delta in degrees between current pointer angle and drag-start angle (shortest path). */
export function rotationDeltaDegrees(
  pointerWorld: { x: number; y: number },
  centerWorld: { x: number; y: number },
  startAngleRad: number,
): number {
  const angle = pointerAngleRad(pointerWorld, centerWorld);
  return shortestAngleDeltaDegrees(startAngleRad, angle);
}

/** Snap absolute rotation to 15° when Shift is held. */
export function snapRotationDegrees(rotationDeg: number, shiftKey: boolean): number {
  let next = normalizeRotationDegrees(rotationDeg);
  if (shiftKey) next = normalizeRotationDegrees(Math.round(next / 15) * 15);
  return next;
}

/** Snap drag delta to 15° steps when Shift is held (multi-selection). */
export function snapRotationDeltaDegrees(deltaDeg: number, shiftKey: boolean): number {
  if (!shiftKey) return deltaDeg;
  return Math.round(deltaDeg / 15) * 15;
}

export function formatRotationLabel(degrees: number): string {
  return `${Math.round(normalizeRotationDegrees(degrees))}°`;
}
