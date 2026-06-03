import { effectColorToRgba } from "@/lib/nodeEffects";
import type { EditorNode } from "@/stores/useEditorStore";

export type StrokeLinecap = "butt" | "round" | "square";
export type StrokeLinejoin = "miter" | "round" | "bevel";
export type StrokeStyleKind = "solid" | "dashed" | "dotted";
export type StrokeWidthProfile = "uniform";

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

export function resolveStrokeColor(
  node: Pick<EditorNode, "strokeColor" | "strokeOpacity">,
): string {
  return effectColorToRgba(node.strokeColor ?? "#0f172a", node.strokeOpacity ?? 1);
}

export function strokeIsVisible(
  node: Pick<EditorNode, "strokeWidth" | "strokeEnabled">,
): boolean {
  return (node.strokeWidth ?? 0) > 0 && node.strokeEnabled !== false;
}

export function resolveStrokeStyle(node: Pick<EditorNode, "strokeStyle">): StrokeStyleKind {
  return node.strokeStyle ?? "solid";
}

export function resolveStrokeDashLength(
  node: Pick<EditorNode, "strokeStyle" | "strokeWidth" | "strokeDashLength">,
): number {
  const style = resolveStrokeStyle(node);
  if (style === "solid") return 0;
  if (node.strokeDashLength != null) return Math.max(0, node.strokeDashLength);
  return defaultDashGapForStyle(style, node.strokeWidth ?? 1).dash;
}

export function resolveStrokeDashGap(
  node: Pick<EditorNode, "strokeStyle" | "strokeWidth" | "strokeDashGap">,
): number {
  const style = resolveStrokeStyle(node);
  if (style === "solid") return 0;
  if (node.strokeDashGap != null) return Math.max(0, node.strokeDashGap);
  return defaultDashGapForStyle(style, node.strokeWidth ?? 1).gap;
}

export function resolveStrokeLinecap(node: Pick<EditorNode, "strokeStyle" | "strokeLinecap">): StrokeLinecap {
  if (node.strokeLinecap) return node.strokeLinecap;
  const style = resolveStrokeStyle(node);
  if (style === "dotted") return "round";
  return "butt";
}

export function resolveStrokeLinejoin(node: Pick<EditorNode, "strokeLinejoin">): StrokeLinejoin {
  return node.strokeLinejoin ?? "miter";
}

export function resolveStrokeMiterAngle(node: Pick<EditorNode, "strokeMiterAngle">): number {
  return node.strokeMiterAngle ?? DEFAULT_STROKE_MITER_ANGLE;
}

/** SVG `stroke-miterlimit` from Figma-style miter angle (degrees). */
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

export function resolveStrokeDashArray(
  node: Pick<
    EditorNode,
    "strokeStyle" | "strokeWidth" | "strokeDashLength" | "strokeDashGap"
  >,
): string | undefined {
  const style = resolveStrokeStyle(node);
  if (style === "solid") return undefined;
  const dash = resolveStrokeDashLength(node);
  const gap = resolveStrokeDashGap(node);
  if (dash <= 0 && gap <= 0) return undefined;
  return `${dash} ${gap}`;
}

export type SvgStrokePresentation = {
  strokeDasharray?: string;
  strokeLinecap: StrokeLinecap;
  strokeLinejoin: StrokeLinejoin;
  strokeMiterlimit: number;
};

export function svgStrokePresentationFromNode(
  node: Pick<
    EditorNode,
    | "strokeStyle"
    | "strokeWidth"
    | "strokeDashLength"
    | "strokeDashGap"
    | "strokeLinecap"
    | "strokeLinejoin"
    | "strokeMiterAngle"
  >,
): SvgStrokePresentation {
  const strokeDasharray = resolveStrokeDashArray(node);
  const strokeLinejoin = resolveStrokeLinejoin(node);
  return {
    strokeDasharray,
    strokeLinecap: resolveStrokeLinecap(node),
    strokeLinejoin,
    strokeMiterlimit: resolveStrokeMiterLimit(node),
  };
}

/** React/SVG spread props for stroke presentation. */
export function svgStrokePropsFromNode(
  node: Pick<
    EditorNode,
    | "strokeStyle"
    | "strokeWidth"
    | "strokeDashLength"
    | "strokeDashGap"
    | "strokeLinecap"
    | "strokeLinejoin"
    | "strokeMiterAngle"
  >,
): {
  strokeDasharray?: string;
  strokeLinecap: StrokeLinecap;
  strokeLinejoin: StrokeLinejoin;
  strokeMiterlimit: number;
} {
  return svgStrokePresentationFromNode(node);
}

/** Canvas2D dash array from node stroke settings. */
export function canvasLineDashFromNode(
  node: Pick<
    EditorNode,
    "strokeStyle" | "strokeWidth" | "strokeDashLength" | "strokeDashGap"
  >,
): number[] {
  const style = resolveStrokeStyle(node);
  if (style === "solid") return [];
  return [resolveStrokeDashLength(node), resolveStrokeDashGap(node)];
}

export function applyCanvasStrokeStyle(
  ctx: CanvasRenderingContext2D,
  node: Pick<
    EditorNode,
    | "strokeStyle"
    | "strokeWidth"
    | "strokeDashLength"
    | "strokeDashGap"
    | "strokeLinecap"
    | "strokeLinejoin"
    | "strokeMiterAngle"
  >,
): void {
  const dash = canvasLineDashFromNode(node);
  ctx.setLineDash(dash);
  ctx.lineCap = resolveStrokeLinecap(node);
  ctx.lineJoin = resolveStrokeLinejoin(node);
  ctx.miterLimit = resolveStrokeMiterLimit(node);
}

export function strokeAttrsForSvgMarkup(
  node: Pick<
    EditorNode,
    | "strokeStyle"
    | "strokeWidth"
    | "strokeDashLength"
    | "strokeDashGap"
    | "strokeLinecap"
    | "strokeLinejoin"
    | "strokeMiterAngle"
  >,
): string {
  const p = svgStrokePresentationFromNode(node);
  const parts = [
    `stroke-linecap="${p.strokeLinecap}"`,
    `stroke-linejoin="${p.strokeLinejoin}"`,
    `stroke-miterlimit="${p.strokeMiterlimit}"`,
  ];
  if (p.strokeDasharray) parts.push(`stroke-dasharray="${p.strokeDasharray}"`);
  return parts.join(" ");
}
