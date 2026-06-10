import { clamp01, hexToRgb } from "@/lib/color";
import { angularStopPositionFromLocalPoint, type FillGradient, type GradientStop } from "@/lib/fillGradient";

/** Interpolate gradient stop color at position 0–100. */
export function interpolateGradientStopColor(
  stops: GradientStop[],
  position: number,
  opacity = 1,
): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) return `rgba(0,0,0,${opacity})`;
  if (position <= sorted[0]!.position) {
    return stopToRgba(sorted[0]!.color, opacity);
  }
  if (position >= sorted[sorted.length - 1]!.position) {
    return stopToRgba(sorted[sorted.length - 1]!.color, opacity);
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (position >= a.position && position <= b.position) {
      const span = b.position - a.position || 1;
      const t = (position - a.position) / span;
      return lerpStopRgba(a.color, b.color, t, opacity);
    }
  }
  return stopToRgba(sorted[0]!.color, opacity);
}

function stopToRgba(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${opacity})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`;
}

function lerpStopRgba(aHex: string, bHex: string, t: number, opacity: number): string {
  const a = hexToRgb(aHex) ?? { r: 0, g: 0, b: 0 };
  const b = hexToRgb(bHex) ?? { r: 255, g: 255, b: 255 };
  const u = clamp01(t);
  const r = Math.round(a.r + (b.r - a.r) * u);
  const g = Math.round(a.g + (b.g - a.g) * u);
  const bl = Math.round(a.b + (b.b - a.b) * u);
  return `rgba(${r},${g},${bl},${opacity})`;
}

function parseRgba(css: string): { r: number; g: number; b: number; a: number } {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return { r: 0, g: 0, b: 0, a: 1 };
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] != null ? Number(m[4]) : 1,
  };
}

/** Fill RGBA image data for an angular (conic) gradient. */
export function fillAngularImageData(
  data: Uint8ClampedArray,
  g: FillGradient,
  width: number,
  height: number,
  opacity: number,
): void {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  const t = g.transform;
  const cx = t.cx * width;
  const cy = t.cy * height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pos = angularStopPositionFromLocalPoint(t, x, y, width, height);
      const css = interpolateGradientStopColor(g.stops, pos, opacity);
      const { r, gch, b, a } = parseRgbaNamed(css);
      const idx = (y * w + x) * 4;
      data[idx] = r;
      data[idx + 1] = gch;
      data[idx + 2] = b;
      data[idx + 3] = Math.round(a * 255);
    }
  }
}

function parseRgbaNamed(css: string) {
  const p = parseRgba(css);
  return { r: p.r, gch: p.g, b: p.b, a: p.a };
}

/** Fill RGBA image data for a diamond (bilinear) gradient. */
export function fillDiamondImageData(
  data: Uint8ClampedArray,
  g: FillGradient,
  width: number,
  height: number,
  opacity: number,
): void {
  const iw = Math.max(1, Math.ceil(width));
  const ih = Math.max(1, Math.ceil(height));
  const t = g.transform;
  const cx = t.cx * width;
  const cy = t.cy * height;
  const hw = (t.width * width) / 2;
  const hh = (t.height * height) / 2;
  const rad = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const sampleColor = (pos: number) => {
    for (let i = g.stops.length - 1; i >= 0; i--) {
      if (g.stops[i]!.position <= pos) return g.stops[i]!.color;
    }
    return g.stops[0]!.color;
  };
  const cTop = hexToRgb(sampleColor(0)) ?? { r: 0, g: 0, b: 0 };
  const cRight = hexToRgb(sampleColor(33)) ?? cTop;
  const cBottom = hexToRgb(sampleColor(66)) ?? cRight;
  const cLeft = hexToRgb(sampleColor(100)) ?? cBottom;

  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const idx = (y * iw + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      const u = lx / hw;
      const v = ly / hh;
      if (Math.abs(u) + Math.abs(v) > 1) {
        data[idx + 3] = 0;
        continue;
      }
      const tu = (u + 1) / 2;
      const tv = (v + 1) / 2;
      data[idx] = Math.round(
        cTop.r * (1 - tu) * (1 - tv) +
          cRight.r * tu * (1 - tv) +
          cLeft.r * (1 - tu) * tv +
          cBottom.r * tu * tv,
      );
      data[idx + 1] = Math.round(
        cTop.g * (1 - tu) * (1 - tv) +
          cRight.g * tu * (1 - tv) +
          cLeft.g * (1 - tu) * tv +
          cBottom.g * tu * tv,
      );
      data[idx + 2] = Math.round(
        cTop.b * (1 - tu) * (1 - tv) +
          cRight.b * tu * (1 - tv) +
          cLeft.b * (1 - tu) * tv +
          cBottom.b * tu * tv,
      );
      data[idx + 3] = Math.round(opacity * 255);
    }
  }
}

/** Build a PNG data URL for angular/diamond gradients (browser only). */
export function gradientRasterDataUrl(
  g: FillGradient,
  width: number,
  height: number,
  opacity: number,
): string | null {
  if (typeof document === "undefined") return null;
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(w, h);
  if (g.kind === "angular") {
    fillAngularImageData(image.data, g, width, height, opacity);
  } else if (g.kind === "diamond") {
    fillDiamondImageData(image.data, g, width, height, opacity);
  } else {
    return null;
  }
  ctx.putImageData(image, 0, 0);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
