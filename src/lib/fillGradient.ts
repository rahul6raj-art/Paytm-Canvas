import type { EditorNode } from "@/stores/useEditorStore";

export type {
  FillType,
  GradientKind,
  GradientHandle,
  GradientHandles,
  GradientStop,
  GradientTransform,
  FillGradient,
  LegacyLinearFillGradient,
  PersistedFillGradient,
  FillPaintNode,
  StrokePaintNode,
} from "@/lib/gradient";

export {
  newGradientStopId,
  defaultFillGradient,
  normalizeFillGradient,
  cloneFillGradient,
  effectiveFillType,
  effectiveStrokeType,
  gradientKindUsesCssPaint,
  gradientStopEffectiveOpacity,
  gradientBarCss as gradientInspectorBarPaintCss,
  insertStopAtPosition,
  removeStop,
  updateStop,
  updateStopPreserveOrder,
  changeGradientKind,
  reverseGradientStops,
  setGradientAngle,
  gradientAngleDeg,
  gradientFingerprint,
  DEFAULT_GRADIENT_TRANSFORM,
} from "@/lib/gradient";

import {
  defaultFillGradient,
  normalizeFillGradient,
  cloneFillGradient,
  type FillGradient,
  type GradientHandle,
  type GradientHandles,
  type GradientKind,
} from "@/lib/gradient";
import { defaultHandlesForKind, stopPointOnLinearAxis, positionFromLinearAxisPoint, handlesToPixel, cssLinearAngleDeg, cssConicStartDeg, angularGradientT } from "@/lib/gradient/handles";

import { fillPaintCss, strokePaintCss, resolveSolidFillCss, gradientBarCss } from "@/lib/gradient/cssPaint";
import { svgFillPaint, svgStrokePaint } from "@/lib/gradient/svgPaint";

export { fillPaintCss, strokePaintCss, resolveSolidFillCss };

export function defaultGradientHandles(kind: GradientKind = "linear"): GradientHandles {
  return defaultHandlesForKind(kind);
}

export function serializeFillGradient(g: FillGradient) {
  return g;
}

export function handlesFromTransform(): GradientHandles {
  return defaultHandlesForKind("linear");
}

export function transformFromHandles(
  kind: GradientKind,
  handles: GradientHandles,
): import("@/lib/gradient").GradientTransform {
  const center =
    kind === "linear" ? (handles[2] ?? { x: 0.5, y: 0.5 }) : (handles[0] ?? { x: 0.5, y: 0.5 });
  const angle =
    kind === "angular" ? cssConicStartDeg(handles) : cssLinearAngleDeg(handles);
  return { cx: center.x, cy: center.y, width: 1, height: 1, rotation: angle };
}

export function syncTransformToHandles(fill: FillGradient): FillGradient {
  return { ...fill, transform: transformFromHandles(fill.kind, fill.handles) };
}

export function getGradientHandlePositions(g: FillGradient, width: number, height: number): GradientHandles {
  return handlesToPixel(g.handles, width, height);
}

export function updateGradientHandle(
  fill: FillGradient,
  handleIndex: number,
  normalized: GradientHandle,
): FillGradient {
  const handles = [...fill.handles] as GradientHandles;
  handles[handleIndex] = normalized;
  return syncTransformToHandles({ ...fill, handles });
}

export function gradientStopLocalPoint(
  g: FillGradient,
  stop: import("@/lib/gradient").GradientStop,
  width: number,
  height: number,
): { x: number; y: number } {
  return stopPointOnLinearAxis(stop.position, g.handles, width, height);
}

export function positionFromLocalPoint(
  g: FillGradient,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  return positionFromLinearAxisPoint(x, y, g.handles, width, height);
}

export function resolveEditableFillGradient(
  node: Pick<EditorNode, "fillGradient" | "fill">,
): FillGradient {
  return normalizeFillGradient(node.fillGradient, node.fill);
}

export function defaultStrokeGradient(fromColor?: string, kind: GradientKind = "linear"): FillGradient {
  return defaultFillGradient(fromColor ?? "#000000", kind);
}

export function normalizeStrokeGradient(
  g: FillGradient | undefined,
  fallbackColor?: string,
): FillGradient {
  return normalizeFillGradient(g, fallbackColor);
}

export { svgFillPaint, svgStrokePaint };

export function linearEndpoints(
  transform: import("@/lib/gradient").GradientTransform,
  width: number,
  height: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const rad = (transform.rotation * Math.PI) / 180;
  const cx = transform.cx * w;
  const cy = transform.cy * h;
  const len = Math.hypot(w, h) / 2;
  return {
    x1: cx - Math.cos(rad) * len,
    y1: cy - Math.sin(rad) * len,
    x2: cx + Math.cos(rad) * len,
    y2: cy + Math.sin(rad) * len,
  };
}

export function gradientEndpoints(angleDeg: number, width: number, height: number) {
  return linearEndpoints({ cx: 0.5, cy: 0.5, width: 1, height: 1, rotation: angleDeg }, width, height);
}

export function gradientTransformHandleLocalPoints(
  g: FillGradient,
  width: number,
  height: number,
): { start: { x: number; y: number }; end: { x: number; y: number }; center: { x: number; y: number } } {
  const handles = getGradientHandlePositions(g, width, height);
  return { start: handles[0]!, end: handles[1]!, center: handles[2]! };
}

export function angularGradientRingRadius(
  transform: import("@/lib/gradient").GradientTransform,
  width: number,
  height: number,
): number {
  return Math.hypot(width, height) * Math.max(transform.width, transform.height) * 0.5;
}

export function cssConicAngleFromAtan2Deg(atan2Deg: number): number {
  return ((atan2Deg + 90) % 360 + 360) % 360;
}

export function atan2DegFromCssConicAngle(cssAngleDeg: number): number {
  return cssAngleDeg - 90;
}

export function canvasConicStartAngleRad(rotationDeg: number): number {
  return ((rotationDeg - 90) * Math.PI) / 180;
}

export function angularStopPositionFromLocalPoint(
  g: FillGradient,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const lx = x / Math.max(1, width);
  const ly = y / Math.max(1, height);
  return Math.round(angularGradientT(lx, ly, g.handles) * 1000) / 10;
}

export function angularStopLocalPointFromPosition(
  g: FillGradient,
  position: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const [center, ref] = g.handles;
  const t = position / 100;
  const refAngle = Math.atan2(ref.y - center.y, ref.x - center.x);
  const angle = refAngle + t * Math.PI * 2;
  const r = 0.5;
  return {
    x: (center.x + Math.cos(angle) * r) * Math.max(1, width),
    y: (center.y + Math.sin(angle) * r) * Math.max(1, height),
  };
}
