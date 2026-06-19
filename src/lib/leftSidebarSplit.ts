const LAYERS_HEIGHT_KEY = "craft-left-sidebar-layers-height";

export const LEFT_SIDEBAR_SPLIT = {
  minLayers: 160,
  /** Mitra header row — minimum height when the section is open or collapsed. */
  minJulesHeader: 40,
  /** Default expanded Mitra height — header + prompt footer (compact view). */
  defaultMitra: 248,
  handle: 8,
  /** Tailwind gap-2 between stacked sidebar cards when the split handle is hidden. */
  sectionGap: 8,
  defaultLayers: 590,
  /** Drag up at least this many px from collapsed to expand Mitra. */
  expandDragPx: 12,
} as const;

function reservedSplitChrome(
  availableHeight: number,
  panelOpen: boolean,
  mitraOpen: boolean,
): number {
  if (availableHeight <= 0) return 0;
  const mitraReserved = LEFT_SIDEBAR_SPLIT.minJulesHeader;
  const betweenCards =
    panelOpen && mitraOpen ? LEFT_SIDEBAR_SPLIT.handle : LEFT_SIDEBAR_SPLIT.sectionGap;
  return mitraReserved + betweenCards;
}

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function clampLayersPanelHeight(
  height: number,
  availableHeight: number,
  panelOpen = true,
  mitraOpen = true,
): number {
  if (availableHeight <= 0) return LEFT_SIDEBAR_SPLIT.minLayers;
  const max = Math.max(
    LEFT_SIDEBAR_SPLIT.minLayers,
    availableHeight - reservedSplitChrome(availableHeight, panelOpen, mitraOpen),
  );
  return Math.min(max, Math.max(LEFT_SIDEBAR_SPLIT.minLayers, Math.round(height)));
}

/** Remaining height for Mitra when both panels share the split container. */
export function computeMitraPanelHeight(
  availableHeight: number,
  layersHeight: number,
  panelOpen = true,
  mitraOpen = true,
): number | undefined {
  if (!panelOpen || !mitraOpen || availableHeight <= 0) return undefined;
  const mitra = availableHeight - layersHeight - LEFT_SIDEBAR_SPLIT.handle;
  return Math.max(LEFT_SIDEBAR_SPLIT.minJulesHeader, Math.round(mitra));
}

/** Default layers height when both panels are open (clamped to available space). */
export function defaultCompactLayersHeight(
  availableHeight: number,
  panelOpen = true,
  mitraOpen = true,
): number {
  if (availableHeight <= 0) return LEFT_SIDEBAR_SPLIT.defaultLayers;
  return clampLayersPanelHeight(
    LEFT_SIDEBAR_SPLIT.defaultLayers,
    availableHeight,
    panelOpen,
    mitraOpen,
  );
}

export function mitraHeightForSplit(availableHeight: number, layersHeight: number): number {
  return availableHeight - layersHeight - LEFT_SIDEBAR_SPLIT.handle;
}

/** Snap Mitra to header-only when the split leaves no room for the prompt. */
export function shouldSnapMitraCollapsed(
  availableHeight: number,
  layersHeight: number,
): boolean {
  if (availableHeight <= 0) return false;
  return mitraHeightForSplit(availableHeight, layersHeight) <= LEFT_SIDEBAR_SPLIT.minJulesHeader;
}

/** Layers height while Mitra is collapsed (header + gap below layers card). */
export function collapsedSplitLayersHeight(availableHeight: number): number {
  if (availableHeight <= 0) return LEFT_SIDEBAR_SPLIT.defaultLayers;
  return Math.max(
    LEFT_SIDEBAR_SPLIT.minLayers,
    availableHeight -
      LEFT_SIDEBAR_SPLIT.sectionGap -
      LEFT_SIDEBAR_SPLIT.minJulesHeader -
      LEFT_SIDEBAR_SPLIT.handle,
  );
}

export function readLayersPanelHeight(
  availableHeight: number,
  panelOpen = true,
  mitraOpen = true,
): number {
  const storage = getStorage();
  const fallback = defaultCompactLayersHeight(availableHeight, panelOpen, mitraOpen);
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(LAYERS_HEIGHT_KEY);
    if (!raw) return fallback;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return fallback;
    return clampLayersPanelHeight(n, availableHeight, panelOpen, mitraOpen);
  } catch {
    return fallback;
  }
}

export function writeLayersPanelHeight(
  height: number,
  availableHeight: number,
  panelOpen = true,
  mitraOpen = true,
): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      LAYERS_HEIGHT_KEY,
      String(clampLayersPanelHeight(height, availableHeight, panelOpen, mitraOpen)),
    );
  } catch {
    /* ignore quota / private mode */
  }
}
