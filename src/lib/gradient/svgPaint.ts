import { clamp01, fillCss } from "@/lib/color";
import type { FillGradient, FillPaintNode, GradientStop, StrokePaintNode } from "./types";
import { effectiveFillType, effectiveStrokeType, gradientStopEffectiveOpacity, normalizeFillGradient, sortStops } from "./model";
import { fillGradientCss, gradientKindUsesCssPaint } from "./cssPaint";

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stopMarkup(stops: GradientStop[], globalOpacity: number): string {
  return sortStops(stops)
    .map((s) => {
      const op = gradientStopEffectiveOpacity(s, globalOpacity);
      const color = escXml(s.color);
      const pos = clamp01(s.position / 100);
      return `<stop offset="${pos}" stop-color="${color}" stop-opacity="${op}"/>`;
    })
    .join("");
}

export function svgGradientDefMarkup(
  g: FillGradient,
  id: string,
  width: number,
  height: number,
  globalOpacity = 1,
): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const [h0, h1] = g.handles;
  const stops = stopMarkup(g.stops, globalOpacity);

  if (g.kind === "linear") {
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${h0.x * w}" y1="${h0.y * h}" x2="${h1.x * w}" y2="${h1.y * h}">${stops}</linearGradient>`;
  }

  if (g.kind === "radial") {
    const cx = h0.x * w;
    const cy = h0.y * h;
    const r = Math.hypot((h1.x - h0.x) * w, (h1.y - h0.y) * h);
    return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${Math.max(1, r)}" fx="${cx}" fy="${cy}">${stops}</radialGradient>`;
  }

  return "";
}

export function svgFillPaint(
  node: FillPaintNode,
  opts: {
    gradientId: string;
    width: number;
    height: number;
    registerGradient: (id: string, markup: string) => void;
  },
): string {
  if (node.fillEnabled === false) return "none";
  if (effectiveFillType(node) !== "gradient" || !node.fillGradient) {
    return fillCss(node.fill, node.fillOpacity, node.fillEnabled);
  }
  const g = normalizeFillGradient(node.fillGradient, node.fill);
  if (gradientKindUsesCssPaint(g.kind)) {
    return "none";
  }
  const markup = svgGradientDefMarkup(g, opts.gradientId, opts.width, opts.height, node.fillOpacity ?? 1);
  if (markup) opts.registerGradient(opts.gradientId, markup);
  return `url(#${opts.gradientId})`;
}

export function svgStrokePaint(
  node: StrokePaintNode,
  opts: {
    gradientId: string;
    width: number;
    height: number;
    registerGradient: (id: string, markup: string) => void;
  },
): string {
  return svgFillPaint(
    {
      fill: node.strokeColor,
      fillOpacity: node.strokeOpacity,
      fillEnabled: node.strokeEnabled,
      fillType: node.strokeType,
      fillGradient: node.strokeGradient,
    },
    opts,
  );
}

export function svgCssBackgroundForGradient(node: FillPaintNode, width: number, height: number): string | null {
  if (effectiveFillType(node) !== "gradient" || !node.fillGradient) return null;
  const g = normalizeFillGradient(node.fillGradient, node.fill);
  if (!gradientKindUsesCssPaint(g.kind)) return null;
  return fillGradientCss(g, node.fillOpacity ?? 1, width, height);
}
