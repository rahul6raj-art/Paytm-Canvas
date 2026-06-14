import type { EditorAsset } from "@/lib/documentPersistence";
import { clamp01 } from "@/lib/color";
import type { FillPaintNode } from "./types";
import { effectiveFillType } from "./model";

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function resolveFillAsset(
  assetId: string | undefined,
  assets?: Record<string, EditorAsset>,
): EditorAsset | undefined {
  if (!assetId || !assets) return undefined;
  return assets[assetId];
}

export function fillAssetIdForNode(node: FillPaintNode): string | undefined {
  const kind = effectiveFillType(node);
  if (kind === "image") return node.fillImageAssetId;
  if (kind === "video") return node.fillVideoAssetId;
  if (kind === "pattern") return node.fillPatternAssetId;
  return undefined;
}

export function mediaFillPreviewCss(
  node: FillPaintNode,
  assets?: Record<string, EditorAsset>,
): string | undefined {
  const asset = resolveFillAsset(fillAssetIdForNode(node), assets);
  if (!asset?.dataUrl) return undefined;
  const kind = effectiveFillType(node);
  if (kind === "pattern") {
    return `url("${asset.dataUrl}") repeat`;
  }
  const fit = node.imageFitMode ?? "fill";
  const size = fit === "fit" ? "contain" : "cover";
  return `url("${asset.dataUrl}") center / ${size} no-repeat`;
}

export function registerAssetFillPattern(
  patternId: string,
  dataUrl: string,
  asset: EditorAsset | undefined,
  shapeW: number,
  shapeH: number,
  opacity: number,
  fit: "fill" | "fit" | "crop",
  tiled: boolean,
  registerDef: (markup: string) => void,
): void {
  const w = Math.max(1, shapeW);
  const h = Math.max(1, shapeH);
  const href = escAttr(dataUrl);
  const op = clamp01(opacity);

  if (tiled) {
    const pw = Math.max(8, asset?.width ?? 32);
    const ph = Math.max(8, asset?.height ?? 32);
    registerDef(
      `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${pw}" height="${ph}">` +
        `<image href="${href}" width="${pw}" height="${ph}" opacity="${op}" preserveAspectRatio="xMidYMid slice"/>` +
        `</pattern>`,
    );
    return;
  }

  const par = fit === "fit" ? "xMidYMid meet" : fit === "crop" ? "xMidYMid slice" : "none";
  registerDef(
    `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${w}" height="${h}">` +
      `<image href="${href}" width="${w}" height="${h}" preserveAspectRatio="${par}" opacity="${op}"/>` +
      `</pattern>`,
  );
}

export function videoFillUnderlayMarkup(
  dataUrl: string,
  width: number,
  height: number,
  opacity: number,
  fit: "fill" | "fit" | "crop",
): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const objectFit = fit === "fit" ? "contain" : fit === "crop" ? "cover" : "fill";
  const href = escAttr(dataUrl);
  const op = clamp01(opacity);
  return (
    `<foreignObject x="0" y="0" width="${w}" height="${h}" opacity="${op}">` +
    `<video xmlns="http://www.w3.org/1999/xhtml" src="${href}" ` +
    `style="width:100%;height:100%;object-fit:${objectFit};display:block" ` +
    `autoplay loop muted playsinline />` +
    `</foreignObject>`
  );
}
