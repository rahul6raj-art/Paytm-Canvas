import type { EditorNode } from "@/stores/useEditorStore";
import type { NodeEffect } from "@/lib/nodeEffects";
import {
  buildNodeEffectRenderStyle,
  summarizeEffectsList,
} from "@/lib/nodeEffects";
import type { FillGradient } from "@/lib/fillGradient";
import { normalizeFillGradient, resolveEditableFillGradient } from "@/lib/fillGradient";
import { pickFillColorTokenId, pickTextColorTokenId } from "@/lib/colorTokenMatching";

export type DesignTokenType = "color" | "gradient" | "typography" | "spacing" | "effect";

/** Canvas preview mode for semantic color tokens (Figma-style light/dark variables). */
export type CanvasColorMode = "light" | "dark";

export interface ColorTokenStop {
  hex: string;
  opacity?: number;
}

export interface ColorTokenValue {
  hex: string;
  opacity?: number;
  /** Dark-mode override when imported from project CSS or set manually. */
  dark?: ColorTokenStop;
}

export interface TypographyTokenValue {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
}

export interface SpacingTokenValue {
  value: number;
}

export interface EffectTokenValue {
  shadow?: string;
  blur?: number;
  /** Rich layered effects (preferred when present). */
  effects?: NodeEffect[];
}

export type DesignTokenValue =
  | ColorTokenValue
  | GradientTokenValue
  | TypographyTokenValue
  | SpacingTokenValue
  | EffectTokenValue;

export type GradientTokenValue = FillGradient;

export interface DesignToken {
  id: string;
  name: string;
  type: DesignTokenType;
  value: DesignTokenValue;
  createdAt: string;
  updatedAt: string;
}

export function designTokenTimestamp(): string {
  return new Date().toISOString();
}

export function newDesignTokenId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isColorValue(v: unknown): v is ColorTokenValue {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.hex !== "string" || o.hex.length === 0) return false;
  if (o.dark != null) {
    const d = o.dark as Record<string, unknown>;
    if (typeof d.hex !== "string" || d.hex.length === 0) return false;
  }
  return true;
}

export function colorTokenHasDarkMode(value: ColorTokenValue): boolean {
  return Boolean(value.dark?.hex);
}

/** Resolve a library color token for the active canvas color mode. */
export function resolvedColorForMode(
  value: ColorTokenValue,
  mode: CanvasColorMode = "light",
): ColorTokenStop {
  if (mode === "dark" && value.dark?.hex) {
    return {
      hex: value.dark.hex,
      opacity: value.dark.opacity ?? value.opacity,
    };
  }
  return { hex: value.hex, opacity: value.opacity };
}

export function designTokensHaveDarkColorModes(tokens: Record<string, DesignToken>): boolean {
  return Object.values(tokens).some(
    (t) => t.type === "color" && isColorValue(t.value) && colorTokenHasDarkMode(t.value),
  );
}

export function isGradientValue(v: unknown): v is GradientTokenValue {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const kind = o.kind ?? o.type;
  if (kind !== "linear" && kind !== "radial" && kind !== "angular" && kind !== "diamond") return false;
  if (!Array.isArray(o.stops) || o.stops.length < 2) return false;
  const stopsOk = o.stops.every(
    (s) =>
      s &&
      typeof s === "object" &&
      typeof (s as { color?: unknown }).color === "string" &&
      typeof (s as { position?: unknown }).position === "number",
  );
  if (!stopsOk) return false;
  if (o.handles != null) {
    return (
      Array.isArray(o.handles) &&
      o.handles.length >= 3 &&
      o.handles.every(
        (h) =>
          h &&
          typeof h === "object" &&
          typeof (h as { x?: unknown }).x === "number" &&
          typeof (h as { y?: unknown }).y === "number",
      )
    );
  }
  return true;
}

export function isTypographyValue(v: unknown): v is TypographyTokenValue {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.fontFamily === "string" &&
    typeof o.fontSize === "number" &&
    typeof o.fontWeight === "number" &&
    typeof o.lineHeight === "number" &&
    typeof o.letterSpacing === "number"
  );
}

