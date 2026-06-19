/** Default pasteboard / workspace background (theme-linked — resolves per UI theme). */
export const DEFAULT_CANVAS_BACKGROUND = "#ffffff";

/** Legacy dark pasteboard sentinel; theme-linked like DEFAULT_CANVAS_BACKGROUND. */
export const CANVAS_WORKSPACE_DARK = "#1e1e1e";

/** Inline style for theme-linked pasteboard — tracks `:root` / `.dark` tokens. */
export const THEME_CANVAS_WORKSPACE_CSS = "hsl(var(--pc-canvas-workspace))";

const DEFAULT_LIGHT_WORKSPACE_HEXES = new Set([
  DEFAULT_CANVAS_BACKGROUND.toLowerCase(),
  "#e5e5e5",
  "#e8eaed",
  "#ebebeb",
  "#f5f5f5",
]);

function parseHexRgb(input: string): [number, number, number] | null {
  let h = input.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6) return null;
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Light neutral pasteboard defaults (incl. AI-generated greys) that should follow app theme. */
export function isDefaultLightWorkspaceBackground(backgroundColor: string): boolean {
  const normalized = backgroundColor.trim().toLowerCase();
  if (DEFAULT_LIGHT_WORKSPACE_HEXES.has(normalized)) return true;
  const rgb = parseHexRgb(normalized);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return spread < 28 && relativeLuminance(rgb) > 0.8;
}

/** True when the stored page background should track app light/dark theme tokens. */
export function isThemeLinkedWorkspaceBackground(backgroundColor: string): boolean {
  const normalized = backgroundColor.trim().toLowerCase();
  return isDefaultLightWorkspaceBackground(backgroundColor) || normalized === "#212121";
}

/** Resolved hex for theme-linked workspace (labels, rulers, store helpers). */
export function themeCanvasWorkspaceHex(theme: "light" | "dark"): string {
  return theme === "dark" ? CANVAS_WORKSPACE_DARK : DEFAULT_CANVAS_BACKGROUND;
}

/** Hex pasteboard color for chrome math when the visible bg is theme-linked. */
export function resolveDisplayCanvasBackgroundHex(
  stored: string,
  theme: "light" | "dark",
): string {
  if (isThemeLinkedWorkspaceBackground(stored)) {
    return themeCanvasWorkspaceHex(theme);
  }
  return stored;
}

