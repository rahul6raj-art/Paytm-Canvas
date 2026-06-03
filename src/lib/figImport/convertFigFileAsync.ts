import type { FigImportResult } from "./figToPaytmCraft";
import { convertFigBytesToPaytmCraftAsync } from "./figToPaytmCraft";
import { waitForNextPaint, type FigImportProgress } from "./figImportRuntime";

export type { FigImportProgress };

/**
 * Parse and convert a .fig file on the main thread with periodic yields.
 * (Web Workers were hanging in Next.js for large files — cooperative import is more reliable.)
 */
export async function convertFigFileAsync(
  bytes: Uint8Array,
  fileName: string,
  onProgress?: FigImportProgress,
): Promise<FigImportResult> {
  await waitForNextPaint();
  onProgress?.("Unpacking Figma archive…");
  return convertFigBytesToPaytmCraftAsync(bytes, fileName, onProgress);
}
