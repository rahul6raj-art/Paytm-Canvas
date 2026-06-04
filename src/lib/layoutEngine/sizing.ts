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

export type FillGrowEntry = { id: string; grow: number };

/**
 * Distribute fill main-axis space by layoutGrow weights.
 * When total grow is 0, falls back to even split.
 */
export function resolveFillSizesByGrow(
  availableMain: number,
  fixedMainTotal: number,
  gapTotal: number,
  entries: FillGrowEntry[],
): Record<string, number> {
  if (entries.length === 0) return {};
  const extra = Math.max(0, availableMain - fixedMainTotal - gapTotal);
  const totalGrow = entries.reduce((s, e) => s + Math.max(0, e.grow ?? 0), 0);
  if (totalGrow <= 0) {
    const each = Math.max(1, extra / entries.length);
    return Object.fromEntries(entries.map((e) => [e.id, each]));
  }
  const out: Record<string, number> = {};
  for (const e of entries) {
    const w = Math.max(0, e.grow ?? 0);
    out[e.id] = Math.max(1, (extra * w) / totalGrow);
  }
  return out;
}
