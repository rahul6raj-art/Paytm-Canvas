import { composeSvgTransform } from "@/lib/transformMath";
import type { FigMaskType } from "@/lib/mask/types";
import { svgSafeId } from "@/lib/svgMarkupCore";
import type { EditorNode } from "@/stores/useEditorStore";

export type AlphaMaskRenderInput = {
  groupId: string;
  maskId: string;
  maskNode: EditorNode;
  mode: FigMaskType;
  maskLayerMarkup: string;
  contentMarkup: string;
  idPrefix?: string;
};

export type AlphaMaskRenderResult = {
  defsMarkup: string;
  bodyMarkup: string;
  maskId: string;
};

/**
 * SVG alpha/luminance mask compositor.
 * Renders mask layer into `<mask>` and applies via `mask="url(#id)"` on content.
 */
export function renderAlphaMaskSvg(input: AlphaMaskRenderInput): AlphaMaskRenderResult {
  const safe = svgSafeId(input.groupId);
  const maskId = `${input.idPrefix ?? "pc-mask"}-alpha-${safe}`;
  const maskTypeAttr =
    input.mode === "LUMINANCE" ? ` style="mask-type:luminance"` : "";

  const tx = composeSvgTransform(input.maskNode);
  const maskInner = `<g transform="${tx}">${input.maskLayerMarkup}</g>`;

  const defsMarkup =
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"${maskTypeAttr}>` +
    `${maskInner}</mask>`;

  const bodyMarkup = `<g mask="url(#${maskId})">${input.contentMarkup}</g>`;

  return { defsMarkup, bodyMarkup, maskId };
}

/**
 * Offscreen canvas alpha compositor (destination-in).
 * Used when SVG mask cannot represent the mask faithfully (effects, nested raster).
 */
export function compositeAlphaMaskCanvas(
  contentCanvas: CanvasImageSource,
  maskCanvas: CanvasImageSource,
  width: number,
  height: number,
  mode: FigMaskType,
): HTMLCanvasElement | OffscreenCanvas {
  const W = Math.max(1, Math.ceil(width));
  const H = Math.max(1, Math.ceil(height));
  const out =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(W, H)
      : (() => {
          const c = document.createElement("canvas");
          c.width = W;
          c.height = H;
          return c;
        })();

  const ctx = out.getContext("2d");
  if (!ctx) return out;

  ctx.drawImage(contentCanvas, 0, 0, W, H);
  ctx.globalCompositeOperation = "destination-in";

  if (mode === "LUMINANCE" && typeof document !== "undefined") {
    const lum = document.createElement("canvas");
    lum.width = W;
    lum.height = H;
    const lctx = lum.getContext("2d");
    if (lctx) {
      lctx.drawImage(maskCanvas, 0, 0, W, H);
      const img = lctx.getImageData(0, 0, W, H);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const lumVal = 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = lumVal;
      }
      lctx.putImageData(img, 0, 0);
      ctx.drawImage(lum, 0, 0);
    } else {
      ctx.drawImage(maskCanvas, 0, 0, W, H);
    }
  } else {
    ctx.drawImage(maskCanvas, 0, 0, W, H);
  }

  ctx.globalCompositeOperation = "source-over";
  return out;
}
