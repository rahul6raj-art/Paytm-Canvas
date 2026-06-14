import * as Y from "yjs";
import {
  validatePaytmCraftDocument,
  type PaytmCraftDocument,
} from "@/lib/documentPersistence";

export const YDOC_MAP_NAME = "craft";
export const YDOC_DOCUMENT_KEY = "documentJson";

export function createDocumentYDoc(): Y.Doc {
  return new Y.Doc();
}

export function readDocumentFromYDoc(ydoc: Y.Doc): PaytmCraftDocument | null {
  const raw = ydoc.getMap(YDOC_MAP_NAME).get(YDOC_DOCUMENT_KEY);
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!validatePaytmCraftDocument(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDocumentToYDoc(ydoc: Y.Doc, document: PaytmCraftDocument): void {
  ydoc.transact(() => {
    ydoc.getMap(YDOC_MAP_NAME).set(YDOC_DOCUMENT_KEY, JSON.stringify(document));
  });
}

export function observeDocumentYDoc(
  ydoc: Y.Doc,
  onChange: (document: PaytmCraftDocument | null) => void,
): () => void {
  const map = ydoc.getMap(YDOC_MAP_NAME);
  const handler = () => {
    onChange(readDocumentFromYDoc(ydoc));
  };
  map.observe(handler);
  queueMicrotask(handler);
  return () => map.unobserve(handler);
}

export function encodeYDocState(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc);
}

export function applyYDocUpdate(ydoc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(ydoc, update);
}
