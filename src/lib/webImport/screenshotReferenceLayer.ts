import type { ImportWebSceneNode, ImportWebScreenshot } from "@/lib/webImport/types";

export function buildScreenshotReferenceLayer(
  screenshot: ImportWebScreenshot,
  pageWidth: number,
  pageHeight: number,
  assetId: string,
): ImportWebSceneNode {
  return {
    id: "web-screenshot-ref",
    type: "image",
    name: "Screenshot reference",
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    locked: true,
    visible: true,
    isImportReference: true,
    assetId,
    imageSrc: screenshot.dataUrl,
    opacity: 1,
  };
}
