import { convertFigBytesToPaytmCraft, type FigImportResult } from "./figToPaytmCraft";

export type FigImportWorkerRequest = {
  id: number;
  bytes: Uint8Array;
  fileName: string;
};

export type FigImportWorkerResponse =
  | { id: number; ok: true; buffer: ArrayBuffer }
  | { id: number; ok: false; error: string };

self.onmessage = (event: MessageEvent<FigImportWorkerRequest>) => {
  const { id, bytes, fileName } = event.data;
  try {
    const result = convertFigBytesToPaytmCraft(bytes, fileName);
    const json = JSON.stringify(result);
    const buffer = new TextEncoder().encode(json).buffer;
    const response: FigImportWorkerResponse = { id, ok: true, buffer };
    self.postMessage(response, [buffer]);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fig import worker failed";
    const response: FigImportWorkerResponse = { id, ok: false, error: message };
    self.postMessage(response);
  }
};
