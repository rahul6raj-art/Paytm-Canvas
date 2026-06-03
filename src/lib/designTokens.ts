import type { EditorNode } from "@/stores/useEditorStore";
import type { NodeEffect } from "@/lib/nodeEffects";
import {
  buildNodeEffectRenderStyle,
  summarizeEffectsList,
} from "@/lib/nodeEffects";
import type { FillGradient } from "@/lib/fillGradient";
import { normalizeFillGradient } from "@/lib/fillGradient";

export type DesignTokenType = "color" | "gradient" | "typography" | "spacing" | "effect";

export interface ColorTokenValue {
  hex: string;
  opacity?: number;
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
  return typeof o.hex === "string" && o.hex.length > 0;
}

export function isGradientValue(v: unknown): v is GradientTokenValue {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const kind = o.kind;
  if (kind !== "linear" && kind !== "radial" && kind !== "angular" && kind !== "diamond") return false;
  if (!Array.isArray(o.stops) || o.stops.length < 2) return false;
  return o.stops.every(
    (s) =>
      s &&
      typeof s === "object" &&
      typeof (s as { color?: unknown }).color === "string" &&
      typeof (s as { position?: unknown }).position === "number",
  );
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
): EditorNode {
  let out: EditorNode = { ...node };

  if (node.fillTokenId) {
    const tok = tokens[node.fillTokenId];
    if (tok?.type === "color" && isColorValue(tok.value)) {
      const v = tok.value;
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
    } else if (tok?.type === "gradient" && isGradientValue(tok.value)) {
      out = {
        ...out,
        fillType: "gradient",
        fillGradient: normalizeFillGradient(tok.value),
      };
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
        letterSpacing: v.letterSpacing,
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
