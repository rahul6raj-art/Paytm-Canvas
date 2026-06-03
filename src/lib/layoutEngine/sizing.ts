/**
 * Fill distribution along the main axis when children use fill sizing.
 */

/** Split remaining main-axis space evenly among fill children. */
export function resolveFillSize(
  availableMain: number,
  fixedMainTotal: number,
  gapTotal: number,
  fillCount: number,
): number {
  if (fillCount <= 0) return 0;
  const extra = Math.max(0, availableMain - fixedMainTotal - gapTotal);
  return Math.max(1, extra / fillCount);
}
