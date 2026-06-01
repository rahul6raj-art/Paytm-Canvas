/** Minimum canvas zoom (1% — wide enough to see the full 6000×6000 workspace). */
export const CANVAS_MIN_ZOOM = 0.01;

/** Maximum canvas zoom (25 600% — matches Figma’s upper zoom range). */
export const CANVAS_MAX_ZOOM = 256;

/** Zoom multiplier for toolbar / keyboard step (⌘+ / ⌘−). */
export const KEYBOARD_ZOOM_STEP = 1.75;

/** Target zoom change per mouse wheel notch (~45%). */
export const WHEEL_ZOOM_STEP = 1.45;

/** Lower = faster zoom for the same scroll delta. */
export const WHEEL_DELTA_NORMALIZER = 18;

export function clampCanvasZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return CANVAS_MIN_ZOOM;
  return Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, zoom));
}

/** Human-readable zoom percentage for UI labels. */
export function formatZoomPercent(zoom: number): string {
  const pct = zoom * 100;
  if (pct >= 1000) return `${Math.round(pct).toLocaleString()}%`;
  if (pct >= 100) return `${Math.round(pct)}%`;
  if (pct >= 10) return `${Math.round(pct)}%`;
  return `${Math.round(pct * 10) / 10}%`;
}

/**
 * Wheel / trackpad zoom factor from scroll delta.
 * Positive `deltaY` zooms out; negative zooms in.
 * Scales with gesture speed — one wheel notch ≈ WHEEL_ZOOM_STEP.
 */
export function wheelZoomFactor(
  deltaY: number,
  deltaMode: number,
  opts?: { lineHeight?: number; pageHeight?: number },
): number {
  let dy = deltaY;
  const lineHeight = opts?.lineHeight ?? 16;
  const pageHeight = opts?.pageHeight ?? 800;
  if (deltaMode === 1) dy *= lineHeight;
  else if (deltaMode === 2) dy *= pageHeight;
  const steps = dy / WHEEL_DELTA_NORMALIZER;
  return Math.pow(WHEEL_ZOOM_STEP, -steps);
}

/** Zoom toward a viewport-local focus point while keeping that world point fixed on screen. */
export function zoomAtScreenPoint(params: {
  zoom: number;
  pan: { x: number; y: number };
  focusX: number;
  focusY: number;
  factor: number;
}): { zoom: number; pan: { x: number; y: number } } {
  const newZoom = clampCanvasZoom(params.zoom * params.factor);
  const worldX = (params.focusX - params.pan.x) / params.zoom;
  const worldY = (params.focusY - params.pan.y) / params.zoom;
  return {
    zoom: newZoom,
    pan: {
      x: params.focusX - worldX * newZoom,
      y: params.focusY - worldY * newZoom,
    },
  };
}
