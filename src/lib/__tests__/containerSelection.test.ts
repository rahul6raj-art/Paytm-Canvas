import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyMoveToolPointerSelection,
  drillTargetForDoubleClick,
  selectionTargetForClick,
  shouldCollapseContainerHits,
} from "@/lib/containerSelection";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(id: string, extra: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...extra,
  } as EditorNode;
}

function rect(id: string, parentId: string): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: id,
    x: 10,
    y: 10,
    width: 40,
    height: 40,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#000",
  } as EditorNode;
}

describe("containerSelection", () => {
  it("maps child click to parent frame", () => {
    const nodes = { f: frame("f"), r: rect("r", "f") };
    const childOrder = { f: ["r"] };
    assert.equal(selectionTargetForClick("r", nodes, childOrder, null), "f");
  });

  it("collapses frame hits until drill-in", () => {
    const nodes = { f: frame("f"), r: rect("r", "f") };
    const childOrder = { f: ["r"] };
    assert.equal(shouldCollapseContainerHits("f", nodes, childOrder, null), true);
    assert.equal(shouldCollapseContainerHits("f", nodes, childOrder, "f"), false);
  });

  it("double-click returns container and deepest child", () => {
    const nodes = { f: frame("f"), r: rect("r", "f") };
    const childOrder = { f: ["r"] };
    const drill = drillTargetForDoubleClick("r", 0, 0, nodes, childOrder, null, () => "r");
    assert.deepEqual(drill, { containerId: "f", selectId: "r" });
  });

  it("applyMoveToolPointerSelection keeps multi-select when dragging selected layer", () => {
    let selected: string[] = ["a", "b"];
    const select = (id: string | null, additive?: boolean) => {
      if (!id) {
        selected = [];
        return;
      }
      if (additive) {
        selected = selected.includes(id)
          ? selected.filter((x) => x !== id)
          : [...selected, id];
        return;
      }
      selected = [id];
    };
    applyMoveToolPointerSelection("a", ["a", "b"], false, select);
    assert.deepEqual(selected, ["a", "b"]);
    applyMoveToolPointerSelection("c", ["a", "b"], false, select);
    assert.deepEqual(selected, ["c"]);
  });
});
