/** Per-layer effects (shadows, blur, noise, texture, glass). Used on `EditorNode.effects` and effect design tokens. */

export type NodeEffectType =
  | "drop-shadow"
  | "inner-shadow"
  | "layer-blur"
  | "background-blur"
  | "noise"
  | "texture"
  | "glass";

export type NoiseEffectMode = "monochrome" | "color";

export interface NodeEffect {
  id: string;
  type: NodeEffectType;
  visible: boolean;
  /** Drop / inner shadow */
  x?: number;
  y?: number;
  blur?: number;
  spread?: number;
  color?: string;
  /** 0–1 */
  opacity?: number;
  /** Background blur saturation % (Figma-style) */
  saturation?: number;
  /** Noise */
  noiseMode?: NoiseEffectMode;
  /** 0–1 */
  density?: number;
  /** Texture */
  scale?: number;
  blendMode?: "normal" | "overlay" | "multiply" | "soft-light";
  /** Glass */
  glassOpacity?: number;
  borderWidth?: number;
  borderColor?: string;
  borderOpacity?: number;
  /** Glass highlight angle (degrees) */
  lightAngle?: number;
}

export const EFFECT_TYPE_OPTIONS: { type: NodeEffectType; label: string }[] = [
  { type: "inner-shadow", label: "Inner shadow" },
  { type: "drop-shadow", label: "Drop shadow" },
  { type: "layer-blur", label: "Layer blur" },
  { type: "background-blur", label: "Background blur" },
  { type: "noise", label: "Noise" },
  { type: "texture", label: "Texture" },
  { type: "glass", label: "Glass" },
];

export function effectTypeLabel(t: NodeEffectType): string {
  return EFFECT_TYPE_OPTIONS.find((o) => o.type === t)?.label ?? t;
}

export function isShadowEffect(t: NodeEffectType): boolean {
  return t === "drop-shadow" || t === "inner-shadow";
}

export function isBlurEffect(t: NodeEffectType): boolean {
  return t === "layer-blur" || t === "background-blur";
}

