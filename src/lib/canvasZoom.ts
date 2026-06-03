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

/** When union bbox of roots exceeds this, fit a single primary frame instead (typical Figma .fig). */
export const VIEWPORT_PRIMARY_FIT_MAX_SPAN = 8_000;

/** Ignore roots larger than this when picking a primary frame (Figma cover / pasteboards). */
export const VIEWPORT_MAX_ROOT_DIMENSION = 16_000;
export const VIEWPORT_MAX_ROOT_AREA = 80_000_000;

export type ViewportFitMode = "all" | "primary";

type ViewportNode = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
  type?: string;
  name?: string;
};

function isReasonableViewportRoot(n: ViewportNode): boolean {
  const w = Number.isFinite(n.width) ? n.width : 0;
  const h = Number.isFinite(n.height) ? n.height : 0;
  if (w <= 0 || h <= 0) return false;
  if (w > VIEWPORT_MAX_ROOT_DIMENSION || h > VIEWPORT_MAX_ROOT_DIMENSION) return false;
  if (w * h > VIEWPORT_MAX_ROOT_AREA) return false;
  const name = (n.name ?? "").toLowerCase();
  if (/internal only|figma\.com|pasteboard|cover page/.test(name)) return false;
  return true;
}

function scoreViewportRoot(n: ViewportNode): number {
  const w = Math.max(0, n.width);
  const h = Math.max(0, n.height);
  const area = w * h;
  let score = area;
  if (n.type === "frame") score *= 1.35;
  if (w >= 280 && w <= 2400 && h >= 280 && h <= 5000) score *= 1.5;
  return score;
}

function unionBounds(
  nodes: Record<string, ViewportNode>,
  ids: string[],
  measure?: (id: string) => { minX: number; minY: number; maxX: number; maxY: number } | null,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const measured = measure?.(id);
    if (measured) {
      minX = Math.min(minX, measured.minX);
      minY = Math.min(minY, measured.minY);
      maxX = Math.max(maxX, measured.maxX);
      maxY = Math.max(maxY, measured.maxY);
      continue;
    }
    const n = nodes[id];
    if (!n) continue;
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
    const w = Number.isFinite(n.width) ? n.width : 0;
    const h = Number.isFinite(n.height) ? n.height : 0;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Picks which root frames to include when fitting the viewport.
 * Figma files often have many top-level frames spread far apart; fitting them all zooms to ~1–4%.
 */
export function pickViewportRootIds(
  nodes: Record<string, ViewportNode>,
  rootIds: string[],
  maxUnionSpan = VIEWPORT_PRIMARY_FIT_MAX_SPAN,
): string[] {
  if (rootIds.length <= 1) return rootIds;

  const visible = rootIds.filter((id) => nodes[id]?.visible !== false);
  let candidates = visible.length > 0 ? visible : rootIds;
  const reasonable = candidates.filter((id) => {
    const n = nodes[id];
    return n ? isReasonableViewportRoot(n) : false;
  });
  if (reasonable.length > 0) candidates = reasonable;

  const bounds = unionBounds(nodes, candidates);
  if (!bounds) return candidates;

  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  if (span <= maxUnionSpan && candidates.length <= 6) return candidates;

  let bestId = candidates[0]!;
  let bestScore = -1;
  for (const id of candidates) {
    const n = nodes[id];
    if (!n) continue;
    const score = scoreViewportRoot(n);
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return [bestId];
}

/** Pan/zoom so root frames are centered in the canvas viewport. */
export function viewportForRootNodes(
  nodes: Record<string, ViewportNode>,
  rootIds: string[],
  viewportW = 1200,
  viewportH = 800,
  opts?: {
    fit?: ViewportFitMode;
    maxUnionSpan?: number;
    measureWorldBounds?: (id: string) => { minX: number; minY: number; maxX: number; maxY: number } | null;
  },
): { zoom: number; pan: { x: number; y: number } } | null {
  if (rootIds.length === 0) return null;

  const fitIds =
    opts?.fit === "primary"
      ? pickViewportRootIds(nodes, rootIds, opts?.maxUnionSpan)
      : rootIds;

  const bounds = unionBounds(nodes, fitIds, opts?.measureWorldBounds);
  if (!bounds) return null;

  const pad = 56;
  const bw = Math.max(1, bounds.maxX - bounds.minX + pad * 2);
  const bh = Math.max(1, bounds.maxY - bounds.minY + pad * 2);
  const zoom = clampCanvasZoom(Math.min((viewportW * 0.92) / bw, (viewportH * 0.88) / bh, 1.25));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    zoom,
    pan: { x: viewportW / 2 - cx * zoom, y: viewportH / 2 - cy * zoom },
  };
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
