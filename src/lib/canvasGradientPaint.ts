import { clamp01, hexToRgb, normalizeHex } from "@/lib/color";
import {
  canvasConicStartAngleRad,
  effectiveFillType,
  linearEndpoints,
  normalizeFillGradient,
  type FillPaintNode,
} from "@/lib/fillGradient";
import { fillAngularImageData, fillDiamondImageData } from "@/lib/gradientRaster";

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
        grad = ctx.createConicGradient(canvasConicStartAngleRad(t.rotation), t.cx * w, t.cy * h);
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
  const iw = Math.ceil(w);
  const ih = Math.ceil(h);
  const img = ctx.createImageData(iw, ih);
  fillAngularImageData(img.data, g, w, h, opacity);
  ctx.putImageData(img, 0, 0);
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
  fillDiamondImageData(img.data, g, w, h, opacity);
  ctx.putImageData(img, 0, 0);
}

export function resolveSolidFillCss(node: FillPaintNode): string {
  if (node.fillEnabled === false) return "transparent";
  const rgb = hexToRgb(node.fill ?? "#cccccc");
  const op = clamp01(node.fillOpacity ?? 1);
  if (!rgb) return node.fill ?? "transparent";
  return op >= 1 ? (normalizeHex(node.fill ?? "#cccccc") ?? "#cccccc") : `rgba(${rgb.r},${rgb.g},${rgb.b},${op})`;
}
