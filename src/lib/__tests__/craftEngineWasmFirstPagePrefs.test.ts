import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

describe("craftEngineWasmFirstPagePrefs", () => {
  it("commitLayoutGuide adds guide and clears draft", () => {
    useEditorStore.setState({
      nodes: {},
      childOrder: { [ROOT]: [] },
      layoutGuides: [],
      layoutGuideDraft: { axis: "x", pos: 120 },
    });
    useEditorStore.getState().commitLayoutGuide();
    assert.equal(useEditorStore.getState().layoutGuides.length, 1);
    assert.equal(useEditorStore.getState().layoutGuideDraft, null);
  });

  it("setCanvasBackgroundColor updates canvas color", () => {
    useEditorStore.setState({
      nodes: {},
      childOrder: { [ROOT]: [] },
      canvasBackgroundColor: "#ffffff",
    });
    useEditorStore.getState().setCanvasBackgroundColor("#1a2b3c");
    assert.equal(useEditorStore.getState().canvasBackgroundColor, "#1a2b3c");
  });

  it("togglePathClosed flips pathClosed", () => {
    const id = `path-closed-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "path",
          name: "Path",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          pathPoints: [],
          pathClosed: false,
        },
      },
      childOrder: { [ROOT]: [id] },
    });
    useEditorStore.getState().togglePathClosed(id);
    assert.equal(useEditorStore.getState().nodes[id]?.pathClosed, true);
  });

  it("updateComment patches comment body", () => {
    const cid = `comment-${Date.now()}`;
    useEditorStore.setState({
      nodes: {},
      childOrder: { [ROOT]: [] },
      comments: [
        {
          id: cid,
          x: 10,
          y: 20,
          author: { id: "u1", name: "User", color: "#000" },
          body: "",
          createdAt: new Date().toISOString(),
          resolved: false,
          replies: [],
        },
      ],
    });
    useEditorStore.getState().updateComment(cid, "Looks good");
    assert.equal(useEditorStore.getState().comments[0]?.body, "Looks good");
  });

  it("toggleGrid flips showGrid", () => {
    useEditorStore.setState({
      nodes: {},
      childOrder: { [ROOT]: [] },
      showGrid: false,
    });
    useEditorStore.getState().toggleGrid();
    assert.equal(useEditorStore.getState().showGrid, true);
  });

  it("toggleRulers flips showRulers and syncs active page", () => {
    const pageId = useEditorStore.getState().activePageId;
    useEditorStore.setState({
      nodes: {},
      childOrder: { [ROOT]: [] },
      showRulers: false,
    });
    useEditorStore.getState().toggleRulers();
    assert.equal(useEditorStore.getState().showRulers, true);
    assert.equal(useEditorStore.getState().pages[pageId]?.showRulers, true);
  });
});
