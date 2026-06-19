const PAGES_HEIGHT_KEY = "craft-layers-panel-pages-height";

export const LAYERS_PANEL_PAGES_SPLIT = {
  minPages: 72,
  minLayers: 120,
  handle: 8,
  defaultPages: 128,
} as const;

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function clampPagesSectionHeight(height: number, availableHeight: number): number {
  if (availableHeight <= 0) return LAYERS_PANEL_PAGES_SPLIT.defaultPages;
  const max = Math.max(
    LAYERS_PANEL_PAGES_SPLIT.minPages,
    availableHeight - LAYERS_PANEL_PAGES_SPLIT.minLayers - LAYERS_PANEL_PAGES_SPLIT.handle,
  );
  return Math.min(max, Math.max(LAYERS_PANEL_PAGES_SPLIT.minPages, Math.round(height)));
}

export function readPagesSectionHeight(availableHeight: number): number {
  const fallback = clampPagesSectionHeight(LAYERS_PANEL_PAGES_SPLIT.defaultPages, availableHeight);
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(PAGES_HEIGHT_KEY);
    if (!raw) return fallback;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return fallback;
    return clampPagesSectionHeight(n, availableHeight);
  } catch {
    return fallback;
  }
}

export function writePagesSectionHeight(height: number, availableHeight: number): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(PAGES_HEIGHT_KEY, String(clampPagesSectionHeight(height, availableHeight)));
  } catch {
    /* ignore quota / private mode */
  }
}
