/** Bumps when WASM fonts sync so SVG scene rebuilds with fresh canonical layout. */
let epoch = 0;
const listeners = new Set<() => void>();

export function getTextLayoutEpoch(): number {
  return epoch;
}

export function bumpTextLayoutEpoch(): void {
  epoch += 1;
  for (const fn of listeners) fn();
}

export function subscribeTextLayoutEpoch(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
