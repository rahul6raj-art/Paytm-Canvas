const LEFT_KEY = "craft-left-sidebar-width";
const RIGHT_KEY = "craft-right-panel-width";
const RIGHT_CODE_KEY = "craft-right-panel-code-width";

export type PanelWidthBounds = {
  min: number;
  max: number;
  default: number;
};

/** Minimum canvas workspace when clamping side panels against the viewport. */
export const MIN_CANVAS_WORKSPACE_WIDTH = 360;

export const COMMENTS_PANEL_WIDTH = 240;

/** Left sidebar — wide enough for layer rows + pages header without clipping. */
export const LEFT_SIDEBAR_BOUNDS: PanelWidthBounds = {
  min: 240,
  max: 520,
  default: 260,
};

/** Design / prototype / inspect properties panel. */
export const RIGHT_PANEL_BOUNDS: PanelWidthBounds = {
  min: 280,
  max: 520,
  default: 300,
};

/** Code tab needs extra width for monospace preview. */
export const RIGHT_CODE_PANEL_BOUNDS: PanelWidthBounds = {
  min: 360,
  max: 640,
  default: 400,
};

export type PanelLayoutContext = {
  getViewportWidth: () => number;
  /** Width of other horizontal chrome (opposite panel, comments column, etc.). */
  getReservedChromeWidth: () => number;
};

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Upper bound for a panel given viewport and sibling chrome. */
export function effectivePanelMax(
  bounds: PanelWidthBounds,
  viewportWidth: number,
  reservedChromeWidth: number,
): number {
  const viewportCap = Math.max(
    bounds.min,
    viewportWidth - reservedChromeWidth - MIN_CANVAS_WORKSPACE_WIDTH,
  );
  return Math.min(bounds.max, viewportCap);
}

export function clampPanelWidth(width: number, bounds: PanelWidthBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(width)));
}

export function clampPanelWidthInLayout(
  width: number,
  bounds: PanelWidthBounds,
  layout?: PanelLayoutContext,
): number {
  const min = bounds.min;
  const max = layout
    ? effectivePanelMax(bounds, layout.getViewportWidth(), layout.getReservedChromeWidth())
    : bounds.max;
  return Math.min(max, Math.max(min, Math.round(width)));
}

function readStorage(key: string, bounds: PanelWidthBounds, layout?: PanelLayoutContext): number {
  const storage = getStorage();
  if (!storage) return clampPanelWidthInLayout(bounds.default, bounds, layout);
  try {
    const raw = storage.getItem(key);
    if (!raw) return clampPanelWidthInLayout(bounds.default, bounds, layout);
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return clampPanelWidthInLayout(bounds.default, bounds, layout);
    return clampPanelWidthInLayout(n, bounds, layout);
  } catch {
    return clampPanelWidthInLayout(bounds.default, bounds, layout);
  }
}

function writeStorage(key: string, width: number, bounds: PanelWidthBounds, layout?: PanelLayoutContext): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, String(clampPanelWidthInLayout(width, bounds, layout)));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readLeftSidebarWidth(layout?: PanelLayoutContext): number {
  return readStorage(LEFT_KEY, LEFT_SIDEBAR_BOUNDS, layout);
}

export function writeLeftSidebarWidth(width: number, layout?: PanelLayoutContext): void {
  writeStorage(LEFT_KEY, width, LEFT_SIDEBAR_BOUNDS, layout);
}

export function readRightPanelWidth(codeTab: boolean, layout?: PanelLayoutContext): number {
  return readStorage(
    codeTab ? RIGHT_CODE_KEY : RIGHT_KEY,
    codeTab ? RIGHT_CODE_PANEL_BOUNDS : RIGHT_PANEL_BOUNDS,
    layout,
  );
}

export function writeRightPanelWidth(width: number, codeTab: boolean, layout?: PanelLayoutContext): void {
  writeStorage(
    codeTab ? RIGHT_CODE_KEY : RIGHT_KEY,
    width,
    codeTab ? RIGHT_CODE_PANEL_BOUNDS : RIGHT_PANEL_BOUNDS,
    layout,
  );
}
