import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyMoveToolPointerSelection,
  drillTargetForDoubleClick,
  frameBodyReceivesPointerHits,
  isAdditiveSelectionClick,
  isDeepSelectClick,
  resolveCanvasDragNodeId,
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

function text(id: string, parentId: string): EditorNode {
  return {
    id,
    parentId,
    type: "text",
    name: id,
    x: 10,
    y: 10,
    width: 80,
    height: 24,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content: "Hello",
    fontSize: 16,
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

  it("selects parent frame when text child is clicked; cmd drills to text", () => {
    const nodes = { f: frame("f"), t: text("t", "f") };
    const childOrder = { f: ["t"] };
    assert.equal(selectionTargetForClick("t", nodes, childOrder, null), "f");
    assert.equal(selectionTargetForClick("t", nodes, childOrder, null, true), "t");
  });

  it("maps text right-click to parent frame unless cmd held", () => {
    const nodes = { f: frame("f"), t: text("t", "f") };
    const childOrder = { f: ["t"] };
    assert.equal(selectionTargetForClick("t", nodes, childOrder, null, false), "f");
    assert.equal(selectionTargetForClick("t", nodes, childOrder, null, true), "t");
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
    assert.equal(shouldCollapseContainerHits("f", nodes, childOrder, null, false, ["f"]), true);
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

  it("maps child click to boolean group", () => {
    const nodes = {
      g: frame("g", { type: "group", isBooleanGroup: true, booleanOperation: "union" }),
      r: rect("r", "g"),
    };
    const childOrder = { g: ["r"] };
    assert.equal(selectionTargetForClick("r", nodes, childOrder, null), "g");
    assert.equal(shouldCollapseContainerHits("g", nodes, childOrder, null), true);
    assert.equal(selectionTargetForClick("r", nodes, childOrder, "g"), "r");
  });

  it("selects component set container on variant child click; cmd drills to variant", () => {
    const nodes = {
      set: frame("set", { isComponentSet: true, variantGroupId: "vg1" }),
      v1: frame("v1", {
        parentId: "set",
        isComponent: true,
        variantGroupId: "vg1",
        x: 0,
        width: 80,
      }),
      v2: frame("v2", {
        parentId: "set",
        isComponent: true,
        variantGroupId: "vg1",
        x: 100,
        width: 80,
      }),
    };
    const childOrder = { set: ["v1", "v2"] };
    assert.equal(shouldCollapseContainerHits("set", nodes, childOrder, null), true);
    assert.equal(selectionTargetForClick("v1", nodes, childOrder, null), "set");
    assert.equal(selectionTargetForClick("v1", nodes, childOrder, null, true), "v1");
    assert.equal(frameBodyReceivesPointerHits("set", nodes, childOrder), true);
    assert.equal(resolveCanvasDragNodeId("v1", ["set"], nodes), "set");
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

  it("applyMoveToolPointerSelection keeps frame selected when clicking a child inside it", () => {
    const nodes = { f: frame("f"), r: rect("r", "f") };
    let selected = ["f"];
    const select = (id: string | null) => {
      if (id) selected = [id];
    };
    applyMoveToolPointerSelection("r", selected, false, select, nodes);
    assert.deepEqual(selected, ["f"]);
  });

  it("resolveCanvasDragNodeId prefers selected parent frame over child hit", () => {
    const nodes = { f: frame("f"), r: rect("r", "f") };
    assert.equal(resolveCanvasDragNodeId("r", ["f"], nodes), "f");
    assert.equal(resolveCanvasDragNodeId("r", ["r"], nodes), "r");
  });

  it("selects instance root on single click inside instance", () => {
    const instRoot = frame("inst", { sourceComponentId: "master", componentId: "c1" });
    const child = rect("child", "inst");
    const nodes = { inst: instRoot, child };
    const childOrder = { inst: ["child"] };
    assert.equal(selectionTargetForClick("child", nodes, childOrder, null), "inst");
    assert.equal(selectionTargetForClick("child", nodes, childOrder, null, true), "child");
    assert.equal(selectionTargetForClick("child", nodes, childOrder, "inst"), "child");
  });

  it("double-click drills into instance", () => {
    const instRoot = frame("inst", { sourceComponentId: "master", componentId: "c1" });
    const child = rect("child", "inst");
    const nodes = { inst: instRoot, child };
    const childOrder = { inst: ["child"] };
    const drill = drillTargetForDoubleClick(
      "child",
      20,
      20,
      nodes,
      childOrder,
      null,
      () => "child",
    );
    assert.deepEqual(drill, { containerId: "inst", selectId: "child" });
  });
});
