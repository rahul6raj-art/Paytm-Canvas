import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as Y from "yjs";
import {
  applyYDocUpdate,
  createDocumentYDoc,
  encodeYDocState,
  observeDocumentYDoc,
  readDocumentFromYDoc,
  writeDocumentToYDoc,
} from "@/lib/yjsDocumentChannel";
import { base64ToUint8, uint8ToBase64 } from "@/lib/yjsWireCodec";

const minimalDoc = {
  version: 1 as const,
  name: "Yjs test",
  savedAt: "2026-01-01T00:00:00.000Z",
  nodes: {},
  childOrder: { __root__: [] as string[] },
};

describe("yjsDocumentChannel", () => {
  it("round-trips PaytmCraftDocument through Y.Doc", () => {
    const ydoc = createDocumentYDoc();
    writeDocumentToYDoc(ydoc, minimalDoc);
    assert.deepEqual(readDocumentFromYDoc(ydoc), minimalDoc);
  });

  it("merges concurrent updates from two Y.Docs", () => {
    const a = createDocumentYDoc();
    const b = createDocumentYDoc();
    writeDocumentToYDoc(a, minimalDoc);
    applyYDocUpdate(b, encodeYDocState(a));

    writeDocumentToYDoc(b, { ...minimalDoc, name: "Merged" });
    applyYDocUpdate(a, encodeYDocState(b));

    assert.equal(readDocumentFromYDoc(a)?.name, "Merged");
    assert.equal(readDocumentFromYDoc(b)?.name, "Merged");
  });

  it("observeDocumentYDoc emits on remote apply", () => {
    const local = createDocumentYDoc();
    const remote = createDocumentYDoc();
    const seen: string[] = [];
    observeDocumentYDoc(local, (doc) => {
      if (doc) seen.push(doc.name);
    });
    writeDocumentToYDoc(remote, minimalDoc);
    applyYDocUpdate(local, encodeYDocState(remote));
    assert.deepEqual(seen, ["Yjs test"]);
  });
});

describe("yjsWireCodec", () => {
  it("round-trips binary payloads", () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    assert.deepEqual(base64ToUint8(uint8ToBase64(bytes)), bytes);
  });
});
