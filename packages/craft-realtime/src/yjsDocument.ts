import * as Y from "yjs";

export const YDOC_MAP_NAME = "craft";
export const YDOC_DOCUMENT_KEY = "documentJson";

export function bootstrapYDocFromDocumentJson(documentJson: unknown): Y.Doc {
  const doc = new Y.Doc();
  if (documentJson != null) {
    doc.transact(() => {
      doc.getMap(YDOC_MAP_NAME).set(YDOC_DOCUMENT_KEY, JSON.stringify(documentJson));
    });
  }
  return doc;
}

export function readDocumentJsonFromYDoc(doc: Y.Doc): unknown | null {
  const raw = doc.getMap(YDOC_MAP_NAME).get(YDOC_DOCUMENT_KEY);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
