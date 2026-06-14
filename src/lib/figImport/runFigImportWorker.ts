import { FIG_IMPORT_WORKER_TIMEOUT_MS } from "@/lib/figImport/figImportConstants";
import type { FigImportResult } from "./figToPaytmCraft";

type FigImportWorkerMessage =
  | { id: number; ok: true; buffer: ArrayBuffer }
  | { id: number; ok: false; error: string };

let nextJobId = 0;

function parseWorkerResult(message: FigImportWorkerMessage): FigImportResult | null {
  if (!message.ok) {
    return { ok: false, error: message.error };
  }
  try {
    const json = new TextDecoder().decode(message.buffer);
    return JSON.parse(json) as FigImportResult;
  } catch (e) {
    console.warn("[Paytm Craft] fig import worker JSON parse failed", e);
    return null;
  }
}

/**
 * Parse + convert a .fig file off the main thread (sync path inside the worker).
 * Returns null when workers are unavailable or the job fails so callers can fall back.
 */
export async function convertFigBytesInWorker(
  bytes: Uint8Array,
  fileName: string,
): Promise<FigImportResult | null> {
  if (typeof Worker === "undefined" || typeof window === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    let worker: Worker | null = null;

    const finish = (result: FigImportResult | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      worker?.terminate();
      resolve(result);
    };

    const id = ++nextJobId;
    try {
      worker = new Worker(new URL("./figImport.worker.ts", import.meta.url));
    } catch (e) {
      console.warn("[Paytm Craft] fig import worker unavailable", e);
      finish(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      console.warn("[Paytm Craft] fig import worker timed out; using main thread");
      finish(null);
    }, FIG_IMPORT_WORKER_TIMEOUT_MS);

    worker.onerror = (e) => {
      console.warn("[Paytm Craft] fig import worker error", e);
      finish(null);
    };

    worker.onmessage = (event: MessageEvent<FigImportWorkerMessage>) => {
      if (event.data.id !== id) return;
      finish(parseWorkerResult(event.data));
    };

    const payload = new Uint8Array(bytes);
    try {
      worker.postMessage({ id, bytes: payload, fileName }, [payload.buffer]);
    } catch {
      try {
        worker.postMessage({ id, bytes: payload, fileName });
      } catch (e) {
        console.warn("[Paytm Craft] fig import worker postMessage failed", e);
        finish(null);
      }
    }
  });
}
