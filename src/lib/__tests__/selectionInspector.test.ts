import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSelectionInspectorModel } from "../selectionInspector";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(id: string, x: number, fill = "#cccccc"): EditorNode {
  return {
    id,
    type: "rectangle",
    name: id,
    x,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    fill,
    visible: true,
    locked: false,
    parentId: null,
  } as EditorNode;
}

describe("buildSelectionInspectorModel", () => {
  it("detects mixed position and fill values", () => {
    const nodes = {
      a: rect("a", 10, "#aaaaaa"),
      b: rect("b", 20, "#bbbbbb"),
    };
    const model = buildSelectionInspectorModel(["a", "b"], nodes);
    assert.ok(model);
    assert.equal(model!.count, 2);
    assert.equal(model!.mixed.x, true);
    assert.equal(model!.mixed.fillHex, true);
    assert.equal(model!.caps.canFillStroke, true);
  });
});
