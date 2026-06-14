import type { FigImportResult } from "./figToPaytmCraft";
import { convertFigBytesToPaytmCraft } from "./figToPaytmCraft";
import { convertFigBytesInWorker } from "./runFigImportWorker";
import type { FigImportProgress } from "./figImportRuntime";

export type { FigImportProgress };

/**
 * Fast .fig import: worker thread when available, otherwise a single main-thread pass.
 * (Per-node cooperative yields were removed — they made large imports 10–50× slower.)
 */
export async function convertFigFileAsync(
  bytes: Uint8Array,
  fileName: string,
  onProgress?: FigImportProgress,
): Promise<FigImportResult> {
  onProgress?.("Unpacking Figma archive…");

  const workerResult = await convertFigBytesInWorker(bytes, fileName);
  if (workerResult) {
    if (workerResult.ok) {
      onProgress?.("Finalizing canvas…");
    }
    return workerResult;
  }

  onProgress?.("Converting layers…");
  const result = convertFigBytesToPaytmCraft(bytes, fileName);
  if (result.ok) {
    onProgress?.("Finalizing canvas…");
  }
  return result;
}
