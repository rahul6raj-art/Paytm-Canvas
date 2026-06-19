import { effectiveFillType } from "@/lib/fillGradient";
import type { FillPaintNode, FillType } from "@/lib/gradient/types";
import { fillAssetIdForNode, resolveFillAsset } from "@/lib/gradient/mediaFill";
import type { EditorAsset } from "@/lib/documentPersistence";
import type { EditorNode } from "@/stores/useEditorStore";

/** Map a text node to the shared fill paint model (shapes use the same fields). */
export function textNodeAsFillPaint(
  node: Pick<
    EditorNode,
    | "fill"
    | "textColor"
    | "fillOpacity"
    | "fillEnabled"
    | "fillType"
    | "fillGradient"
    | "fillImageAssetId"
    | "fillVideoAssetId"
    | "fillPatternAssetId"
    | "imageFitMode"
  >,
): FillPaintNode {
  return {
    fill: node.fill ?? node.textColor ?? "#111111",
    fillOpacity: node.fillOpacity,
    fillEnabled: node.fillEnabled,
    fillType: node.fillType,
    fillGradient: node.fillGradient,
    fillImageAssetId: node.fillImageAssetId,
    fillVideoAssetId: node.fillVideoAssetId,
    fillPatternAssetId: node.fillPatternAssetId,
    imageFitMode: node.imageFitMode,
  };
}

/** Video and CSS-gradient underlays must be masked to glyph shapes in SVG. */
export function textFillNeedsMask(
  fillKind: FillType,
  fillAttr: string,
  underlayMarkup: string,
): boolean {
  return fillKind === "video" || (fillAttr === "none" && underlayMarkup.length > 0);
}

/** Preload image/video assets for masked text fills on the edit canvas. */
export async function loadTextMediaFill(
  node: Pick<
    EditorNode,
    | "fill"
    | "textColor"
    | "fillOpacity"
    | "fillEnabled"
    | "fillType"
    | "fillGradient"
    | "fillImageAssetId"
    | "fillVideoAssetId"
    | "fillPatternAssetId"
    | "imageFitMode"
  >,
  assets: Record<string, EditorAsset>,
): Promise<{ source: CanvasImageSource; width: number; height: number } | null> {
  if (typeof document === "undefined") return null;
  const paint = textNodeAsFillPaint(node);
  const kind = effectiveFillType(paint);
  if (kind !== "image" && kind !== "video" && kind !== "pattern") return null;
  const asset = resolveFillAsset(fillAssetIdForNode(paint), assets);
  if (!asset?.dataUrl) return null;

  if (kind === "video") {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.onloadeddata = () => {
        resolve({
          source: video,
          width: video.videoWidth || asset.width || 1,
          height: video.videoHeight || asset.height || 1,
        });
      };
      video.onerror = () => resolve(null);
      video.src = asset.dataUrl;
      void video.play().catch(() => resolve(null));
    });
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        source: img,
        width: img.naturalWidth || asset.width || 1,
        height: img.naturalHeight || asset.height || 1,
      });
    img.onerror = () => resolve(null);
    img.src = asset.dataUrl;
  });
}
