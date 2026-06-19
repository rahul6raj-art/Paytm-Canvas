import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyPage } from "@/lib/editorPages";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

function seedSinglePage(name = "Page 1") {
  const pageId = `page-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const page = createEmptyPage(pageId, name);
  useEditorStore.setState({
    nodes: page.nodes,
    childOrder: page.childOrder,
    pages: { [pageId]: page },
    pageOrder: [pageId],
    activePageId: pageId,
    selectedIds: [],
    documentSaveStatus: "saved",
  });
  return pageId;
}

describe("renamePage", () => {
  it("updates the active page name", () => {
    const pageId = seedSinglePage();
    useEditorStore.getState().renamePage(pageId, "Home");
    assert.equal(useEditorStore.getState().pages[pageId]?.name, "Home");
  });

  it("survives clearSelection syncActivePageRecord", () => {
    const pageId = seedSinglePage();
    useEditorStore.getState().renamePage(pageId, "Home");
    useEditorStore.getState().clearSelection();
    assert.equal(useEditorStore.getState().pages[pageId]?.name, "Home");
  });

  it("marks the document unsaved when renaming a saved doc", () => {
    const pageId = seedSinglePage();
    useEditorStore.getState().renamePage(pageId, "Home");
    assert.equal(useEditorStore.getState().documentSaveStatus, "unsaved");
  });
});
