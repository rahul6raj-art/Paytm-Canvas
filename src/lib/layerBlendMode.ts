import type { EditorNode } from "@/stores/useEditorStore";
import type { CSSProperties } from "react";

/** Layer blend modes (Figma Appearance → Blend). */
export type LayerBlendMode =
  | "pass-through"
  | "normal"
  | "darken"
  | "multiply"
  | "plus-darker"
  | "color-burn"
  | "lighten"
  | "screen"
  | "plus-lighter"
  | "color-dodge"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export type LayerBlendModeGroup = {
  modes: readonly LayerBlendMode[];
};

export const LAYER_BLEND_MODE_LABELS: Record<LayerBlendMode, string> = {
  "pass-through": "Pass through",
  normal: "Normal",
  darken: "Darken",
  multiply: "Multiply",
  "plus-darker": "Plus darker",
  "color-burn": "Color burn",
  lighten: "Lighten",
  screen: "Screen",
  "plus-lighter": "Plus lighter",
  "color-dodge": "Color dodge",
  overlay: "Overlay",
  "soft-light": "Soft light",
  "hard-light": "Hard light",
  difference: "Difference",
  exclusion: "Exclusion",
  hue: "Hue",
  saturation: "Saturation",
  color: "Color",
  luminosity: "Luminosity",
};

/** Figma blend menu groups (order matches Figma). */
export const LAYER_BLEND_MODE_GROUPS: readonly LayerBlendModeGroup[] = [
  { modes: ["pass-through", "normal"] },
  { modes: ["darken", "multiply", "plus-darker", "color-burn"] },
  { modes: ["lighten", "screen", "plus-lighter", "color-dodge"] },
  { modes: ["overlay", "soft-light", "hard-light"] },
  { modes: ["difference", "exclusion"] },
  { modes: ["hue", "saturation", "color", "luminosity"] },
];

const FIGMA_BLEND_MAP: Record<string, LayerBlendMode> = {
  PASS_THROUGH: "pass-through",
  NORMAL: "normal",
  DARKEN: "darken",
  MULTIPLY: "multiply",
  LINEAR_BURN: "plus-darker",
  COLOR_BURN: "color-burn",
  LIGHTEN: "lighten",
  SCREEN: "screen",
  LINEAR_DODGE: "plus-lighter",
  COLOR_DODGE: "color-dodge",
  OVERLAY: "overlay",
  SOFT_LIGHT: "soft-light",
  HARD_LIGHT: "hard-light",
  DIFFERENCE: "difference",
  EXCLUSION: "exclusion",
  HUE: "hue",
  SATURATION: "saturation",
  COLOR: "color",
  LUMINOSITY: "luminosity",
};

export function supportsPassThroughBlend(node: Pick<EditorNode, "type">): boolean {
  return node.type === "frame" || node.type === "group";
}

export function defaultLayerBlendMode(node: Pick<EditorNode, "type">): LayerBlendMode {
  return supportsPassThroughBlend(node) ? "pass-through" : "normal";
}

export function effectiveLayerBlendMode(node: Pick<EditorNode, "type" | "blendMode">): LayerBlendMode {
  const raw = node.blendMode;
  if (raw === "pass-through" && !supportsPassThroughBlend(node)) return "normal";
  return raw ?? defaultLayerBlendMode(node);
}

export function blendModeGroupsForNode(
  node: Pick<EditorNode, "type">,
): readonly LayerBlendModeGroup[] {
  if (supportsPassThroughBlend(node)) return LAYER_BLEND_MODE_GROUPS;
  return LAYER_BLEND_MODE_GROUPS.map((g, i) =>
    i === 0 ? { modes: g.modes.filter((m) => m !== "pass-through") } : g,
  );
}

export function figmaBlendModeToLayer(raw?: string | null): LayerBlendMode | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toUpperCase().replace(/-/g, "_");
  return FIGMA_BLEND_MAP[key];
}

/** Canonical CSS `mix-blend-mode` values for each layer mode. */
const LAYER_BLEND_MIX_CSS: Record<
  Exclude<LayerBlendMode, "pass-through" | "normal">,
  NonNullable<CSSProperties["mixBlendMode"]>
> = {
  darken: "darken",
  multiply: "multiply",
  "plus-darker": "plus-darker",
  "color-burn": "color-burn",
  lighten: "lighten",
  screen: "screen",
  "plus-lighter": "plus-lighter",
  "color-dodge": "color-dodge",
  overlay: "overlay",
  "soft-light": "soft-light",
  "hard-light": "hard-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
};

const MIX_BLEND_FALLBACK: Partial<
  Record<LayerBlendMode, NonNullable<CSSProperties["mixBlendMode"]>>
> = {
  "plus-darker": "darken",
  "plus-lighter": "lighten",
};

function resolveMixBlendCss(
  mode: LayerBlendMode,
): NonNullable<CSSProperties["mixBlendMode"]> | undefined {
  if (mode === "pass-through" || mode === "normal") return undefined;
  const primary = LAYER_BLEND_MIX_CSS[mode];
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return primary;
  }
  if (CSS.supports("mix-blend-mode", primary)) return primary;
  return MIX_BLEND_FALLBACK[mode] ?? primary;
}

export function layerBlendModeToCss(
  mode: LayerBlendMode,
  node: Pick<EditorNode, "type">,
): Pick<CSSProperties, "mixBlendMode" | "isolation"> {
  if (mode === "pass-through") return {};
  if (mode === "normal") {
    return supportsPassThroughBlend(node) ? { isolation: "isolate" } : {};
  }
  const mixBlendMode = resolveMixBlendCss(mode);
  return mixBlendMode ? { mixBlendMode } : {};
}

export function layerBlendCanvasStyle(
  node: Pick<EditorNode, "type" | "blendMode">,
): Pick<CSSProperties, "mixBlendMode" | "isolation"> {
  return layerBlendModeToCss(effectiveLayerBlendMode(node), node);
}

/** Inline `style` attribute for SVG `<g>` layer blend (scene renderer). */
export function svgLayerBlendStyleAttr(
  node: Pick<EditorNode, "type" | "blendMode">,
): string {
  const css = layerBlendCanvasStyle(node);
  const parts: string[] = [];
  if (css.isolation) parts.push(`isolation:${css.isolation}`);
  if (css.mixBlendMode) parts.push(`mix-blend-mode:${css.mixBlendMode}`);
  if (!parts.length) return "";
  return ` style="${parts.join(";")}"`;
}