export function isSpacingValue(v: unknown): v is SpacingTokenValue {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.value === "number" && Number.isFinite(o.value);
}

export function isEffectValue(v: unknown): v is EffectTokenValue {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const hasLegacy = (typeof o.shadow === "string" && o.shadow.length > 0) || typeof o.blur === "number";
  const eff = o.effects;
  if (Array.isArray(eff) && eff.length > 0) {
    const ok = eff.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as NodeEffect).id === "string" &&
        typeof (item as NodeEffect).type === "string" &&
        typeof (item as NodeEffect).visible === "boolean",
    );
    return ok;
  }
  return hasLegacy;
}

export function effectValueToCssShadow(v: EffectTokenValue): string | undefined {
  const layered = buildNodeEffectRenderStyle(v.effects, v.shadow?.trim() || undefined);
  if (layered.boxShadow) return layered.boxShadow;
  if (v.blur != null && v.blur > 0) {
    return `0 0 ${v.blur}px rgba(15, 23, 42, 0.35)`;
  }
  return undefined;
}

export function tokenValueSummary(t: DesignToken): string {
  switch (t.type) {
    case "color": {
      const v = t.value as ColorTokenValue;
      const op = v.opacity != null ? ` / ${Math.round((v.opacity ?? 1) * 100)}%` : "";
      if (v.dark?.hex) {
        const darkOp =
          v.dark.opacity != null ? ` / ${Math.round(v.dark.opacity * 100)}%` : "";
        return `${v.hex}${op} · dark ${v.dark.hex}${darkOp}`;
      }
      return `${v.hex}${op}`;
    }
    case "gradient": {
      const v = normalizeFillGradient(t.value as FillGradient);
      return `${v.kind} · ${v.stops.length} stops`;
    }
    case "typography": {
      const v = t.value as TypographyTokenValue;
      return `${v.fontFamily} ${v.fontSize}px / ${v.fontWeight}`;
    }
    case "spacing": {
      const v = t.value as SpacingTokenValue;
      return `${v.value}px`;
    }
    case "effect": {
      const v = t.value as EffectTokenValue;
      if (v.effects?.length) return summarizeEffectsList(v.effects);
      const bits = [v.shadow?.trim() || null, v.blur != null ? `blur ${v.blur}px` : null].filter(Boolean);
      return bits.join(" · ") || "—";
    }
    default:
      return "";
  }
}

/**
 * Merge linked design token values into a node for rendering / inspector (does not mutate the document).
 */
export function resolveNodeWithDesignTokens(
  node: EditorNode,
  tokens: Record<string, DesignToken>,
  colorMode: CanvasColorMode = "light",
  cssSources?: string[],
): EditorNode {
  let out: EditorNode = { ...node };

  const applyColorToken = (tokenId: string | undefined) => {
    if (!tokenId) return;
    const tok = tokens[tokenId];
    if (tok?.type !== "color" || !isColorValue(tok.value)) return;
    const v = resolvedColorForMode(tok.value, colorMode);
    if (node.type === "text") {
      out = {
        ...out,
        textColor: v.hex,
        fill: v.hex,
        fillOpacity: v.opacity ?? out.fillOpacity ?? 1,
      };
    } else {
      out = {
        ...out,
        fill: v.hex,
        fillOpacity: v.opacity ?? out.fillOpacity ?? 1,
      };
    }
  };

  if (node.type === "text") {
    applyColorToken(pickTextColorTokenId(node, tokens, cssSources, colorMode));
  } else {
    const fillColorTokenId = pickFillColorTokenId(node, tokens, cssSources, colorMode);
    if (fillColorTokenId) {
      applyColorToken(fillColorTokenId);
    } else if (node.fillTokenId) {
      const tok = tokens[node.fillTokenId];
      if (tok?.type === "color" && isColorValue(tok.value)) {
        applyColorToken(node.fillTokenId);
      } else if (tok?.type === "gradient" && isGradientValue(tok.value)) {
        const localStops = node.fillGradient?.stops;
        const gradient =
          localStops && localStops.length >= 2
            ? normalizeFillGradient(node.fillGradient, node.fill)
            : normalizeFillGradient(tok.value);
        out = {
          ...out,
          fillType: "gradient",
          fillGradient: gradient,
        };
      }
    }
  }

  if (node.type === "text" && node.textStyleTokenId) {
    const tok = tokens[node.textStyleTokenId];
    if (tok?.type === "typography" && isTypographyValue(tok.value)) {
      const v = tok.value;
      out = {
        ...out,
        fontFamily: v.fontFamily,
        fontSize: v.fontSize,
        fontWeight: v.fontWeight,
        lineHeight: v.lineHeight,
        lineHeightUnit: "percent" as const,
        letterSpacing: v.letterSpacing,
        letterSpacingUnit: "percent" as const,
      };
    }
  }

  if (node.effectTokenId) {
    const tok = tokens[node.effectTokenId];
    if (tok?.type === "effect" && isEffectValue(tok.value)) {
      const v = tok.value as EffectTokenValue;
      if (v.effects && v.effects.length > 0) {
        out = { ...out, effects: v.effects.map((e) => ({ ...e })) };
      } else {
        out = { ...out, effects: undefined };
      }
    }
  }

  return out;
}

