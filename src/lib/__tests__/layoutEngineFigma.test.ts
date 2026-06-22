import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  layoutAutoNode,
  layoutAutoNodeDeep,
  markLayoutDirty,
  relayoutDirtyTree,
} from "@/lib/layoutEngine";
import {
  canFillOnCrossAxis,
  canFillOnMainAxis,
  clampLayoutWidth,
} from "@/lib/layoutEngine/layoutConstraints";
import type { LayoutEngineNode } from "@/lib/layoutEngine/types";

function frame(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<LayoutEngineNode> = {},
): LayoutEngineNode {
  return {
    id,
    parentId: extra.parentId ?? "parent",
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

function rootFrame(id: string, extra: Partial<LayoutEngineNode> = {}): LayoutEngineNode {
  return frame(id, 0, 0, 400, 300, { parentId: null, ...extra });
}

describe("layoutEngine — Figma sizing constraints", () => {
  it("fill on main axis disallowed when parent hugs primary axis", () => {
    const parent = rootFrame("parent", {
      layoutMode: "horizontal",
      layoutSizingHorizontal: "hug",
      layoutSizingVertical: "fixed",
      width: 10,
      height: 80,
    });
    assert.equal(canFillOnMainAxis(parent, "horizontal"), false);
    assert.equal(canFillOnCrossAxis(parent, "horizontal"), true);
  });

  it("Case 3: hug parent + fill child uses stored width for hug measure", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 8,
        paddingLeft: 0,
        paddingRight: 0,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      fill: frame("fill", 0, 0, 120, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
      }),
    };
    const childOrder = { parent: ["fill"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.parent?.width, 120);
    assert.equal(out.children.fill?.width, 120);
  });

  it("fill child clamped to min/max on main axis", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        width: 300,
        height: 80,
        layoutGap: 0,
        paddingLeft: 0,
        paddingRight: 0,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      grow: frame("grow", 0, 0, 10, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
        minWidth: 80,
        maxWidth: 100,
      }),
    };
    const childOrder = { parent: ["grow"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.grow?.width, 100);
  });

  it("negative remaining space assigns minimum fill size", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        width: 80,
        height: 60,
        layoutGap: 0,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      a: frame("a", 0, 0, 80, 40, { parentId: "parent" }),
      b: frame("b", 0, 0, 80, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
      }),
    };
    const childOrder = { parent: ["a", "b"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.a?.width, 80);
    assert.equal(out.children.b?.width, 1);
  });

  it("empty hug container shrinks to padding minimum", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
        width: 200,
        height: 100,
      }),
    };
    const childOrder: Record<string, string[]> = { parent: [] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.parent?.width, 12 + 12 + 1);
    assert.equal(out.parent?.height, 8 + 8 + 1);
  });

  it("hidden children excluded from hug size", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 10,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      visible: frame("visible", 0, 0, 50, 20, { parentId: "parent" }),
      hidden: frame("hidden", 0, 0, 200, 20, { parentId: "parent", visible: false }),
    };
    const childOrder = { parent: ["visible", "hidden"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.parent?.width, 50);
  });

  it("absolute children do not affect hug width", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 8,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      flow: frame("flow", 0, 0, 40, 20, { parentId: "parent" }),
      abs: frame("abs", 200, 0, 100, 20, {
        parentId: "parent",
        layoutPositioning: "absolute",
      }),
    };
    const childOrder = { parent: ["flow", "abs"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.parent?.width, 40);
    assert.equal(out.children.abs?.x, 200);
  });

  it("nested fill inside fixed gives space to hug text frame", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      outer: rootFrame("outer", {
        layoutMode: "vertical",
        width: 200,
        height: 300,
        layoutGap: 0,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      fillRow: frame("fillRow", 0, 0, 10, 10, {
        parentId: "outer",
        layoutMode: "horizontal",
        layoutGap: 4,
        layoutSizingHorizontal: "fill",
        layoutSizingVertical: "fixed",
        height: 40,
      }),
      inner: frame("inner", 0, 0, 30, 20, {
        parentId: "fillRow",
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
    };
    const childOrder = { outer: ["fillRow"], fillRow: ["inner"] };
    const out = layoutAutoNodeDeep(nodes, childOrder, "outer");
    assert.equal(out.fillRow!.width, 200);
    assert.equal(out.fillRow!.height, 40);
    assert.equal(out.inner!.width, 30);
  });

  it("5-level nested hug propagates size", () => {
    let nodes: Record<string, LayoutEngineNode> = {};
    const childOrder: Record<string, string[]> = {};
    let prev = "root";
    nodes.root = rootFrame("root", {
      layoutMode: "vertical",
      layoutGap: 4,
      layoutSizingHorizontal: "hug",
      layoutSizingVertical: "hug",
    });
    childOrder.root = ["l1"];
    for (let i = 1; i <= 5; i++) {
      const id = `l${i}`;
      nodes[id] = frame(id, 0, 0, 20 + i * 5, 10 + i, {
        parentId: i === 1 ? "root" : `l${i - 1}`,
        layoutMode: i < 5 ? "vertical" : "none",
        layoutGap: 2,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      });
      if (i < 5) childOrder[id] = [`l${i + 1}`];
    }
    const out = layoutAutoNodeDeep(nodes, childOrder, "root");
    for (let i = 1; i <= 5; i++) {
      const n = out[`l${i}`]!;
      assert.ok(n.width >= 1 && n.height >= 1, `l${i} should have valid size`);
    }
    assert.ok((out.root!.height ?? 0) >= (out.l1!.height ?? 0));
  });

  it("primary space-between distributes extra main-axis space", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        width: 200,
        height: 60,
        layoutGap: 0,
        primaryAxisAlign: "space-between",
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      a: frame("a", 0, 0, 40, 40, { parentId: "parent" }),
      b: frame("b", 0, 0, 40, 40, { parentId: "parent" }),
    };
    const childOrder = { parent: ["a", "b"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.a?.x, 0);
    assert.equal(out.children.b?.x, 160);
  });

  it("counter stretch expands children to line cross max", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        width: 200,
        height: 100,
        layoutGap: 0,
        counterAxisAlign: "stretch",
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      short: frame("short", 0, 0, 40, 20, { parentId: "parent" }),
      tall: frame("tall", 0, 0, 40, 80, { parentId: "parent" }),
    };
    const childOrder = { parent: ["short", "tall"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.short?.height, 80);
    assert.equal(out.children.tall?.height, 80);
  });

  it("repeated layout produces identical geometry", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 8,
        paddingLeft: 10,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      a: frame("a", 0, 0, 30, 20, { parentId: "parent" }),
      b: frame("b", 0, 0, 50, 20, { parentId: "parent" }),
    };
    const childOrder = { parent: ["a", "b"] };
    const first = layoutAutoNode("parent", nodes, childOrder);
    const second = layoutAutoNode("parent", nodes, childOrder);
    assert.deepEqual(first.children, second.children);
    assert.deepEqual(first.parent, second.parent);
  });

  it("clampLayoutWidth respects max", () => {
    const n = frame("n", 0, 0, 500, 10, { maxWidth: 120 });
    assert.equal(clampLayoutWidth(n, 500), 120);
  });
});

describe("layoutEngine — store-style grow via relayout", () => {
  it("relayoutDirtyTree respects layoutGrow weights through layout map shape", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        width: 400,
        height: 60,
        layoutGap: 0,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      a: frame("a", 0, 0, 40, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
        layoutGrow: 1,
      }),
      b: frame("b", 0, 0, 40, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
        layoutGrow: 3,
      }),
    };
    const childOrder = { parent: ["a", "b"] };
    let next = layoutAutoNodeDeep(nodes, childOrder, "parent");
    assert.equal(next.a!.width, 100);
    assert.equal(next.b!.width, 300);

    next = markLayoutDirty(next, "a");
    next = relayoutDirtyTree(next, childOrder, ["parent"]);
    assert.equal(next.a!.width, 100);
    assert.equal(next.b!.width, 300);
  });
});
