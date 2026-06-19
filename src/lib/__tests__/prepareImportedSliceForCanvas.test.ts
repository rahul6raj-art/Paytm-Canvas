import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareImportedSliceForCanvas } from "../prepareImportedSliceForCanvas";
import { EDITOR_ROOT_KEY } from "../editorConstants";
import type { EditorPersistSlice } from "../documentPersistence";

function baseSlice(nodes: Record<string, import("@/stores/useEditorStore").EditorNode>): EditorPersistSlice {
  return {
    nodes,
    childOrder: { [EDITOR_ROOT_KEY]: ["root"] },
    assets: {},
    designTokens: {},
    fileName: "Test",
    selectedIds: ["root"],
    zoom: 1,
    pan: { x: 0, y: 0 },
    showGrid: false,
    showRulers: false,
    canvasBackgroundColor: "#e5e5e5",
    comments: [],
    pages: {},
    pageOrder: [],
    activePageId: "page-1",
    activeSubPageId: "page-1-sp-1",
  };
}

describe("prepareImportedSliceForCanvas", () => {
  it("disables unresolvable CSS var fills and clipChildren", () => {
    const slice = baseSlice({
      root: {
        id: "root",
        parentId: null,
        type: "frame",
        name: "Screen",
        x: 80,
        y: 80,
        width: 390,
        height: 844,
        clipChildren: true,
        fill: "var(--surface-level-4)",
        fillEnabled: true,
      },
    });
    const out = prepareImportedSliceForCanvas(slice);
    assert.equal(out.nodes.root?.fill, "#FFFFFF");
    assert.equal(out.nodes.root?.fillEnabled, true);
    assert.equal(out.nodes.root?.clipChildren, false);
  });

  it("gives root artboards a visible backdrop when live capture omits fill", () => {
    const slice = baseSlice({
      root: {
        id: "root",
        parentId: null,
        type: "frame",
        name: "Screen",
        x: 80,
        y: 80,
        width: 390,
        height: 844,
        fillEnabled: false,
      },
    });
    const out = prepareImportedSliceForCanvas(slice);
    assert.equal(out.nodes.root?.fill, "#101010");
    assert.equal(out.nodes.root?.fillEnabled, true);
  });
});
