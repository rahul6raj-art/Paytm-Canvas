import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  hasInMemoryWorkspaceContent,
  isBrokenOrphanedLocalDocument,
  isOversizedLocalDocumentRaw,
  shouldPreserveInMemoryPages,
  shouldRestoreLocalDocument,
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

describe("dashboard/editor page sync helpers", () => {
  it("preserves in-memory pages when a new tab was added on the dashboard", () => {
    const local = minimalDoc({}, { [EDITOR_ROOT_KEY]: [] });
    local.pages = [{ id: "page-1", name: "Page 1", nodes: {}, childOrder: { [EDITOR_ROOT_KEY]: [] }, selectedIds: [], zoom: 1, pan: { x: 0, y: 0 }, showGrid: true, showRulers: false, canvasBackgroundColor: "#fff", layoutGuides: [] }];
    local.activePageId = "page-1";

    const memory = {
      pageOrder: ["page-1", "page-2"],
      pages: {
        "page-1": { id: "page-1", name: "Page 1", nodes: {}, childOrder: { [EDITOR_ROOT_KEY]: [] }, selectedIds: [], zoom: 1, pan: { x: 0, y: 0 }, showGrid: true, showRulers: false, canvasBackgroundColor: "#fff", layoutGuides: [] },
        "page-2": { id: "page-2", name: "Page 2", nodes: {}, childOrder: { [EDITOR_ROOT_KEY]: [] }, selectedIds: [], zoom: 1, pan: { x: 0, y: 0 }, showGrid: true, showRulers: false, canvasBackgroundColor: "#fff", layoutGuides: [] },
      },
      childOrder: { [EDITOR_ROOT_KEY]: [] },
    };

    assert.equal(shouldPreserveInMemoryPages(memory, local), true);
    assert.equal(shouldRestoreLocalDocument(memory, local), false);
    assert.equal(hasInMemoryWorkspaceContent(memory), true);
  });
});
