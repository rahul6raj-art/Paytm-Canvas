import { clamp01, hexToRgb, normalizeHex } from "@/lib/color";
import {
  effectiveFillType,
  linearEndpoints,
  normalizeFillGradient,
  type FillPaintNode,
} from "@/lib/fillGradient";

function applyStopsToCanvasGradient(
  grad: CanvasGradient,
  stops: { color: string; position: number }[],
  opacity: number,
) {
  for (const s of stops) {
    const rgb = hexToRgb(s.color);
    const off = s.position / 100;
    if (rgb) {
      grad.addColorStop(off, `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`);
    } else {
      grad.addColorStop(off, s.color);
    }
  }
}

/** Paint a shape fill on canvas 2D context (PNG export). Returns true if gradient was painted. */
export function paintFillOnCanvas(
  ctx: CanvasRenderingContext2D,
  node: FillPaintNode,
  width: number,
  height: number,
): boolean {
  if (node.fillEnabled === false) return false;
  if (effectiveFillType(node) !== "gradient") return false;

  const g = normalizeFillGradient(node.fillGradient, node.fill);
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const opacity = clamp01(node.fillOpacity ?? 1);
  const t = g.transform;

  if (g.kind === "diamond") {
    paintDiamondBilinear(ctx, g, w, h, opacity);
    return true;
  }

  let grad: CanvasGradient | null = null;

  switch (g.kind) {
    case "linear": {
      const { x1, y1, x2, y2 } = linearEndpoints(t, w, h);
      grad = ctx.createLinearGradient(x1, y1, x2, y2);
      break;
    }
    case "radial": {
      const r = Math.max((t.width * w) / 2, (t.height * h) / 2);
      grad = ctx.createRadialGradient(t.cx * w, t.cy * h, 0, t.cx * w, t.cy * h, r);
      break;
    }
    case "angular": {
      if (typeof ctx.createConicGradient === "function") {
        grad = ctx.createConicGradient((t.rotation * Math.PI) / 180, t.cx * w, t.cy * h);
      }
      break;
    }
    default:
      break;
  }

  if (!grad) {
    if (g.kind === "angular") {
      paintAngularFallback(ctx, g, w, h, opacity);
      return true;
    }
    return false;
  }

  applyStopsToCanvasGradient(grad, g.stops, opacity);
  ctx.fillStyle = grad;
  return true;
}

function paintAngularFallback(
  ctx: CanvasRenderingContext2D,
  g: ReturnType<typeof normalizeFillGradient>,
  w: number,
  h: number,
  opacity: number,
) {
  const cx = g.transform.cx * w;
  const cy = g.transform.cy * h;
  const slices = 72;
  for (let i = 0; i < slices; i++) {
    const a0 = ((g.transform.rotation + (i / slices) * 360) * Math.PI) / 180;
    const a1 = ((g.transform.rotation + ((i + 1) / slices) * 360) * Math.PI) / 180;
    const p = (i / slices) * 100;
    const stop = g.stops.findLast((s) => s.position <= p) ?? g.stops[0]!;
    const rgb = hexToRgb(stop.color);
    ctx.fillStyle = rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})` : stop.color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, Math.max(w, h), a0, a1);
    ctx.closePath();
    ctx.fill();
  }
}

function paintDiamondBilinear(
  ctx: CanvasRenderingContext2D,
  g: ReturnType<typeof normalizeFillGradient>,
  w: number,
  h: number,
  opacity: number,
) {
  const iw = Math.ceil(w);
  const ih = Math.ceil(h);
  const img = ctx.createImageData(iw, ih);
  const t = g.transform;
  const cx = t.cx * w;
  const cy = t.cy * h;
  const hw = (t.width * w) / 2;
  const hh = (t.height * h) / 2;
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
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      const u = lx / hw;
      const v = ly / hh;
      if (Math.abs(u) + Math.abs(v) > 1) continue;
      const tu = (u + 1) / 2;
      const tv = (v + 1) / 2;
      const r = Math.round(
        cTop.r * (1 - tu) * (1 - tv) +
          cRight.r * tu * (1 - tv) +
          cLeft.r * (1 - tu) * tv +
          cBottom.r * tu * tv,
      );
      const gch = Math.round(
        cTop.g * (1 - tu) * (1 - tv) +
          cRight.g * tu * (1 - tv) +
          cLeft.g * (1 - tu) * tv +
          cBottom.g * tu * tv,
      );
      const b = Math.round(
        cTop.b * (1 - tu) * (1 - tv) +
          cRight.b * tu * (1 - tv) +
          cLeft.b * (1 - tu) * tv +
          cBottom.b * tu * tv,
      );
      const idx = (y * iw + x) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = gch;
      img.data[idx + 2] = b;
      img.data[idx + 3] = Math.round(opacity * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function resolveSolidFillCss(node: FillPaintNode): string {
  if (node.fillEnabled === false) return "transparent";
  const rgb = hexToRgb(node.fill ?? "#cccccc");
  const op = clamp01(node.fillOpacity ?? 1);
  if (!rgb) return node.fill ?? "transparent";
  return op >= 1 ? (normalizeHex(node.fill ?? "#cccccc") ?? "#cccccc") : `rgba(${rgb.r},${rgb.g},${rgb.b},${op})`;
}
