import assert from "node:assert/strict";
import * as Y from "yjs";
import { describe, it } from "node:test";
import { base64ToUint8, fileIdFromRoom, uint8ToBase64 } from "../room.js";
import {
  bootstrapYDocFromDocumentJson,
  readDocumentJsonFromYDoc,
} from "../yjsDocument.js";

describe("craft-realtime room", () => {
  it("fileIdFromRoom parses file: prefix", () => {
    assert.equal(fileIdFromRoom("file:api-file-paytm-1"), "api-file-paytm-1");
    assert.equal(fileIdFromRoom("workspace:foo"), null);
  });

  it("base64 round-trips Yjs updates", () => {
    const doc = new Y.Doc();
    doc.getMap("craft").set("documentJson", JSON.stringify({ version: 1 }));
    const encoded = uint8ToBase64(Y.encodeStateAsUpdate(doc));
    const restored = new Y.Doc();
    Y.applyUpdate(restored, base64ToUint8(encoded));
    assert.equal(restored.getMap("craft").get("documentJson"), doc.getMap("craft").get("documentJson"));
  });
});

describe("craft-realtime persistence helpers", () => {
  it("bootstrapYDocFromDocumentJson round-trips via readDocumentJsonFromYDoc", () => {
    const payload = { version: 1, name: "Test", nodes: {}, childOrder: { __root__: [] } };
    const doc = bootstrapYDocFromDocumentJson(payload);
    assert.deepEqual(readDocumentJsonFromYDoc(doc), payload);
  });
});
