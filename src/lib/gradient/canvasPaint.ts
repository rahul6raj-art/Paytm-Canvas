import { clamp01, hexToRgb, normalizeHex } from "@/lib/color";
import type { FillGradient, FillPaintNode, GradientStop } from "./types";
import { gradientTAtLocal } from "./handles";
import { effectiveFillType, gradientStopEffectiveOpacity, normalizeFillGradient, sortStops } from "./model";
import { resolveSolidFillCss } from "./cssPaint";

export type GradientPaintContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function sampleStopsRgba(stops: GradientStop[], t: number, globalOpacity: number): string {
  const sorted = sortStops(stops);
  if (sorted.length === 0) return "rgba(136,136,136,1)";
  const pos = clamp01(t);
  const first = sorted[0]!;
  if (pos <= first.position / 100) {
    const rgb = hexToRgb(first.color);
    const op = gradientStopEffectiveOpacity(first, globalOpacity);
    return rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${op})` : first.color;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    const pa = a.position / 100;
    const pb = b.position / 100;
    if (pos <= pb) {
      const span = pb - pa || 0.0001;
      const u = (pos - pa) / span;
      const ca = hexToRgb(a.color);
      const cb = hexToRgb(b.color);
      if (!ca || !cb) return a.color;
      const oa = gradientStopEffectiveOpacity(a, globalOpacity);
      const ob = gradientStopEffectiveOpacity(b, globalOpacity);
      const r = Math.round(lerp(ca.r, cb.r, u));
      const g = Math.round(lerp(ca.g, cb.g, u));
      const bl = Math.round(lerp(ca.b, cb.b, u));
      const al = lerp(oa, ob, u);
      return `rgba(${r},${g},${bl},${al})`;
    }
  }
  const last = sorted[sorted.length - 1]!;
  const rgb = hexToRgb(last.color);
  const op = gradientStopEffectiveOpacity(last, globalOpacity);
  return rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${op})` : last.color;
}

function stopColorRgba(stop: GradientStop, globalOpacity: number): string {
  const rgb = hexToRgb(stop.color);
  const op = gradientStopEffectiveOpacity(stop, globalOpacity);
  if (!rgb) return stop.color;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${op})`;
}

function createCanvasGradient(
  ctx: GradientPaintContext,
  g: FillGradient,
  width: number,
  height: number,
  globalOpacity: number,
): CanvasGradient | null {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const [h0, h1] = g.handles;

  if (g.kind === "linear") {
    const grad = ctx.createLinearGradient(h0.x * w, h0.y * h, h1.x * w, h1.y * h);
    for (const s of sortStops(g.stops)) {
      grad.addColorStop(s.position / 100, stopColorRgba(s, globalOpacity));
    }
    return grad;
  }

  if (g.kind === "radial") {
    const cx = h0.x * w;
    const cy = h0.y * h;
    const r = Math.hypot((h1.x - h0.x) * w, (h1.y - h0.y) * h);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r));
    for (const s of sortStops(g.stops)) {
      grad.addColorStop(s.position / 100, stopColorRgba(s, globalOpacity));
    }
    return grad;
  }

  return null;
}

export function createGradientFillPattern(
  ctx: GradientPaintContext,
  node: FillPaintNode,
  width: number,
  height: number,
): CanvasPattern | null {
  if (effectiveFillType(node) !== "gradient" || !node.fillGradient) return null;
  const g = normalizeFillGradient(node.fillGradient, node.fill);
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const opacity = node.fillOpacity ?? 1;

  if (g.kind === "linear" || g.kind === "radial") {
    const grad = createCanvasGradient(ctx, g, w, h, opacity);
    if (!grad) return null;
    const off =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(w, h)
        : (() => {
            const c = document.createElement("canvas");
            c.width = w;
            c.height = h;
            return c;
          })();
    const octx = off.getContext("2d");
    if (!octx) return null;
    octx.fillStyle = grad;
    octx.fillRect(0, 0, w, h);
    return ctx.createPattern(off as unknown as CanvasImageSource, "no-repeat");
  }

  const off =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : (() => {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          return c;
        })();
  const octx = off.getContext("2d");
  if (!octx) return null;
  const img = octx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = gradientTAtLocal(g.kind, x / w, y / h, g.handles);
      const css = sampleStopsRgba(g.stops, t, opacity);
      const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      const idx = (y * w + x) * 4;
      if (m) {
        img.data[idx] = Number(m[1]);
        img.data[idx + 1] = Number(m[2]);
        img.data[idx + 2] = Number(m[3]);
        img.data[idx + 3] = Math.round(255 * (m[4] != null ? Number(m[4]) : 1));
      } else {
        const hex = normalizeHex(css) ?? "#888888";
        const rgb = hexToRgb(hex);
        img.data[idx] = rgb?.r ?? 136;
        img.data[idx + 1] = rgb?.g ?? 136;
        img.data[idx + 2] = rgb?.b ?? 136;
        img.data[idx + 3] = 255;
      }
    }
  }
  octx.putImageData(img, 0, 0);
  return ctx.createPattern(off as unknown as CanvasImageSource, "no-repeat");
}

export function paintFillOnCanvas(
  ctx: GradientPaintContext,
  node: FillPaintNode,
  width: number,
  height: number,
): boolean {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  if (node.fillEnabled === false) return false;

  if (effectiveFillType(node) === "gradient" && node.fillGradient) {
    const g = normalizeFillGradient(node.fillGradient, node.fill);
    const opacity = node.fillOpacity ?? 1;
    if (g.kind === "linear" || g.kind === "radial") {
      const grad = createCanvasGradient(ctx, g, w, h, opacity);
      if (grad) {
        ctx.fillStyle = grad;
        return true;
      }
    }
    const pattern = createGradientFillPattern(ctx, node, w, h);
    if (pattern) {
      ctx.fillStyle = pattern;
      return true;
    }
  }

  const css = resolveSolidFillCss(node);
  if (!css || css === "transparent") return false;
  ctx.fillStyle = css;
  return true;
}

export function paintGradientFillInBox(
  ctx: GradientPaintContext,
  node: FillPaintNode,
  width: number,
  height: number,
): boolean {
  if (!paintFillOnCanvas(ctx, node, width, height)) return false;
  ctx.fillRect(0, 0, Math.max(1, width), Math.max(1, height));
  return true;
}

export function createGradientPaintStyle(
  ctx: GradientPaintContext,
  node: FillPaintNode,
  width: number,
  height: number,
): CanvasGradient | CanvasPattern | null {
  if (effectiveFillType(node) !== "gradient" || !node.fillGradient) return null;
  const g = normalizeFillGradient(node.fillGradient, node.fill);
  if (g.kind === "linear" || g.kind === "radial") {
    return createCanvasGradient(ctx, g, width, height, node.fillOpacity ?? 1);
  }
  return createGradientFillPattern(ctx, node, width, height);
}

export function resolveCanvasStrokeStyle(
  ctx: GradientPaintContext,
  node: import("./types").StrokePaintNode,
  width: number,
  height: number,
): string | CanvasGradient | CanvasPattern {
  const fillNode: FillPaintNode = {
    fill: node.strokeColor,
    fillOpacity: node.strokeOpacity,
    fillEnabled: node.strokeEnabled,
    fillType: node.strokeType,
    fillGradient: node.strokeGradient,
  };
  const style = createGradientPaintStyle(ctx, fillNode, width, height);
  if (style) return style;
  return resolveSolidFillCss(fillNode);
}
