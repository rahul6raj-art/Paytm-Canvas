import { effectColorToRgba } from "@/lib/nodeEffects";
import { effectiveStrokeType, svgStrokePaint, type StrokePaintNode } from "@/lib/fillGradient";
import {
  mergeStrokeIntoNode,
  migrateAllNodeStrokes,
  migrateNodeStroke,
  resolveStrokeSpec,
  strokeSpecCanvasDash,
  strokeSpecColorRgba,
  strokeSpecDashArray,
  strokeSpecIsVisible,
  type StrokeSpec,
} from "@/lib/strokeSpec";
import type { EditorNode } from "@/stores/useEditorStore";

export type { StrokeSpec, StrokeAlign } from "@/lib/strokeSpec";
export {
  DEFAULT_STROKE_SPEC,
  mergeStrokeIntoNode,
  migrateAllNodeStrokes,
  migrateNodeStroke,
  resolveStrokeSpec,
} from "@/lib/strokeSpec";

export type StrokeLinecap = "butt" | "round" | "square";
export type StrokeLinejoin = "miter" | "round" | "bevel";
export type StrokeStyleKind = "solid" | "dashed" | "dotted";
export type StrokeWidthProfile = "uniform" | "taper";

export type StrokeResolvableNode = Pick<
  EditorNode,
  | "stroke"
  | "strokeColor"
  | "strokeWidth"
  | "strokeOpacity"
  | "strokeEnabled"
  | "strokePosition"
  | "strokeType"
  | "strokeGradient"
  | "strokeStyle"
  | "strokeDashLength"
  | "strokeDashGap"
  | "strokeLinecap"
  | "strokeLinejoin"
  | "strokeMiterAngle"
  | "strokeWidthProfile"
>;

export type { StrokePaintNode } from "@/lib/fillGradient";
export { effectiveStrokeType, strokePaintCss, svgStrokePaint } from "@/lib/fillGradient";

/** Partial-side strokes taper at path ends unless explicitly uniform. */
export function resolveStrokeWidthProfile(
  node: Pick<EditorNode, "strokeWidthProfile">,
): StrokeWidthProfile {
  return node.strokeWidthProfile ?? "taper";
}

export const DEFAULT_STROKE_MITER_ANGLE = 28.967;
export const DEFAULT_STROKE_DASH_LENGTH = 2;
export const DEFAULT_STROKE_DASH_GAP = 2;

export function defaultDashGapForStyle(
  style: StrokeStyleKind,
  strokeWidth: number,
): { dash: number; gap: number } {
  const sw = Math.max(0.5, strokeWidth || 1);
  if (style === "dotted") return { dash: sw, gap: sw * 1.5 };
  if (style === "dashed") return { dash: Math.max(2, sw * 4), gap: Math.max(2, sw * 2) };
  return { dash: DEFAULT_STROKE_DASH_LENGTH, gap: DEFAULT_STROKE_DASH_GAP };
}

export function resolveStrokeColor(node: StrokeResolvableNode): string {
  return strokeSpecColorRgba(resolveStrokeSpec(node));
}

/** SVG stroke attribute: solid rgba or `url(#gradientId)` when defs are registered. */
export function resolveSvgStrokePaint(
  node: StrokeResolvableNode,
  opts?: {
    gradientId: string;
    width: number;
    height: number;
    registerGradient: (id: string, markup: string) => void;
  },
): string {
  if (!strokeIsVisible(node)) return "none";
  if (effectiveStrokeType(node) !== "gradient" || !opts) {
    return resolveStrokeColor(node);
  }
  return svgStrokePaint(node, opts);
}

export function strokeIsVisible(node: StrokeResolvableNode): boolean {
  return strokeSpecIsVisible(resolveStrokeSpec(node));
}

export function resolveStrokeStyle(node: StrokeResolvableNode): StrokeStyleKind {
  const spec = resolveStrokeSpec(node);
  if (!spec.dashPattern.length) return "solid";
  const w = spec.width || 1;
  if (spec.dashPattern[0] === w && spec.dashPattern[1] === w * 1.5) return "dotted";
  return "dashed";
}

