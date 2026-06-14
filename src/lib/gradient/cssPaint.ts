import { clamp01, fillCss, hexToRgb, normalizeHex } from "@/lib/color";
import type { EditorAsset } from "@/lib/documentPersistence";
import type { FillGradient, FillPaintNode, GradientStop, StrokePaintNode } from "./types";
import { cssConicStartDeg, cssLinearAngleDeg } from "./handles";
import { effectiveFillType, effectiveStrokeType, gradientKindUsesCssPaint, gradientStopEffectiveOpacity, normalizeFillGradient, sortStops } from "./model";
import { mediaFillPreviewCss } from "./mediaFill";

function stopToCss(stop: GradientStop, globalOpacity: number): string {
  const op = gradientStopEffectiveOpacity(stop, globalOpacity);
  const rgb = hexToRgb(stop.color);
  if (!rgb) return `${stop.color} ${stop.position}%`;
  if (op >= 1) return `${normalizeHex(stop.color) ?? stop.color} ${stop.position}%`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${op}) ${stop.position}%`;
}

function stopsCssList(stops: GradientStop[], globalOpacity: number): string {
  return sortStops(stops).map((s) => stopToCss(s, globalOpacity)).join(", ");
}

export function gradientBarCss(g: FillGradient, globalOpacity = 1): string {
  const stops = stopsCssList(g.stops, globalOpacity);
  switch (g.kind) {
    case "linear":
      return `linear-gradient(90deg, ${stops})`;
    case "radial":
      return `radial-gradient(circle at 50% 50%, ${stops})`;
    case "angular":
      return `conic-gradient(from 0deg at 50% 50%, ${stops})`;
    case "diamond":
      return `linear-gradient(135deg, ${stops})`;
    default:
      return `linear-gradient(90deg, ${stops})`;
  }
}

export function fillGradientCss(
  g: FillGradient,
  globalOpacity = 1,
  width = 100,
  height = 100,
): string {
  const stops = stopsCssList(g.stops, globalOpacity);
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const [h0, h1] = g.handles;
  switch (g.kind) {
    case "linear": {
      const angle = cssLinearAngleDeg(g.handles);
      return `linear-gradient(${angle}deg, ${stops})`;
    }
    case "radial": {
      const cx = h0.x * 100;
      const cy = h0.y * 100;
      const rx = Math.abs(h1.x - h0.x) * w;
      const ry = Math.abs(h1.y - h0.y) * h;
      const size = `${Math.max(rx, ry)}px ${Math.max(rx, ry)}px`;
      return `radial-gradient(ellipse ${size} at ${cx}% ${cy}%, ${stops})`;
    }
    case "angular": {
      const cx = h0.x * 100;
      const cy = h0.y * 100;
      const from = cssConicStartDeg(g.handles);
      return `conic-gradient(from ${from}deg at ${cx}% ${cy}%, ${stops})`;
    }
    case "diamond": {
      const angle = cssLinearAngleDeg(g.handles);
      return `linear-gradient(${angle}deg, ${stops})`;
    }
    default:
      return `linear-gradient(90deg, ${stops})`;
  }
}

export function fillPaintCss(node: FillPaintNode, assets?: Record<string, EditorAsset>): string {
  if (node.fillEnabled === false) return "transparent";
  const opacity = clamp01(node.fillOpacity ?? 1);
  const kind = effectiveFillType(node);
  if (kind === "image" || kind === "video" || kind === "pattern") {
    const preview = mediaFillPreviewCss(node, assets);
    if (preview) return preview;
  }
  if (kind === "gradient" && node.fillGradient) {
    const g = normalizeFillGradient(node.fillGradient, node.fill);
    return fillGradientCss(g, opacity);
  }
  return fillCss(node.fill ?? "#cccccc", opacity, true);
}

export function strokePaintCss(
  node: StrokePaintNode,
  assets?: Record<string, import("@/lib/documentPersistence").EditorAsset>,
): string {
  if (node.strokeEnabled === false) return "transparent";
  const opacity = clamp01(node.strokeOpacity ?? 1);
  const kind = effectiveStrokeType(node);
  if (kind === "image" || kind === "video") {
    const preview = mediaFillPreviewCss(strokeNodeAsFillNode(node), assets);
    if (preview) return preview;
  }
  if (kind === "gradient" && node.strokeGradient) {
    const g = normalizeFillGradient(node.strokeGradient, node.strokeColor);
    return fillGradientCss(g, opacity);
  }
  return fillCss(node.strokeColor ?? "#000000", opacity, true);
}

function strokeNodeAsFillNode(node: StrokePaintNode): FillPaintNode {
  return {
    fill: node.strokeColor,
    fillOpacity: node.strokeOpacity,
    fillEnabled: node.strokeEnabled,
    fillType: effectiveStrokeType(node),
    fillGradient: node.strokeGradient,
    fillImageAssetId: node.strokeImageAssetId,
    fillVideoAssetId: node.strokeVideoAssetId,
    imageFitMode: node.imageFitMode,
  };
}

export function resolveSolidFillCss(node: FillPaintNode): string {
  if (node.fillEnabled === false) return "transparent";
  const opacity = clamp01(node.fillOpacity ?? 1);
  if (effectiveFillType(node) === "gradient" && node.fillGradient?.stops?.[0]) {
    const s = node.fillGradient.stops[0];
    return fillCss(s.color, opacity * (s.opacity ?? 1), true);
  }
  return fillCss(node.fill ?? "#cccccc", opacity, true);
}

export { gradientKindUsesCssPaint };
