/** Screen thickness of top/left ruler bars (px). */
export const CANVAS_RULER_SIZE = 22;

export type RulerTick = { position: number; label: string };

/** Pick a world-space step so tick labels stay ~48px apart on screen. */
export function rulerStepWorld(zoom: number, minScreenPx = 48): number {
  const z = Math.max(0.01, zoom);
  const raw = minScreenPx / z;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  let mult = 1;
  if (f > 5) mult = 10;
  else if (f > 2) mult = 5;
  else if (f > 1) mult = 2;
  return mult * exp;
}

export function formatRulerLabel(world: number): string {
  if (Math.abs(world) < 0.5) return "0";
  if (Math.abs(world) >= 10_000) return `${Math.round(world / 1000)}k`;
  if (Math.abs(world) >= 1000) {
    const k = world / 1000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return String(Math.round(world));
}

/** Build tick marks for one axis (horizontal: axisSize = width, vertical: axisSize = height). */
export function buildRulerTicks(
  axisSize: number,
  pan: number,
  zoom: number,
  inset: number,
): RulerTick[] {
  if (axisSize <= inset) return [];
  const step = rulerStepWorld(zoom);
  const startWorld = (inset - pan) / zoom;
  const endWorld = (axisSize - pan) / zoom;
  const ticks: RulerTick[] = [];
  let w = Math.floor(startWorld / step) * step;
  while (w <= endWorld + step * 0.001) {
    const screen = w * zoom + pan;
    if (screen >= inset - 0.5 && screen <= axisSize + 0.5) {
      ticks.push({ position: screen, label: formatRulerLabel(w) });
    }
    w += step;
  }
  return ticks;
}
