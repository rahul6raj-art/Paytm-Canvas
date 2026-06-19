import { paintGradientFillInBox } from "@/lib/gradient/canvasPaint";
import {
  effectiveFillType,
  gradientKindUsesCssPaint,
  normalizeFillGradient,
} from "@/lib/gradient/model";
import type { FillPaintNode, StrokePaintNode } from "@/lib/gradient/types";
import type { EditorAsset } from "@/lib/documentPersistence";
import { fillGradientCss } from "@/lib/gradient/cssPaint";
import { svgFillPaint } from "@/lib/gradient/svgPaint";
import {
  fillAssetIdForNode,
  registerAssetFillPattern,
  resolveFillAsset,
  videoFillUnderlayMarkup,
} from "@/lib/gradient/mediaFill";
import { effectiveStrokeType } from "@/lib/gradient/model";

export function gradientRenderScale(zoom = 1): number {
  if (!Number.isFinite(zoom) || zoom <= 1) return 1;
  return Math.min(4, Math.ceil(zoom));
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Rasterize angular/diamond gradients at higher resolution when zoomed in. */
export function registerHighResGradientPattern(
  node: FillPaintNode,
  width: number,
  height: number,
  patternId: string,
  registerDef: (markup: string) => void,
  renderScale: number,
): boolean {
  if (typeof document === "undefined") return false;
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const pw = Math.min(4096, Math.ceil(w * renderScale));
  const ph = Math.min(4096, Math.ceil(h * renderScale));
  const canvas = document.createElement("canvas");
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext("2d");
  if (!ctx || !paintGradientFillInBox(ctx, node, pw, ph)) return false;
  const dataUrl = canvas.toDataURL("image/png");
  registerDef(
    `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${w}" height="${h}">` +
      `<image href="${dataUrl}" width="${w}" height="${h}" preserveAspectRatio="none"/>` +
      `</pattern>`,
  );
  return true;
}

export function foreignObjectGradientMarkup(
  node: FillPaintNode,
  width: number,
  height: number,
): string {
  const g = node.fillGradient ? normalizeFillGradient(node.fillGradient, node.fill) : null;
  if (!g || !gradientKindUsesCssPaint(g.kind)) return "";
  const bg = fillGradientCss(g, node.fillOpacity ?? 1, width, height);
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  return (
    `<foreignObject x="0" y="0" width="${w}" height="${h}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;background:${escAttr(bg)}"/>` +
    `</foreignObject>`
  );
}

export type ShapeFillResolveInput = {
  node: FillPaintNode;
  width: number;
  height: number;
  nodeId: string;
  registerGradient: (id: string, markup: string) => void;
  renderScale?: number;
  assets?: Record<string, EditorAsset>;
};

export type ShapeFillResolveResult = {
  fillAttr: string;
  underlayMarkup: string;
};

export function resolveShapeFillAttr(input: ShapeFillResolveInput): ShapeFillResolveResult {
  const { node, width, height, nodeId, registerGradient, renderScale = 1, assets } = input;
  if (node.fillEnabled === false) {
    return { fillAttr: "none", underlayMarkup: "" };
  }

  const fillKind = effectiveFillType(node);
  const opacity = node.fillOpacity ?? 1;
  const fit = node.imageFitMode ?? "fill";

  if (fillKind === "image" || fillKind === "pattern") {
    const asset = resolveFillAsset(fillAssetIdForNode(node), assets);
    if (asset?.dataUrl) {
      const patternId = `pc-media-${nodeId}`;
      registerAssetFillPattern(
        patternId,
        asset.dataUrl,
        asset,
        width,
        height,
        opacity,
        fit,
        fillKind === "pattern",
        (markup) => registerGradient(patternId, markup),
      );
      return { fillAttr: `url(#${patternId})`, underlayMarkup: "" };
    }
  }

  if (fillKind === "video") {
    const asset = resolveFillAsset(node.fillVideoAssetId, assets);
    if (asset?.dataUrl) {
      return {
        fillAttr: "none",
        underlayMarkup: videoFillUnderlayMarkup(asset.dataUrl, width, height, opacity, fit),
      };
    }
  }

  if (fillKind !== "gradient" || !node.fillGradient) {
    const solid = svgFillPaint(node, {
      gradientId: `pc-grad-${nodeId}`,
      width,
      height,
      registerGradient,
    });
    return { fillAttr: solid, underlayMarkup: "" };
  }

  const g = normalizeFillGradient(node.fillGradient, node.fill);
  if (!gradientKindUsesCssPaint(g.kind)) {
    const fill = svgFillPaint(node, {
      gradientId: `pc-grad-${nodeId}`,
      width,
      height,
      registerGradient,
    });
    return { fillAttr: fill, underlayMarkup: "" };
  }

  const patternId = `pc-pat-${nodeId}`;
  const scale = Math.max(1, renderScale);
  if (registerHighResGradientPattern(node, width, height, patternId, (markup) => registerGradient(patternId, markup), scale)) {
    return { fillAttr: `url(#${patternId})`, underlayMarkup: "" };
  }

  return { fillAttr: "none", underlayMarkup: foreignObjectGradientMarkup(node, width, height) };
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

export type ShapeStrokeResolveInput = {
  node: StrokePaintNode;
  width: number;
  height: number;
  nodeId: string;
  registerGradient: (id: string, markup: string) => void;
  renderScale?: number;
  assets?: Record<string, EditorAsset>;
};

export type ShapeStrokeResolveResult = {
  strokeAttr: string;
  underlayMarkup: string;
};

export function resolveShapeStrokeAttr(input: ShapeStrokeResolveInput): ShapeStrokeResolveResult {
  const fillNode = strokeNodeAsFillNode(input.node);
  const fillResult = resolveShapeFillAttr({
    node: fillNode,
    width: input.width,
    height: input.height,
    nodeId: input.nodeId,
    registerGradient: input.registerGradient,
    renderScale: input.renderScale,
    assets: input.assets,
  });
  return {
    strokeAttr: fillResult.fillAttr,
    underlayMarkup: fillResult.underlayMarkup,
  };
}
