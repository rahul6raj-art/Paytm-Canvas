import { DEFAULT_GRADIENT_TRANSFORM, newGradientStopId, type FillGradient } from "@/lib/fillGradient";
import { newNodeEffectId, type NodeEffect } from "@/lib/nodeEffects";
import type { FigmaColor, FigmaPaint } from "@/integrations/figma/types";
import { mergeStrokeIntoNode } from "@/lib/strokeSpec";
import type { EditorNode } from "@/stores/useEditorStore";
import type { FigmaApiNode } from "@/integrations/figma/types";

export function rgbaToHex(c: FigmaColor): string {
  const r = Math.round(Math.max(0, Math.min(1, c.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, c.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, c.b)) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function visiblePaints(paints?: FigmaPaint[]): FigmaPaint[] {
  if (!paints?.length) return [];
  return paints.filter((p) => p.visible !== false && p.type);
}

export function solidFromPaints(paints?: FigmaPaint[]): { fill?: string; fillOpacity?: number } {
  const p = visiblePaints(paints).find((x) => x.type === "SOLID" && x.color);
  if (!p?.color) return {};
  return {
    fill: rgbaToHex(p.color),
    fillOpacity: p.opacity ?? p.color.a ?? 1,
  };
}

export function gradientFromPaints(paints?: FigmaPaint[]): {
  fillType?: "gradient";
  fillGradient?: FillGradient;
} {
  const p = visiblePaints(paints).find((x) => x.type === "GRADIENT_LINEAR" && x.gradientStops?.length);
  if (!p?.gradientStops) return {};
  const handles = p.gradientHandlePositions;
  let rotation = 0;
  if (handles && handles.length >= 2) {
    const dx = handles[1]!.x - handles[0]!.x;
    const dy = handles[1]!.y - handles[0]!.y;
    rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  }
  return {
    fillType: "gradient",
    fillGradient: {
      kind: "linear",
      transform: { ...DEFAULT_GRADIENT_TRANSFORM, rotation },
      stops: p.gradientStops.map((s) => ({
        id: newGradientStopId(),
        position: s.position,
        color: rgbaToHex(s.color),
        opacity: s.color.a ?? 1,
      })),
    },
  };
}

export function imageRefFromPaints(paints?: FigmaPaint[]): string | undefined {
  const p = visiblePaints(paints).find((x) => x.type === "IMAGE" && x.imageRef);
  return p?.imageRef;
}

export function effectsFromApi(raw: unknown[] | undefined): NodeEffect[] | undefined {
  if (!raw?.length) return undefined;
  const out: NodeEffect[] = [];
  for (const e of raw) {
    const eff = e as {
      type?: string;
      visible?: boolean;
      color?: FigmaColor;
      opacity?: number;
      offset?: { x?: number; y?: number };
      radius?: number;
      spread?: number;
    };
    if (eff.visible === false) continue;
    const type = String(eff.type ?? "");
    if (type === "DROP_SHADOW" || type === "INNER_SHADOW") {
      out.push({
        id: newNodeEffectId(),
        type: type === "INNER_SHADOW" ? "inner-shadow" : "drop-shadow",
        visible: true,
        x: eff.offset?.x ?? 0,
        y: eff.offset?.y ?? 0,
        blur: Math.max(0, eff.radius ?? 0),
        spread: eff.spread ?? 0,
        color: eff.color ? rgbaToHex(eff.color) : "#000000",
        opacity: eff.opacity ?? eff.color?.a ?? 0.25,
      });
    } else if (type === "LAYER_BLUR" || type === "BACKGROUND_BLUR") {
      const blur = eff.radius ?? 0;
      if (blur > 0) {
        out.push({
          id: newNodeEffectId(),
          type: type === "BACKGROUND_BLUR" ? "background-blur" : "layer-blur",
          visible: true,
          blur,
        });
      }
    }
  }
  return out.length ? out : undefined;
}

function mapFigmaStrokeAlign(
  align: FigmaApiNode["strokeAlign"],
): EditorNode["strokePosition"] | undefined {
  if (align === "INSIDE") return "inside";
  if (align === "OUTSIDE") return "outside";
  if (align === "CENTER") return "center";
  return undefined;
}

function strokeSidesFromIndividualWeights(
  weights: NonNullable<FigmaApiNode["individualStrokeWeights"]>,
  fallbackWeight: number,
): Pick<EditorNode, "strokeSides" | "strokeSidesCustom" | "strokeWidth"> | null {
  const custom = {
    top: Math.max(0, weights.top ?? 0),
    right: Math.max(0, weights.right ?? 0),
    bottom: Math.max(0, weights.bottom ?? 0),
    left: Math.max(0, weights.left ?? 0),
  };
  const maxW = Math.max(custom.top, custom.right, custom.bottom, custom.left);
  if (maxW <= 0) return null;
  const allOn =
    custom.top > 0 && custom.right > 0 && custom.bottom > 0 && custom.left > 0;
  const uniform =
    custom.top === custom.right &&
    custom.right === custom.bottom &&
    custom.bottom === custom.left;
  return {
    strokeWidth: fallbackWeight > 0 ? fallbackWeight : maxW,
    strokeSides: allOn && uniform ? "all" : "custom",
    strokeSidesCustom: custom,
  };
}

export function strokeFromFigmaNode(node: FigmaApiNode): Partial<EditorNode> {
  const solid = solidFromPaints(node.strokes);
  const weight = node.strokeWeight ?? 0;
  const perSide = node.individualStrokeWeights
    ? strokeSidesFromIndividualWeights(node.individualStrokeWeights, weight)
    : null;
  if (!solid.fill && weight <= 0 && !perSide) return {};
  const position = mapFigmaStrokeAlign(node.strokeAlign);
  const legacy: Partial<EditorNode> = {
    strokeColor: solid.fill ?? "#000000",
    strokeWidth: perSide?.strokeWidth ?? weight,
    strokeEnabled: true,
    ...(perSide
      ? { strokeSides: perSide.strokeSides, strokeSidesCustom: perSide.strokeSidesCustom }
      : {}),
    ...(position ? { strokePosition: position } : {}),
  };
  return mergeStrokeIntoNode(legacy, legacy);
}

export function cornerRadiusFromFigmaNode(
  node: FigmaApiNode,
): Pick<EditorNode, "cornerRadius" | "cornerRadii"> {
  const corners = node.rectangleCornerRadii;
  if (corners?.length === 4) {
    const [tl, tr, br, bl] = corners;
    if (tl === tr && tr === br && br === bl) return { cornerRadius: tl };
    return { cornerRadii: [tl, tr, br, bl] };
  }
  if (node.cornerRadius != null) return { cornerRadius: node.cornerRadius };
  return {};
}
