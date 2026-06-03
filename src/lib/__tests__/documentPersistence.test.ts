import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  isBrokenOrphanedLocalDocument,
  isOversizedLocalDocumentRaw,
  type PaytmCraftDocument,
} from "@/lib/documentPersistence";

function minimalDoc(
  nodes: PaytmCraftDocument["nodes"],
  childOrder: PaytmCraftDocument["childOrder"],
): PaytmCraftDocument {
  return {
    version: 1,
    name: "Test",
    savedAt: new Date().toISOString(),
    nodes,
    childOrder,
  };
}

describe("isBrokenOrphanedLocalDocument", () => {
  it("flags orphan nodes with no canvas root", () => {
    const doc = minimalDoc(
      { n1: { id: "n1", parentId: null, type: "rectangle", x: 0, y: 0, width: 10, height: 10 } as never },
      { [EDITOR_ROOT_KEY]: [] },
    );
    assert.equal(isBrokenOrphanedLocalDocument(doc), true);
  });

  it("accepts a healthy document with canvas roots", () => {
    const doc = minimalDoc(
      { f1: { id: "f1", parentId: null, type: "frame", x: 0, y: 0, width: 100, height: 100 } as never },
      { [EDITOR_ROOT_KEY]: ["f1"], f1: [] },
    );
    assert.equal(isBrokenOrphanedLocalDocument(doc), false);
  });
});

describe("isOversizedLocalDocumentRaw", () => {
  it("flags payloads above the safe load limit", () => {
    assert.equal(isOversizedLocalDocumentRaw("x".repeat(5_000_000)), true);
    assert.equal(isOversizedLocalDocumentRaw("{}"), false);
  });
});
