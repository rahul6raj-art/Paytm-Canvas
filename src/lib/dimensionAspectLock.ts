/** Minimum box dimension when applying aspect-locked inspector edits. */
export const ASPECT_LOCK_MIN_DIMENSION = 1;

export type DimensionPair = { width: number; height: number };

/**
 * When aspect ratio is locked, changing one dimension scales the other to preserve W/H.
 * When unlocked, only the edited axis changes.
 */
export function applyAspectLockedDimensions(
  current: DimensionPair,
  changed: "width" | "height",
  newValue: number,
  locked: boolean,
  min = ASPECT_LOCK_MIN_DIMENSION,
): DimensionPair {
  const safeW = Math.max(min, current.width);
  const safeH = Math.max(min, current.height);

  if (!locked || safeW <= 0 || safeH <= 0) {
    if (changed === "width") return { width: Math.max(min, newValue), height: safeH };
    return { width: safeW, height: Math.max(min, newValue) };
  }

  const ratio = safeW / safeH;
  if (changed === "width") {
    const width = Math.max(min, newValue);
    return { width, height: Math.max(min, width / ratio) };
  }
  const height = Math.max(min, newValue);
  return { width: Math.max(min, height * ratio), height };
}
