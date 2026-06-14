import type { EditorNode } from "@/stores/useEditorStore";
import {
  newGradientStopId,
  normalizeFillGradient,
  type FillGradient,
  type GradientKind,
} from "@/lib/fillGradient";
import { DEFAULT_GRADIENT_TRANSFORM } from "@/lib/gradient/model";
import type { GradientHandles } from "@/lib/gradient/types";

export type FigmaGradientPaint = {
  type?: string | number;
  visible?: boolean;
  opacity?: number;
  gradientStops?: { position: number; color: { r: number; g: number; b: number; a?: number } }[];
  gradientHandlePositions?: { x: number; y: number }[];
};

export function figmaGradientKind(type: unknown): GradientKind | null {
  if (typeof type === "number") {
    const byNum: Record<number, GradientKind> = {
      1: "linear",
      2: "radial",
      3: "angular",
      4: "diamond",
    };
    return byNum[type] ?? null;
  }
  const s = String(type ?? "").toUpperCase();
  if (s === "GRADIENT_LINEAR") return "linear";
  if (s === "GRADIENT_RADIAL") return "radial";
  if (s === "GRADIENT_ANGULAR" || s === "GRADIENT_CONIC") return "angular";
  if (s === "GRADIENT_DIAMOND") return "diamond";
  return null;
}

export function figmaColorToHex(c: { r: number; g: number; b: number; a?: number }): string {
  const r = Math.round(Math.max(0, Math.min(1, c.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, c.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, c.b)) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function handlesFromFigma(
  positions: { x: number; y: number }[] | undefined,
  kind: GradientKind,
): GradientHandles {
  if (positions && positions.length >= 3) {
    return [
      { x: positions[0]!.x, y: positions[0]!.y },
      { x: positions[1]!.x, y: positions[1]!.y },
      { x: positions[2]!.x, y: positions[2]!.y },
    ];
  }
  return normalizeFillGradient(undefined, "#888888").handles;
}

export function fillGradientFromFigmaPaint(paint: FigmaGradientPaint): FillGradient | null {
  const kind = figmaGradientKind(paint.type);
  if (!kind || !paint.gradientStops?.length) return null;

  const stops = paint.gradientStops.map((s) => ({
    id: newGradientStopId(),
    color: figmaColorToHex(s.color),
    opacity: clamp01((paint.opacity ?? 1) * (s.color.a ?? 1)),
    position: Math.max(
      0,
      Math.min(100, s.position <= 1 ? s.position * 100 : s.position),
    ),
  }));
  if (stops.length < 2) return null;

  return normalizeFillGradient({
    kind,
    transform: { ...DEFAULT_GRADIENT_TRANSFORM },
    handles: handlesFromFigma(paint.gradientHandlePositions, kind),
    stops,
  });
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Topmost visible gradient paint → Craft fill fields. */
export function gradientFillFieldsFromPaints(
  paints: FigmaGradientPaint[] | undefined,
): Pick<EditorNode, "fillType" | "fillGradient" | "fill" | "fillOpacity"> {
  if (!paints?.length) return {};

  for (let i = paints.length - 1; i >= 0; i--) {
    const paint = paints[i]!;
    if (paint.visible === false) continue;
    if (!figmaGradientKind(paint.type)) continue;
    const fillGradient = fillGradientFromFigmaPaint(paint);
    if (!fillGradient) continue;
    const first = fillGradient.stops[0];
    return {
      fillType: "gradient",
      fillGradient,
      fill: first?.color,
      fillOpacity: first?.opacity ?? 1,
    };
  }
  return {};
}
