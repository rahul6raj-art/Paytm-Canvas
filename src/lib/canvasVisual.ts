/** Default pasteboard / workspace background (design mode, light UI). */
export const DEFAULT_CANVAS_BACKGROUND = "#e5e5e5";

/** Default pasteboard when app UI is in dark mode (Figma-style). */
export const CANVAS_WORKSPACE_DARK = "#2c2c2c";

/** Map stored page background to a pasteboard color that matches app light/dark UI. */
export function displayCanvasBackground(
  stored: string,
  theme: "light" | "dark",
): string {
  const normalized = stored.trim().toLowerCase();
  if (theme === "dark") {
    if (
      normalized === DEFAULT_CANVAS_BACKGROUND.toLowerCase() ||
      normalized === "#ebebeb" ||
      normalized === "#f5f5f5" ||
      normalized === "#ffffff"
    ) {
      return CANVAS_WORKSPACE_DARK;
    }
    return stored;
  }
  if (normalized === CANVAS_WORKSPACE_DARK.toLowerCase()) {
    return DEFAULT_CANVAS_BACKGROUND;
  }
  return stored;
}

/** Figma-like canvas chrome tokens; selection/hover use CSS vars (see globals.css `.dark`). */
export const CANVAS_VISUAL = {
  workspace: DEFAULT_CANVAS_BACKGROUND,
  selection: "var(--pc-canvas-selection)",
  selectionFill: "var(--pc-canvas-selection-fill)",
  selectionMuted: "var(--pc-canvas-selection-muted)",
  hoverOutline: "var(--pc-canvas-hover-outline)",
  inspectHover: "var(--pc-canvas-inspect-hover)",
  guide: "#f24822",
  /** Layout guides dragged from rulers (Figma-style). */
  layoutGuide: "#9747ff",
  /** Smart selection / swap drag indicator (Figma pink). */
  swapPink: "#ff24ff",
  swapPinkRing: "rgba(255, 36, 255, 0.55)",
  frameLabel: "#333333",
  frameLabelMuted: "#8c8c8c",
  frameBorder: "#e6e6e6",
  prototype: "var(--pc-canvas-selection)",
  comment: "var(--pc-canvas-selection)",
  locked: "var(--pc-canvas-locked-outline)",
  instance: "var(--pc-canvas-instance-outline)",
  groupOutline: "var(--pc-canvas-group-outline)",
  booleanOutline: "var(--pc-canvas-boolean-outline)",
  maskOutline: "var(--pc-canvas-mask-outline)",
} as const;

/** Resize handle size in screen pixels (constant across zoom). */
export const CANVAS_HANDLE_SCREEN_PX = 8;

/** Selection / hover outline width in screen pixels. */
export const CANVAS_OUTLINE_SCREEN_PX = 1;

/** Selection dimension badge (W × H below selection box). */
export const CANVAS_SELECTION_DIMENSION_BADGE_FONT_SCREEN_PX = 14;
export const CANVAS_SELECTION_DIMENSION_BADGE_PAD_X_SCREEN_PX = 12;
export const CANVAS_SELECTION_DIMENSION_BADGE_PAD_Y_SCREEN_PX = 7;
export const CANVAS_SELECTION_DIMENSION_BADGE_GAP_SCREEN_PX = 14;
export const CANVAS_SELECTION_DIMENSION_BADGE_RADIUS_SCREEN_PX = 6;

export function screenPxToWorld(px: number, zoom: number): number {
  return px / Math.max(zoom, 0.0001);
}

/** W × H label for canvas selection dimension badge. */
export function formatSelectionDimensions(width: number, height: number): string {
  return `${Math.round(width)} × ${Math.round(height)}`;
}