/** After token linking, bake resolved token colors onto nodes for the import theme (matches code appearance). */
export function applyImportedTokenColorsToNodes(
  nodes: Record<string, EditorNode>,
  tokens: Record<string, DesignToken>,
  mode: CanvasColorMode = "light",
): Record<string, EditorNode> {
  const next: Record<string, EditorNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    const hasFill = node.fillEnabled !== false && Boolean(node.fill?.trim());
    if (!node.fillTokenId && node.type !== "text" && !hasFill) {
      next[id] = node;
      continue;
    }
    const resolved = resolveNodeWithDesignTokens(node, tokens, mode);
    const patch: Partial<EditorNode> = {};
    if (hasFill || node.fillTokenId) {
      if (resolved.fill) patch.fill = resolved.fill;
      if (resolved.fillOpacity != null) patch.fillOpacity = resolved.fillOpacity;
    }
    if (node.type === "text") {
      if (resolved.textColor) patch.textColor = resolved.textColor;
      if (resolved.fill) patch.fill = resolved.fill;
    }
    next[id] = Object.keys(patch).length > 0 ? { ...node, ...patch } : node;
  }
  return next;
}

/** Gradient for editing / canvas handles — merges linked style tokens with local overrides. */
export function resolveNodeFillGradientForEdit(
  node: EditorNode,
  tokens: Record<string, DesignToken>,
): FillGradient {
  return resolveEditableFillGradient(resolveNodeWithDesignTokens(node, tokens));
}

/**
 * When the node uses a rich effect token (`effects` array on the token), any legacy `shadow` string on the same token
 * is appended in `buildNodeEffectRenderStyle` — use this as the second argument when the resolved node already has `effects`.
 */
export function legacyEffectShadowAppend(node: EditorNode, tokens: Record<string, DesignToken>): string | undefined {
  if (!node.effectTokenId) return undefined;
  const tok = tokens[node.effectTokenId];
  if (tok?.type !== "effect" || !isEffectValue(tok.value)) return undefined;
  const v = tok.value as EffectTokenValue;
  if (v.effects?.length) return v.shadow?.trim() || undefined;
  return undefined;
}

export function resolveEffectBoxShadow(node: EditorNode, tokens: Record<string, DesignToken>): string | undefined {
  if (!node.effectTokenId) return undefined;
  const tok = tokens[node.effectTokenId];
  if (tok?.type !== "effect" || !isEffectValue(tok.value)) return undefined;
  const v = tok.value as EffectTokenValue;
  if (v.effects && v.effects.length > 0) {
    return buildNodeEffectRenderStyle(v.effects, v.shadow?.trim() || undefined).boxShadow;
  }
  return effectValueToCssShadow(v);
}

export type DetachableTokenKind = "color" | "gradient" | "typography" | "effect";
