/** Per-layer effects (shadows, blur). Used on `EditorNode.effects` and inside effect design tokens. */

export type NodeEffectType = "drop-shadow" | "inner-shadow" | "layer-blur" | "background-blur";

export interface NodeEffect {
  id: string;
  type: NodeEffectType;
  visible: boolean;
  x?: number;
  y?: number;
  blur?: number;
  spread?: number;
  color?: string;
  /** 0–1, multiplied with color alpha */
  opacity?: number;
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
      return { id: newNodeEffectId(), type, visible: true, blur: 12 };
  }
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

export interface NodeEffectRenderStyle {
  boxShadow?: string;
  filter?: string;
  backdropFilter?: string;
}

/**
 * Build CSS box-shadow, filter, and backdrop-filter from visible effects.
 * `legacyTokenShadow` is appended to box-shadow when present (design token legacy string).
 */
export function buildNodeEffectRenderStyle(
  effects: NodeEffect[] | undefined,
  legacyTokenShadow?: string,
): NodeEffectRenderStyle {
  const shadows: string[] = [];
  if (legacyTokenShadow?.trim()) shadows.push(legacyTokenShadow.trim());

  const layerBlurs: number[] = [];
  const backdropBlurs: number[] = [];

  for (const e of effects ?? []) {
    if (!e.visible) continue;
    const x = e.x ?? 0;
    const y = e.y ?? 0;
    const blur = Math.max(0, e.blur ?? 0);
    const spread = e.spread ?? 0;
    const rgba = effectColorToRgba(e.color, e.opacity ?? 1);

    if (e.type === "drop-shadow") {
      shadows.push(`${x}px ${y}px ${blur}px ${spread}px ${rgba}`);
    } else if (e.type === "inner-shadow") {
      shadows.push(`inset ${x}px ${y}px ${blur}px ${spread}px ${rgba}`);
    } else if (e.type === "layer-blur" && blur > 0) {
      layerBlurs.push(blur);
    } else if (e.type === "background-blur" && blur > 0) {
      backdropBlurs.push(blur);
    }
  }

  const maxLayerBlur = layerBlurs.length ? Math.max(...layerBlurs) : 0;
  const maxBackdropBlur = backdropBlurs.length ? Math.max(...backdropBlurs) : 0;

  const filter = maxLayerBlur > 0 ? `blur(${maxLayerBlur}px)` : undefined;
  const backdropFilter = maxBackdropBlur > 0 ? `blur(${maxBackdropBlur}px)` : undefined;
  const boxShadow = shadows.length ? shadows.join(", ") : undefined;

  return { boxShadow, filter, backdropFilter };
}

/** Best-effort CSS `filter` fragment for SVG / canvas from the first visible drop shadow. */
export function firstVisibleDropShadowFilter(effects: NodeEffect[] | undefined): string | undefined {
  for (const e of effects ?? []) {
    if (!e.visible || e.type !== "drop-shadow") continue;
    const x = e.x ?? 0;
    const y = e.y ?? 0;
    const b = Math.max(0, e.blur ?? 0);
    const rgba = effectColorToRgba(e.color, e.opacity);
    return `drop-shadow(${x}px ${y}px ${b}px ${rgba})`;
  }
  return undefined;
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
      }
    });
  return parts.length ? parts.join(" · ") : "—";
}

export function cloneEffectsWithNewIds(effects: NodeEffect[] | undefined): NodeEffect[] | undefined {
  if (!effects?.length) return undefined;
  return effects.map((e) => ({ ...e, id: newNodeEffectId() }));
}
