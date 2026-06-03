import type { FigImportResult } from "./figToPaytmCraft";
import { convertFigBytesToPaytmCraft } from "./figToPaytmCraft";
import type { FigImportWorkerRequest, FigImportWorkerResponse } from "./figImport.worker";

let worker: Worker | null = null;
let jobSeq = 0;

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function getFigImportWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./figImport.worker.ts", import.meta.url));
    return worker;
  } catch (e) {
    console.warn("[Paytm Craft] Fig import worker unavailable, using main thread", e);
    return null;
  }
}

/**
 * Parse and convert a .fig file without blocking the UI thread when Web Workers are available.
 */
export async function convertFigFileAsync(
  bytes: Uint8Array,
  fileName: string,
): Promise<FigImportResult> {
  await yieldToMain();

  const w = getFigImportWorker();
  if (!w) {
    return convertFigBytesToPaytmCraft(bytes, fileName);
  }

  const id = ++jobSeq;
  const copy = bytes.slice();

  return new Promise<FigImportResult>((resolve, reject) => {
    const onMessage = (event: MessageEvent<FigImportWorkerResponse>) => {
      if (event.data.id !== id) return;
      cleanup();
      resolve(event.data.result);
    };

    const onError = (event: ErrorEvent) => {
      cleanup();
      reject(event.error ?? new Error("Fig import worker failed"));
    };

    const cleanup = () => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
    };

    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);

    const payload: FigImportWorkerRequest = { id, bytes: copy, fileName };
    w.postMessage(payload, [copy.buffer]);
  });
}
