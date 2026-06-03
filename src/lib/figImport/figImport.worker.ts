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
  const result = convertFigBytesToPaytmCraft(bytes, fileName);
  const response: FigImportWorkerResponse = { id, result };
  self.postMessage(response);
};
