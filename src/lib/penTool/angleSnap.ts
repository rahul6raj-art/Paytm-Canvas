const DEG = Math.PI / 180;

/** Snap `to` onto a ray from `from` at the nearest multiple of `snapDegrees`. */
export function snapPointToAngle(
  from: { x: number; y: number },
  to: { x: number; y: number },
  snapDegrees = 45,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return { ...to };
  const angle = Math.atan2(dy, dx);
  const snapRad = snapDegrees * DEG;
  const snapped = Math.round(angle / snapRad) * snapRad;
  return {
    x: from.x + Math.cos(snapped) * dist,
    y: from.y + Math.sin(snapped) * dist,
  };
}

/** Constrain a vector (dx, dy) to the nearest snap angle. */
export function snapVectorToAngle(
  dx: number,
  dy: number,
  snapDegrees = 45,
): { x: number; y: number } {
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return { x: 0, y: 0 };
  const angle = Math.atan2(dy, dx);
  const snapRad = snapDegrees * DEG;
  const snapped = Math.round(angle / snapRad) * snapRad;
  return { x: Math.cos(snapped) * dist, y: Math.sin(snapped) * dist };
}
