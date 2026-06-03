import { convertFigBytesToPaytmCraft, type FigImportResult } from "./figToPaytmCraft";

export type FigImportWorkerRequest = {
  id: number;
  bytes: Uint8Array;
  fileName: string;
};

export type FigImportWorkerResponse = {
  id: number;
  result: FigImportResult;
};

self.onmessage = (event: MessageEvent<FigImportWorkerRequest>) => {
  const { id, bytes, fileName } = event.data;
  try {
    const result = convertFigBytesToPaytmCraft(bytes, fileName);
    const response: FigImportWorkerResponse = { id, result };
    self.postMessage(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fig import worker failed";
    const response: FigImportWorkerResponse = {
      id,
      result: { ok: false, error: message },
    };
    self.postMessage(response);
  }
};
