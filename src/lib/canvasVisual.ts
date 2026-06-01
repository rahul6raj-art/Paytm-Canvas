/** Default pasteboard / workspace background (design mode). */
export const DEFAULT_CANVAS_BACKGROUND = "#e5e5e5";

/** Figma-like canvas chrome tokens (not Figma branding). */
export const CANVAS_VISUAL = {
  workspace: DEFAULT_CANVAS_BACKGROUND,
  selection: "#18a0fb",
  selectionFill: "rgba(24,160,251,0.08)",
  selectionMuted: "rgba(24,160,251,0.14)",
  hoverOutline: "rgba(24,160,251,0.55)",
  guide: "#f24822",
  frameLabel: "#333333",
  frameLabelMuted: "#8c8c8c",
  frameBorder: "#e6e6e6",
  prototype: "#18a0fb",
  comment: "#18a0fb",
  locked: "rgba(214,158,46,0.55)",
  instance: "rgba(151,71,255,0.55)",
} as const;

/** Resize handle size in screen pixels (constant across zoom). */
export const CANVAS_HANDLE_SCREEN_PX = 8;

/** Selection / hover outline width in screen pixels. */
export const CANVAS_OUTLINE_SCREEN_PX = 1;

export function screenPxToWorld(px: number, zoom: number): number {
  return px / Math.max(zoom, 0.0001);
}
