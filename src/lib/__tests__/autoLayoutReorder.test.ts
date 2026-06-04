import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getAutoLayoutReorderContext,
  insertIndexInAutoLayout,
  reorderChildByPointer,
} from "@/lib/autoLayoutReorder";
import type { LayoutNode } from "@/lib/autoLayout";

function frame(
  id: string,
  extra: Partial<LayoutNode> = {},
): LayoutNode {
  return {
    id,
    type: "frame",
    parentId: extra.parentId ?? "parent",
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    visible: true,
    locked: false,
    ...extra,
  };
}

describe("insertIndexInAutoLayout", () => {
  it("inserts before midpoint in horizontal flow", () => {
    const nodes: Record<string, LayoutNode> = {
      row: frame("row", {
        parentId: null,
        layoutMode: "horizontal",
        layoutGap: 10,
      }),
      a: frame("a", { parentId: "row", x: 0, width: 20 }),
      b: frame("b", { parentId: "row", x: 30, width: 20 }),
    };
    const childOrder = { row: ["a", "b"] };
    assert.equal(
      insertIndexInAutoLayout("row", nodes, childOrder, 5, 0, "b"),
      0,
    );
    assert.equal(
      insertIndexInAutoLayout("row", nodes, childOrder, 45, 0, "a"),
      1,
    );
  });

  it("inserts before midpoint in vertical flow", () => {
    const nodes: Record<string, LayoutNode> = {
      col: frame("col", {
        parentId: null,
        layoutMode: "vertical",
      }),
      a: frame("a", { parentId: "col", y: 0, height: 10 }),
      b: frame("b", { parentId: "col", y: 20, height: 10 }),
    };
    const childOrder = { col: ["a", "b"] };
    assert.equal(
      insertIndexInAutoLayout("col", nodes, childOrder, 0, 4, "b"),
      0,
    );
    assert.equal(
      insertIndexInAutoLayout("col", nodes, childOrder, 0, 25, "b"),
      1,
    );
  });
});

describe("getAutoLayoutReorderContext", () => {
  it("returns context for single flow child in auto layout", () => {
    const nodes = {
      parent: frame("parent", { layoutMode: "horizontal" }),
      child: frame("child", { parentId: "parent" }),
    };
    const ctx = getAutoLayoutReorderContext(["child"], nodes, nodes);
    assert.ok(ctx);
    assert.equal(ctx!.parentId, "parent");
    assert.equal(ctx!.draggedId, "child");
  });

  it("returns null for absolute or manual parent", () => {
    const nodes = {
      parent: frame("parent", { layoutMode: "none" }),
      child: frame("child", { parentId: "parent", layoutPositioning: "absolute" }),
    };
    assert.equal(getAutoLayoutReorderContext(["child"], nodes, nodes), null);
  });
});

describe("reorderChildByPointer", () => {
  it("delegates to insertIndexInAutoLayout", () => {
    const nodes: Record<string, LayoutNode> = {
      row: frame("row", { parentId: null, layoutMode: "horizontal" }),
      a: frame("a", { parentId: "row", x: 0, width: 40 }),
      b: frame("b", { parentId: "row", x: 50, width: 40 }),
    };
    const childOrder = { row: ["a", "b"] };
    const ctx = { parentId: "row", draggedId: "b", mode: "horizontal" as const };
    assert.equal(reorderChildByPointer(ctx, nodes, childOrder, 10, 0), 0);
  });
});
