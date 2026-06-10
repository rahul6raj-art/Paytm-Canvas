import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autoLayoutArrowReorderDelta,
  canSwapAutoLayoutSiblings,
  computeAutoLayoutArrowReorderIndex,
  getAutoLayoutArrowReorderContext,
  swapAutoLayoutSiblingOrder,
} from "@/lib/autoLayoutArrowReorder";
import type { EditorNode } from "@/stores/useEditorStore";

function alFrame(id: string): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: id,
    x: 0,
    y: 0,
    width: 200,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    layoutMode: "horizontal",
    layoutGap: 8,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  };
}

function rect(id: string, parentId: string, x: number): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: id,
    x,
    y: 0,
    width: 40,
    height: 40,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
  };
}

describe("autoLayoutArrowReorder", () => {
  it("returns context for a single flow child", () => {
    const nodes = { f: alFrame("f"), a: rect("a", "f", 0), b: rect("b", "f", 48) };
    const childOrder = { f: ["a", "b"] };
    const ctx = getAutoLayoutArrowReorderContext(["b"], nodes, childOrder);
    assert.ok(ctx);
    assert.equal(ctx!.childId, "b");
    assert.equal(ctx!.mode, "horizontal");
  });

  it("computes reorder index for horizontal arrows", () => {
    const nodes = { f: alFrame("f"), a: rect("a", "f", 0), b: rect("b", "f", 48) };
    const childOrder = { f: ["a", "b"] };
    const ctx = { parentId: "f", childId: "b", mode: "horizontal" as const };
    assert.equal(computeAutoLayoutArrowReorderIndex(ctx, "ArrowLeft", nodes, childOrder), 0);
    assert.equal(autoLayoutArrowReorderDelta("horizontal", "ArrowUp"), 0);
  });

  it("swaps sibling order in child list", () => {
    const childOrder = { f: ["a", "b", "c"] };
    const next = swapAutoLayoutSiblingOrder("f", "a", "c", childOrder);
    assert.deepEqual(next!.f, ["c", "b", "a"]);
  });

  it("allows swap between auto-layout flow siblings", () => {
    const nodes = { f: alFrame("f"), a: rect("a", "f", 0), b: rect("b", "f", 48) };
    assert.equal(canSwapAutoLayoutSiblings("a", "b", nodes), true);
    assert.equal(canSwapAutoLayoutSiblings("a", "a", nodes), false);
  });
});
