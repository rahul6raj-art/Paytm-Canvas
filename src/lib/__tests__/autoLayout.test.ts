import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyDeepAutoLayout,
  applyLayoutPatchWithAutoLayout,
  computeAutoLayout,
  inferAutoLayoutGap,
  inferAutoLayoutPadding,
  sortIdsForAutoLayoutFlow,
  type LayoutNode,
} from "@/lib/autoLayout";

function frame(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<LayoutNode> = {},
): LayoutNode {
  return {
    id,
    parentId: "parent",
    type: "frame",
    x,
    y,
    width: w,
    height: h,
    visible: true,
    locked: false,
    layoutMode: "none",
    ...extra,
  };
}

describe("auto layout", () => {
  it("sorts children left-to-right for horizontal flow", () => {
    const nodes: Record<string, LayoutNode> = {
      a: frame("a", 100, 0, 40, 20),
      b: frame("b", 0, 0, 40, 20),
    };
    const sorted = sortIdsForAutoLayoutFlow(["a", "b"], nodes, "horizontal");
    assert.deepEqual(sorted, ["b", "a"]);
  });

  it("infers gap between spaced children", () => {
    const nodes: Record<string, LayoutNode> = {
      a: frame("a", 0, 0, 40, 20),
      b: frame("b", 52, 0, 40, 20),
    };
    assert.equal(inferAutoLayoutGap(nodes, ["a", "b"], "horizontal"), 12);
  });

  it("hugs parent width to children", () => {
    const nodes: Record<string, LayoutNode> = {
      parent: {
        id: "parent",
        parentId: null,
        type: "frame",
        x: 0,
        y: 0,
        width: 400,
        height: 200,
        visible: true,
        locked: false,
        layoutMode: "horizontal",
        layoutGap: 10,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      },
      a: frame("a", 8, 4, 50, 30),
      b: frame("b", 68, 4, 80, 20),
    };
    const childOrder = { parent: ["a", "b"] };
    const result = computeAutoLayout("parent", nodes, childOrder);
    assert.equal(result.parent?.width, 8 + 50 + 10 + 80 + 8);
    assert.equal(result.parent?.height, 4 + 30 + 4);
  });

  it("applyDeepAutoLayout preserves visual order with inferred padding", () => {
    const nodes: Record<string, LayoutNode> = {
      parent: {
        id: "parent",
        parentId: null,
        type: "frame",
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        visible: true,
        locked: false,
        layoutMode: "horizontal",
        layoutGap: 0,
        paddingLeft: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      },
      a: frame("a", 20, 10, 40, 30),
      b: frame("b", 80, 10, 40, 30),
    };
    const childOrder = { parent: ["a", "b"] };
    const padding = inferAutoLayoutPadding(nodes, ["a", "b"], 300, 200);
    nodes.parent = { ...nodes.parent, ...padding, layoutGap: 20 };
    const next = applyDeepAutoLayout(nodes, childOrder, "parent");
    assert.equal(next.a!.x, padding.paddingLeft);
    assert.equal(next.b!.x, padding.paddingLeft! + 40 + (nodes.parent.layoutGap ?? 0));
  });

  it("grows fixed primary axis when gap increases", () => {
    const nodes: Record<string, LayoutNode> = {
      parent: {
        id: "parent",
        parentId: null,
        type: "frame",
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        visible: true,
        locked: false,
        layoutMode: "horizontal",
        layoutGap: 0,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 8,
        paddingBottom: 8,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      },
      a: frame("a", 0, 0, 30, 20, { parentId: "parent" }),
      b: frame("b", 0, 0, 30, 20, { parentId: "parent" }),
    };
    const childOrder = { parent: ["a", "b"] };
    const intrinsic = 8 + 30 + 0 + 30 + 8;
    const next = applyLayoutPatchWithAutoLayout(
      nodes,
      childOrder,
      "parent",
      { layoutGap: 20 },
    );
    assert.equal(next.parent!.width, intrinsic + 20);
  });

  it("shrinks hug height when a vertical child becomes shorter", () => {
    const nodes: Record<string, LayoutNode> = {
      parent: {
        id: "parent",
        parentId: null,
        type: "frame",
        x: 0,
        y: 0,
        width: 200,
        height: 300,
        visible: true,
        locked: false,
        layoutMode: "vertical",
        layoutGap: 10,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      },
      a: frame("a", 0, 0, 100, 100, { parentId: "parent" }),
      b: frame("b", 0, 0, 100, 80, { parentId: "parent" }),
    };
    const childOrder = { parent: ["a", "b"] };
    let next = applyDeepAutoLayout(nodes, childOrder, "parent");
    assert.equal(next.parent!.height, 100 + 10 + 80);

    next = {
      ...next,
      a: { ...next.a!, height: 40 },
    };
    next = applyDeepAutoLayout(next, childOrder, "parent");
    assert.equal(next.parent!.height, 40 + 10 + 80);
  });

  it("keeps fixed frame size when only padding changes", () => {
    const nodes: Record<string, LayoutNode> = {
      parent: {
        id: "parent",
        parentId: null,
        type: "frame",
        x: 0,
        y: 0,
        width: 200,
        height: 80,
        visible: true,
        locked: false,
        layoutMode: "horizontal",
        layoutGap: 0,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 8,
        paddingBottom: 8,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      },
      a: frame("a", 0, 0, 50, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
      }),
    };
    const childOrder = { parent: ["a"] };
    const next = applyLayoutPatchWithAutoLayout(nodes, childOrder, "parent", {
      paddingLeft: 24,
      paddingRight: 24,
    });
    assert.equal(next.parent!.width, 200);
    assert.equal(next.a!.width, 200 - 24 - 24);
  });
});
