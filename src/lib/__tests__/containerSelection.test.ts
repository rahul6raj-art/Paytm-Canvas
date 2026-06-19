import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyMoveToolPointerSelection,
  drillTargetForDoubleClick,
  frameBodyReceivesPointerHits,
  isAdditiveSelectionClick,
  isDeepSelectClick,
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
  it("selects the child when a populated frame is clicked", () => {
    const nodes = { f: frame("f"), r: rect("r", "f") };
    const childOrder = { f: ["r"] };
    assert.equal(selectionTargetForClick("r", nodes, childOrder, null), "r");
    assert.equal(selectionTargetForClick("r", nodes, childOrder, null, true), "r");
    assert.equal(frameBodyReceivesPointerHits("f", nodes, childOrder), false);
  });

  it("keeps empty frame body hittable", () => {
    const nodes = { f: frame("f") };
    const childOrder = { f: [] as string[] };
    assert.equal(frameBodyReceivesPointerHits("f", nodes, childOrder), true);
    assert.equal(shouldCollapseContainerHits("f", nodes, childOrder, null), false);
  });

  it("exposes frame children for direct hit testing", () => {
    const nodes = { f: frame("f"), r: rect("r", "f") };
    const childOrder = { f: ["r"] };
    assert.equal(shouldCollapseContainerHits("f", nodes, childOrder, null), false);
    assert.equal(shouldCollapseContainerHits("f", nodes, childOrder, null, true), false);
    assert.equal(shouldCollapseContainerHits("f", nodes, childOrder, "f"), false);
  });

  it("still maps child click to parent group", () => {
    const nodes = {
      g: frame("g", { type: "group" }),
      r: rect("r", "g"),
    };
    const childOrder = { g: ["r"] };
    assert.equal(selectionTargetForClick("r", nodes, childOrder, null), "g");
    assert.equal(shouldCollapseContainerHits("g", nodes, childOrder, null), true);
  });

  it("selects auto-layout parent on child click; cmd drills to child", () => {
    const nodes = {
      f: frame("f", { layoutMode: "horizontal" }),
      r: rect("r", "f"),
    };
    const childOrder = { f: ["r"] };
    assert.equal(shouldCollapseContainerHits("f", nodes, childOrder, null), true);
    assert.equal(shouldCollapseContainerHits("f", nodes, childOrder, null, true), false);
    assert.equal(selectionTargetForClick("r", nodes, childOrder, null), "f");
    assert.equal(selectionTargetForClick("r", nodes, childOrder, null, true), "r");
    assert.equal(frameBodyReceivesPointerHits("f", nodes, childOrder), true);
    assert.equal(frameBodyReceivesPointerHits("f", nodes, childOrder, true), false);
  });

  it("nested auto-layout: child maps to immediate auto-layout frame only", () => {
    const nodes = {
      outer: frame("outer"),
      al: frame("al", { parentId: "outer", layoutMode: "vertical" }),
      r: rect("r", "al"),
    };
    const childOrder = { outer: ["al"], al: ["r"] };
    assert.equal(selectionTargetForClick("r", nodes, childOrder, null), "al");
    assert.equal(selectionTargetForClick("r", nodes, childOrder, null, true), "r");
  });

  it("double-click drills into editable frame from its child", () => {
    const nodes = { f: frame("f"), r: rect("r", "f") };
    const childOrder = { f: ["r"] };
    const drill = drillTargetForDoubleClick("r", 0, 0, nodes, childOrder, null, () => "r");
    assert.deepEqual(drill, { containerId: "f", selectId: "r" });
  });

  it("isAdditiveSelectionClick uses shift only", () => {
    assert.equal(isAdditiveSelectionClick({ shiftKey: true }), true);
    assert.equal(isAdditiveSelectionClick({ shiftKey: false, metaKey: true }), false);
    assert.equal(isAdditiveSelectionClick({ shiftKey: true, metaKey: true }), true);
    assert.equal(isAdditiveSelectionClick({ shiftKey: false }), false);
  });

  it("isDeepSelectClick detects cmd/ctrl", () => {
    assert.equal(isDeepSelectClick({ metaKey: true }), true);
    assert.equal(isDeepSelectClick({ ctrlKey: true }), true);
    assert.equal(isDeepSelectClick({}), false);
  });

  it("applyMoveToolPointerSelection toggles additive selection", () => {
    let selected: string[] = ["a"];
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
    applyMoveToolPointerSelection("b", selected, true, select);
    assert.deepEqual(selected, ["a", "b"]);
    applyMoveToolPointerSelection("a", selected, true, select);
    assert.deepEqual(selected, ["b"]);
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