/** Map stored page background to a pasteboard color that matches app light/dark UI. */
export function displayCanvasBackground(
  stored: string,
  theme: "light" | "dark",
): string {
  if (isThemeLinkedWorkspaceBackground(stored)) {
    return themeCanvasWorkspaceHex(theme);
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

/** Frame title above artboards (screen px — rendered in overlay space). */
export const CANVAS_FRAME_LABEL_FONT_SCREEN_PX = 11;
export const CANVAS_FRAME_LABEL_OFFSET_SCREEN_PX = 18;

/** Resize handle outer size in screen pixels (constant across zoom). */
export const CANVAS_HANDLE_SCREEN_PX = 8;

/** Resize handle ring width (screen px). */
export const CANVAS_HANDLE_BORDER_SCREEN_PX = 1;

const CANVAS_HANDLE_FILL = "#ffffff";

/** Default inset for corner-radius handles from the corner along the bisector (screen px). */
export const CANVAS_CORNER_RADIUS_HANDLE_INSET_SCREEN_PX = 12;

/** Corner-radius handle outer diameter (screen px) — must stay larger than border × 2. */
export const CANVAS_CORNER_RADIUS_HANDLE_SCREEN_PX = 10;

/** Corner-radius handle ring width (screen px). */
export const CANVAS_CORNER_RADIUS_HANDLE_BORDER_SCREEN_PX = 2;

/** Rotate handle outer diameter on canvas (screen px). */
export const CANVAS_ROTATE_HANDLE_SCREEN_PX = 14;

/** Rotate glyph inside the top handle (screen px). */
export const CANVAS_ROTATE_HANDLE_GLYPH_SCREEN_PX = 10;

/** Figma-style rotate handle: white disc + blue ring + arc glyph. */
export function canvasRotateHandleStyle(
  borderColor: string,
  outerPx = CANVAS_ROTATE_HANDLE_SCREEN_PX,
  borderPx = CANVAS_HANDLE_BORDER_SCREEN_PX,
): {
  width: number;
  height: number;
  boxSizing: "border-box";
  padding: number;
  background: string;
  border: string;
  borderRadius: string;
  display: "flex";
  alignItems: "center";
  justifyContent: "center";
  color: string;
} {
  return {
    width: outerPx,
    height: outerPx,
    boxSizing: "border-box",
    padding: 0,
    background: CANVAS_HANDLE_FILL,
    border: `${borderPx}px solid ${borderColor}`,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: borderColor,
  };
}

/** Ellipse arc sweep/ratio handle outer diameter (screen px). */
export const CANVAS_ELLIPSE_ARC_HANDLE_SCREEN_PX = 10;

/** Ellipse arc start/end dot diameter on partial arcs (screen px). */
export const CANVAS_ELLIPSE_ARC_DOT_SCREEN_PX = 8;

const CORNER_RADIUS_HANDLE_FILL = "#ffffff";
const CORNER_RADIUS_HANDLE_RING = "#18a0fb";

/** Crisp Figma-style corner-radius dot (fixed screen px, zoom-independent). */
export function canvasCornerRadiusHandleStyle(
  outerPx = CANVAS_CORNER_RADIUS_HANDLE_SCREEN_PX,
  borderPx = CANVAS_CORNER_RADIUS_HANDLE_BORDER_SCREEN_PX,
): {
  width: number;
  height: number;
  boxSizing: "border-box";
  padding: number;
  background: string;
  border: string;
  borderRadius: string;
} {
  return {
    width: outerPx,
    height: outerPx,
    boxSizing: "border-box",
    padding: 0,
    background: CORNER_RADIUS_HANDLE_FILL,
    border: `${borderPx}px solid ${CORNER_RADIUS_HANDLE_RING}`,
    borderRadius: "50%",
  };
}

/** Live shape-draw anchor dot diameter (screen px). */
export const CANVAS_SHAPE_DRAFT_DOT_SCREEN_PX = 6;

const SHAPE_DRAFT_DOT_FILL = "#18a0fb";

/** Figma-style blue anchor while drawing a shape from 0×0. */
export function canvasShapeDraftDotStyle(
  outerPx = CANVAS_SHAPE_DRAFT_DOT_SCREEN_PX,
): {
  width: number;
  height: number;
  boxSizing: "border-box";
  background: string;
  borderRadius: string;
} {
  return {
    width: outerPx,
    height: outerPx,
    boxSizing: "border-box",
    background: SHAPE_DRAFT_DOT_FILL,
    borderRadius: "50%",
  };
}

/** Swap-drag pink center handle outer diameter (screen px). */
export const CANVAS_SWAP_PINK_DOT_SCREEN_PX = 10;

/** Swap-drag pink center handle ring width (screen px). */
export const CANVAS_SWAP_PINK_DOT_BORDER_SCREEN_PX = 2;

/** Swap-drag target outline stroke (screen px). */
export const CANVAS_SWAP_OUTLINE_SCREEN_PX = 1.5;

/** Crisp Figma-style swap pink dot (fixed screen px, zoom-independent). */
export function canvasSwapPinkDotStyle(
  variant: "solid" | "ring" = "solid",
  outerPx = CANVAS_SWAP_PINK_DOT_SCREEN_PX,
  borderPx = CANVAS_SWAP_PINK_DOT_BORDER_SCREEN_PX,
): {
  width: number;
  height: number;
  boxSizing: "border-box";
  padding: number;
  background: string;
  border: string;
  borderRadius: string;
  boxShadow: string;
} {
  const fill = variant === "solid" ? CANVAS_VISUAL.swapPink : "transparent";
  const ring = variant === "solid" ? "#ffffff" : CANVAS_VISUAL.swapPink;
  return {
    width: outerPx,
    height: outerPx,
    boxSizing: "border-box",
    padding: 0,
    background: fill,
    border: `${borderPx}px solid ${ring}`,
    borderRadius: "50%",
    boxShadow:
      variant === "solid"
        ? `0 0 0 1px ${CANVAS_VISUAL.swapPinkRing}`
        : "0 0 0 1px rgba(255, 255, 255, 0.9)",
  };
}

/** Smart-guide / measure line width in screen pixels (constant at any zoom). */
export const CANVAS_GUIDE_LINE_SCREEN_PX = 1;

/** Selection / hover outline width in screen pixels. */
export const CANVAS_OUTLINE_SCREEN_PX = 1;

/** Text edit caret width in screen pixels (constant at any zoom). */
export const TEXT_CARET_SCREEN_PX = 1;

/** Crisp square resize/rotate corner handle (fixed screen px). */
export function canvasResizeHandleStyle(
  borderColor: string,
  outerPx = CANVAS_HANDLE_SCREEN_PX,
  borderPx = CANVAS_HANDLE_BORDER_SCREEN_PX,
): {
  width: number;
  height: number;
  boxSizing: "border-box";
  padding: number;
  background: string;
  border: string;
  borderRadius: number;
} {
  return {
    width: outerPx,
    height: outerPx,
    boxSizing: "border-box",
    padding: 0,
    background: CANVAS_HANDLE_FILL,
    border: `${borderPx}px solid ${borderColor}`,
    borderRadius: 0,
  };
}

/** Crisp 1px selection frame outline (fixed screen px, zoom-independent). */
export function canvasSelectionOutlineStyle(
  color: string,
  widthPx = CANVAS_OUTLINE_SCREEN_PX,
): {
  border: string;
  boxShadow: string;
} {
  return {
    border: "none",
    boxShadow: `inset 0 0 0 ${widthPx}px ${color}`,
  };
}

/** Half-length of auto-layout spacing tick marks (screen pixels, constant across zoom). */
export const AUTO_LAYOUT_SPACING_TICK_SCREEN_PX = 12;

/** Auto-layout spacing indicator stroke width in screen pixels. */
export const AUTO_LAYOUT_SPACING_LINE_SCREEN_PX = 2;

/** Offset for edit-value badges (corner radius, etc.) from the handle along the corner bisector. */
export const CANVAS_EDIT_VALUE_BADGE_OFFSET_SCREEN_PX = 28;

/** On-canvas linear gradient axis stroke (screen px). */
export const CANVAS_GRADIENT_AXIS_SCREEN_PX = 1;

/** Dot on the gradient axis at each stop (screen px). */
export const CANVAS_GRADIENT_AXIS_DOT_SCREEN_PX = 6;

/** Color stop square on the gradient overlay (screen px). */
export const CANVAS_GRADIENT_STOP_SQUARE_SCREEN_PX = 14;

/** Connector from axis dot to stop square (screen px). */
export const CANVAS_GRADIENT_STOP_OFFSET_SCREEN_PX = 18;

/** Wider hit target for clicking the gradient axis (screen px). */
export const CANVAS_GRADIENT_AXIS_HIT_SCREEN_PX = 14;

/** Stop square border (screen px). */
export const CANVAS_GRADIENT_STOP_BORDER_SCREEN_PX = 2;

const GRADIENT_AXIS_COLOR = "#ffffff";
const GRADIENT_STOP_RING = "#18a0fb";

/** Figma-style gradient stop swatch on canvas (fixed screen px). */
export function canvasGradientStopSquareStyle(
  color: string,
  selected = false,
  outerPx = CANVAS_GRADIENT_STOP_SQUARE_SCREEN_PX,
  borderPx = CANVAS_GRADIENT_STOP_BORDER_SCREEN_PX,
): {
  width: number;
  height: number;
  boxSizing: "border-box";
  background: string;
  border: string;
  borderRadius: number;
} {
  return {
    width: outerPx,
    height: outerPx,
    boxSizing: "border-box",
    background: color,
    border: `${borderPx}px solid ${selected ? GRADIENT_STOP_RING : GRADIENT_AXIS_COLOR}`,
    borderRadius: 0,
  };
}

/** Dot on the gradient axis line (fixed screen px). */
export function canvasGradientAxisDotStyle(
  outerPx = CANVAS_GRADIENT_AXIS_DOT_SCREEN_PX,
): {
  width: number;
  height: number;
  boxSizing: "border-box";
  background: string;
  border: string;
  borderRadius: string;
} {
  return {
    width: outerPx,
    height: outerPx,
    boxSizing: "border-box",
    background: GRADIENT_AXIS_COLOR,
    border: `1px solid ${GRADIENT_AXIS_COLOR}`,
    borderRadius: "50%",
  };
}

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