export function newNodeEffectId(): string {
  return `efx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultNodeEffect(type: NodeEffectType): NodeEffect {
  switch (type) {
    case "drop-shadow":
      return {
        id: newNodeEffectId(),
        type,
        visible: true,
        x: 0,
        y: 4,
        blur: 8,
        spread: 0,
        color: "#000000",
        opacity: 0.25,
      };
    case "inner-shadow":
      return {
        id: newNodeEffectId(),
        type,
        visible: true,
        x: 0,
        y: 2,
        blur: 6,
        spread: 0,
        color: "#000000",
        opacity: 0.2,
      };
    case "layer-blur":
      return { id: newNodeEffectId(), type, visible: true, blur: 8 };
    case "background-blur":
      return { id: newNodeEffectId(), type, visible: true, blur: 12, saturation: 100 };
    case "noise":
      return {
        id: newNodeEffectId(),
        type,
        visible: true,
        noiseMode: "monochrome",
        density: 0.35,
        opacity: 0.4,
        color: "#000000",
      };
    case "texture":
      return {
        id: newNodeEffectId(),
        type,
        visible: true,
        scale: 1,
        opacity: 0.25,
        blendMode: "overlay",
      };
    case "glass":
      return {
        id: newNodeEffectId(),
        type,
        visible: true,
        blur: 16,
        glassOpacity: 0.12,
        borderWidth: 1,
        borderColor: "#ffffff",
        borderOpacity: 0.35,
        saturation: 180,
        lightAngle: 135,
      };
  }
}

export function changeEffectType(effect: NodeEffect, newType: NodeEffectType): NodeEffect {
  const next = defaultNodeEffect(newType);
  return { ...next, id: effect.id, visible: effect.visible };
}

/** Merge a patch; replaces the effect when `type` changes (avoids stale shadow/blur fields). */
export function mergeNodeEffectPatch(effect: NodeEffect, patch: Partial<NodeEffect>): NodeEffect {
  if (patch.type && patch.type !== effect.type) {
    return changeEffectType(effect, patch.type);
  }
  return { ...effect, ...patch };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    const r = parseInt(h[0]! + h[0]!, 16);
    const g = parseInt(h[1]! + h[1]!, 16);
    const b = parseInt(h[2]! + h[2]!, 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }
  return null;
}

export function effectColorToRgba(color: string | undefined, opacity: number | undefined): string {
  const op = Math.min(1, Math.max(0, opacity ?? 1));
  const c = color?.trim() || "#000000";
  if (c.startsWith("rgba(") || c.startsWith("rgb(")) return c;
  const rgb = hexToRgb(c);
  if (!rgb) return `rgba(0,0,0,${op})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${op})`;
}

export type EffectOverlayLayer =
  | {
      kind: "noise";
      opacity: number;
      density: number;
      mono: boolean;
      color?: string;
    }
  | {
      kind: "texture";
      opacity: number;
      scale: number;
      blendMode: string;
    };

export interface NodeEffectRenderStyle {
  boxShadow?: string;
  filter?: string;
  backdropFilter?: string;
  /** Glass fill over existing background */
  glassBackground?: string;
  glassBorder?: string;
  overlayLayers?: EffectOverlayLayer[];
}

/** SVG noise tile as a data URL for CSS background-image overlays. */
export function noisePatternDataUrl(density: number, mono: boolean): string {
  const freq = (0.35 + density * 0.75).toFixed(3);
  const colorMatrix = mono ? '<feColorMatrix type="saturate" values="0"/>' : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" stitchTiles="stitch"/>
${colorMatrix}</filter>
<rect width="100%" height="100%" filter="url(#n)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function texturePatternDataUrl(scale: number): string {
  const s = Math.max(0.25, Math.min(4, scale));
  const cell = Math.round(8 * s);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cell * 2}" height="${cell * 2}">
<rect width="100%" height="100%" fill="%23888" opacity="0.08"/>
<path d="M0 ${cell} L${cell * 2} ${cell} M${cell} 0 L${cell} ${cell * 2}" stroke="%23666" stroke-width="0.5" opacity="0.35"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Build CSS box-shadow, filter, backdrop-filter, and overlay layers from visible effects.
 */
export function buildNodeEffectRenderStyle(
  effects: NodeEffect[] | undefined,
  legacyTokenShadow?: string,
): NodeEffectRenderStyle {
  const shadows: string[] = [];
  if (legacyTokenShadow?.trim()) shadows.push(legacyTokenShadow.trim());

  const layerBlurs: number[] = [];
  const backdropParts: string[] = [];
  const overlayLayers: EffectOverlayLayer[] = [];

  let glassBackground: string | undefined;
  let glassBorder: string | undefined;

  for (const e of effects ?? []) {
    if (!e.visible) continue;
    const x = e.x ?? 0;
    const y = e.y ?? 0;
    const blur = Math.max(0, e.blur ?? 0);
    const spread = e.spread ?? 0;
    const rgba = effectColorToRgba(e.color, e.opacity ?? 1);

    switch (e.type) {
      case "drop-shadow":
        shadows.push(`${x}px ${y}px ${blur}px ${spread}px ${rgba}`);
        break;
      case "inner-shadow":
        shadows.push(`inset ${x}px ${y}px ${blur}px ${spread}px ${rgba}`);
        break;
      case "layer-blur":
        if (blur > 0) layerBlurs.push(blur);
        break;
      case "background-blur": {
        if (blur > 0) {
          const sat = Math.max(0, Math.min(200, e.saturation ?? 100));
          backdropParts.push(`blur(${blur}px) saturate(${sat}%)`);
        }
        break;
      }
      case "noise":
        overlayLayers.push({
          kind: "noise",
          opacity: Math.min(1, Math.max(0, e.opacity ?? 0.4)),
          density: Math.min(1, Math.max(0, e.density ?? 0.35)),
          mono: (e.noiseMode ?? "monochrome") === "monochrome",
          color: e.color,
        });
        break;
      case "texture":
        overlayLayers.push({
          kind: "texture",
          opacity: Math.min(1, Math.max(0, e.opacity ?? 0.25)),
          scale: Math.max(0.25, Math.min(4, e.scale ?? 1)),
          blendMode: e.blendMode ?? "overlay",
        });
        break;
      case "glass": {
        const gBlur = Math.max(0, e.blur ?? 16);
        const sat = Math.max(0, Math.min(200, e.saturation ?? 180));
        if (gBlur > 0) backdropParts.push(`blur(${gBlur}px) saturate(${sat}%)`);
        glassBackground = `rgba(255,255,255,${Math.min(1, Math.max(0, e.glassOpacity ?? 0.12))})`;
        const bw = e.borderWidth ?? 1;
        if (bw > 0) {
          glassBorder = `${bw}px solid ${effectColorToRgba(e.borderColor ?? "#ffffff", e.borderOpacity ?? 0.35)}`;
        }
        break;
      }
    }
  }

  const maxLayerBlur = layerBlurs.length ? Math.max(...layerBlurs) : 0;
  const filter = maxLayerBlur > 0 ? `blur(${maxLayerBlur}px)` : undefined;
  const backdropFilter = backdropParts.length ? backdropParts.join(" ") : undefined;
  const boxShadow = shadows.length ? shadows.join(", ") : undefined;

  return {
    boxShadow,
    filter,
    backdropFilter,
    glassBackground,
    glassBorder,
    overlayLayers: overlayLayers.length ? overlayLayers : undefined,
  };
}

/** Extra clip-path padding so SVG layer effects (drop shadow, blur) are not cut off. */
export function maxEffectBleedPad(effects: NodeEffect[] | undefined): number {
  let pad = 0;
  for (const e of effects ?? []) {
    if (!e.visible) continue;
    if (e.type === "drop-shadow" || e.type === "inner-shadow") {
      const blur = Math.max(0, e.blur ?? 0);
      const spread = Math.max(0, e.spread ?? 0);
      const x = Math.abs(e.x ?? 0);
      const y = Math.abs(e.y ?? 0);
      pad = Math.max(pad, blur + spread + Math.max(x, y));
    } else if (e.type === "layer-blur") {
      pad = Math.max(pad, Math.max(0, e.blur ?? 0));
    }
  }
  return pad;
}

/** CSS `drop-shadow()` fragments — follows painted alpha (glyphs), not the layer box. */
export function dropShadowFilterFragments(effects: NodeEffect[] | undefined): string[] {
  const out: string[] = [];
  for (const e of effects ?? []) {
    if (!e.visible || e.type !== "drop-shadow") continue;
    const x = e.x ?? 0;
    const y = e.y ?? 0;
    const b = Math.max(0, e.blur ?? 0);
    const rgba = effectColorToRgba(e.color, e.opacity);
    out.push(`drop-shadow(${x}px ${y}px ${b}px ${rgba})`);
  }
  return out;
}

/** Best-effort CSS `filter` fragment for SVG / canvas from the first visible drop shadow. */
export function firstVisibleDropShadowFilter(effects: NodeEffect[] | undefined): string | undefined {
  return dropShadowFilterFragments(effects)[0];
}

/**
 * Canvas text effects: drop shadows use `filter: drop-shadow()` so they hug glyph ink.
 * Box-shadow is omitted — it always shadows the text frame rectangle.
 */
export function buildTextCanvasEffectRenderStyle(
  effects: NodeEffect[] | undefined,
): NodeEffectRenderStyle {
  const withoutBoxShadows = effects?.filter(
    (e) => e.type !== "drop-shadow" && e.type !== "inner-shadow",
  );
  const base = buildNodeEffectRenderStyle(withoutBoxShadows, undefined);
  const filterParts = [...dropShadowFilterFragments(effects), base.filter].filter(Boolean);
  return {
    ...base,
    boxShadow: undefined,
    filter: filterParts.length ? filterParts.join(" ") : undefined,
  };
}

export function summarizeEffectsList(effects: NodeEffect[] | undefined): string {
  if (!effects?.length) return "—";
  const parts = effects
    .filter((e) => e.visible)
    .map((e) => {
      switch (e.type) {
        case "drop-shadow":
          return `Drop ${e.x ?? 0},${e.y ?? 0} ${e.blur ?? 0}px`;
        case "inner-shadow":
          return `Inset ${e.blur ?? 0}px`;
        case "layer-blur":
          return `Blur ${e.blur ?? 0}px`;
        case "background-blur":
          return `Backdrop ${e.blur ?? 0}px`;
        case "noise":
          return `Noise ${Math.round((e.density ?? 0) * 100)}%`;
        case "texture":
          return `Texture ${e.scale ?? 1}x`;
        case "glass":
          return `Glass ${e.blur ?? 0}px`;
      }
    });
  return parts.length ? parts.join(" · ") : "—";
}

export function cloneEffectsWithNewIds(effects: NodeEffect[] | undefined): NodeEffect[] | undefined {
  if (!effects?.length) return undefined;
  return effects.map((e) => ({ ...e, id: newNodeEffectId() }));
}
