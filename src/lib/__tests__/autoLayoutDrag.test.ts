import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { idsToDetachForAutoLayoutDrag } from "@/lib/autoLayoutDrag";
import type { LayoutNode } from "@/lib/autoLayout";

function frame(id: string, extra: Partial<LayoutNode> = {}): LayoutNode {
  return {
    id,
    parentId: null,
    type: "frame",
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    visible: true,
    locked: false,
    layoutMode: "horizontal",
    ...extra,
  } as LayoutNode;
}

function child(id: string, parentId: string, extra: Partial<LayoutNode> = {}): LayoutNode {
  return {
    id,
    parentId,
    type: "rectangle",
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    visible: true,
    locked: false,
    ...extra,
  } as LayoutNode;
}

describe("autoLayoutDrag", () => {
  it("detaches flow children in auto-layout parents", () => {
    const nodes = {
      parent: frame("parent"),
      a: child("a", "parent"),
      b: child("b", "parent", { layoutPositioning: "absolute" }),
    };
    const ids = idsToDetachForAutoLayoutDrag(["a", "b"], nodes, nodes);
    assert.deepEqual(ids, ["a"]);
  });

  it("skips nodes in manual-layout parents", () => {
    const nodes = {
      parent: frame("parent", { layoutMode: "none" }),
      a: child("a", "parent"),
    };
    const ids = idsToDetachForAutoLayoutDrag(["a"], nodes, nodes);
    assert.deepEqual(ids, []);
  });
});