export function resolveStrokeDashLength(node: StrokeResolvableNode): number {
  const spec = resolveStrokeSpec(node);
  return spec.dashPattern[0] ?? 0;
}

export function resolveStrokeDashGap(node: StrokeResolvableNode): number {
  const spec = resolveStrokeSpec(node);
  return spec.dashPattern[1] ?? 0;
}

export function resolveStrokeLinecap(node: StrokeResolvableNode): StrokeLinecap {
  return resolveStrokeSpec(node).cap;
}

export function resolveStrokeLinejoin(node: StrokeResolvableNode): StrokeLinejoin {
  return resolveStrokeSpec(node).join;
}

export function resolveStrokeMiterAngle(node: Pick<EditorNode, "strokeMiterAngle">): number {
  return node.strokeMiterAngle ?? DEFAULT_STROKE_MITER_ANGLE;
}

export function strokeMiterAngleToLimit(angleDeg: number): number {
  const halfRad = (angleDeg * Math.PI) / 360;
  const s = Math.sin(halfRad);
  if (!Number.isFinite(s) || s <= 0) return 4;
  return 1 / s;
}

export function resolveStrokeMiterLimit(node: Pick<EditorNode, "strokeMiterAngle" | "strokeLinejoin">): number {
  if (resolveStrokeLinejoin(node) !== "miter") return 4;
  return strokeMiterAngleToLimit(resolveStrokeMiterAngle(node));
}

export function resolveStrokeDashArray(node: StrokeResolvableNode): string | undefined {
  return strokeSpecDashArray(resolveStrokeSpec(node));
}

export type SvgStrokePresentation = {
  strokeDasharray?: string;
  strokeLinecap: StrokeLinecap;
  strokeLinejoin: StrokeLinejoin;
  strokeMiterlimit: number;
};

export function svgStrokePresentationFromNode(node: StrokeResolvableNode): SvgStrokePresentation {
  const spec = resolveStrokeSpec(node);
  const strokeLinejoin = spec.join;
  return {
    strokeDasharray: strokeSpecDashArray(spec),
    strokeLinecap: spec.cap,
    strokeLinejoin,
    strokeMiterlimit:
      strokeLinejoin !== "miter" ? 4 : strokeMiterAngleToLimit(resolveStrokeMiterAngle(node)),
  };
}

export function svgStrokePropsFromNode(node: StrokeResolvableNode): {
  strokeDasharray?: string;
  strokeLinecap: StrokeLinecap;
  strokeLinejoin: StrokeLinejoin;
  strokeMiterlimit: number;
} {
  return svgStrokePresentationFromNode(node);
}

export function canvasLineDashFromNode(node: StrokeResolvableNode): number[] {
  return strokeSpecCanvasDash(resolveStrokeSpec(node));
}

export function applyCanvasStrokeStyle(
  ctx: CanvasRenderingContext2D,
  node: StrokeResolvableNode,
): void {
  const spec = resolveStrokeSpec(node);
  ctx.setLineDash(strokeSpecCanvasDash(spec));
  ctx.lineCap = spec.cap;
  ctx.lineJoin = spec.join;
  ctx.miterLimit =
    spec.join !== "miter" ? 4 : strokeMiterAngleToLimit(resolveStrokeMiterAngle(node));
}

export function strokeAttrsForSvgMarkup(node: StrokeResolvableNode): string {
  const p = svgStrokePresentationFromNode(node);
  const parts = [
    `stroke-linecap="${p.strokeLinecap}"`,
    `stroke-linejoin="${p.strokeLinejoin}"`,
    `stroke-miterlimit="${p.strokeMiterlimit}"`,
  ];
  if (p.strokeDasharray) parts.push(`stroke-dasharray="${p.strokeDasharray}"`);
  return parts.join(" ");
}
