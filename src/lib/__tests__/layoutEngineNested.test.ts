import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { layoutAutoNode, layoutAutoNodeDeep } from "@/lib/layoutEngine";
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

describe("layoutEngine — nested auto layout", () => {
  it("1: hug parent → hug child → leaf content", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "vertical",
        layoutGap: 4,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      child: frame("child", 0, 0, 10, 10, {
        parentId: "parent",
        layoutMode: "horizontal",
        layoutGap: 0,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      label: frame("label", 0, 0, 48, 14, { parentId: "child" }),
    };
    const childOrder = { parent: ["child"], child: ["label"] };
    const out = layoutAutoNodeDeep(nodes, childOrder, "parent");
    assert.equal(out.label!.width, 48);
    assert.equal(out.child!.width, 48);
    assert.equal(out.parent!.width, 48);
  });

  it("2: hug parent → fill child fallback (Case 3)", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 0,
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

  it("3: fixed parent → fill child → hug grandchild → leaf", () => {
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
      inner: frame("inner", 0, 0, 10, 10, {
        parentId: "fillRow",
        layoutMode: "horizontal",
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      label: frame("label", 0, 0, 36, 14, { parentId: "inner" }),
    };
    const childOrder = { outer: ["fillRow"], fillRow: ["inner"], inner: ["label"] };
    const out = layoutAutoNodeDeep(nodes, childOrder, "outer");
    assert.equal(out.fillRow!.width, 200);
    assert.equal(out.fillRow!.height, 40);
    assert.equal(out.inner!.width, 36);
  });

  it("4: fixed parent → horizontal AL child with fixed + hug + fill", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      outer: rootFrame("outer", {
        layoutMode: "vertical",
        width: 300,
        height: 120,
        layoutGap: 8,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      row: frame("row", 0, 0, 10, 10, {
        parentId: "outer",
        layoutMode: "horizontal",
        layoutGap: 10,
        layoutSizingHorizontal: "fill",
        layoutSizingVertical: "fixed",
        height: 60,
      }),
      fixed: frame("fixed", 0, 0, 50, 40, { parentId: "row" }),
      hug: frame("hug", 0, 0, 30, 40, {
        parentId: "row",
        layoutSizingHorizontal: "hug",
      }),
      fill: frame("fill", 0, 0, 10, 40, {
        parentId: "row",
        layoutSizingHorizontal: "fill",
      }),
    };
    const childOrder = { outer: ["row"], row: ["fixed", "hug", "fill"] };
    const out = layoutAutoNodeDeep(nodes, childOrder, "outer");
    assert.equal(out.row!.width, 300);
    assert.equal(out.fixed!.width, 50);
    assert.equal(out.hug!.width, 30);
    assert.equal(out.fill!.width, 300 - 50 - 30 - 10 - 10);
  });

  it("5: leaf resize in 4-level nested hug updates all ancestors", () => {
    let nodes: Record<string, LayoutEngineNode> = {
      l0: rootFrame("l0", {
        layoutMode: "vertical",
        layoutGap: 4,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      l1: frame("l1", 0, 0, 10, 10, {
        parentId: "l0",
        layoutMode: "vertical",
        layoutGap: 4,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      l2: frame("l2", 0, 0, 10, 10, {
        parentId: "l1",
        layoutMode: "vertical",
        layoutGap: 4,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      l3: frame("l3", 0, 0, 10, 10, {
        parentId: "l2",
        layoutMode: "horizontal",
        layoutGap: 0,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      leaf: frame("leaf", 0, 0, 30, 12, { parentId: "l3" }),
    };
    const childOrder = {
      l0: ["l1"],
      l1: ["l2"],
      l2: ["l3"],
      l3: ["leaf"],
    };
    let out = layoutAutoNodeDeep(nodes, childOrder, "l0");
    const w0 = out.l0!.width ?? 0;
    const w3 = out.l3!.width ?? 0;

    nodes = {
      ...out,
      leaf: { ...out.leaf!, width: 90 },
    };
    out = layoutAutoNodeDeep(nodes, childOrder, "l0");
    assert.equal(out.leaf!.width, 90);
    assert.equal(out.l3!.width, 90);
    assert.ok((out.l0!.width ?? 0) >= w0);
    assert.ok((out.l3!.width ?? 0) > w3);
  });

  it("6: parent resize updates nested fill child", () => {
    const base: Record<string, LayoutEngineNode> = {
      outer: rootFrame("outer", {
        layoutMode: "vertical",
        width: 200,
        height: 100,
        layoutGap: 0,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      fillRow: frame("fillRow", 0, 0, 10, 10, {
        parentId: "outer",
        layoutMode: "horizontal",
        layoutGap: 0,
        layoutSizingHorizontal: "fill",
        layoutSizingVertical: "fixed",
        height: 50,
      }),
      inner: frame("inner", 0, 0, 10, 10, {
        parentId: "fillRow",
        layoutSizingHorizontal: "fill",
        layoutSizingVertical: "fixed",
        height: 30,
      }),
    };
    const childOrder = { outer: ["fillRow"], fillRow: ["inner"] };
    let out = layoutAutoNodeDeep(base, childOrder, "outer");
    assert.equal(out.fillRow!.width, 200);
    assert.equal(out.inner!.width, 200);

    out = layoutAutoNodeDeep(
      { ...out, outer: { ...out.outer!, width: 320 } },
      childOrder,
      "outer",
    );
    assert.equal(out.fillRow!.width, 320);
    assert.equal(out.inner!.width, 320);
  });

  it("7: repeated layout solve produces same result", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "vertical",
        layoutGap: 4,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      child: frame("child", 0, 0, 10, 10, {
        parentId: "parent",
        layoutMode: "horizontal",
        layoutGap: 4,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      a: frame("a", 0, 0, 20, 20, { parentId: "child" }),
      b: frame("b", 0, 0, 30, 20, { parentId: "child" }),
    };
    const childOrder = { parent: ["child"], child: ["a", "b"] };
    const first = layoutAutoNodeDeep(nodes, childOrder, "parent");
    const second = layoutAutoNodeDeep(first, childOrder, "parent");
    assert.equal(first.parent!.width, second.parent!.width);
    assert.equal(first.parent!.height, second.parent!.height);
    assert.equal(first.child!.width, second.child!.width);
    assert.equal(first.a!.x, second.a!.x);
    assert.equal(first.b!.x, second.b!.x);
  });

  it("8: idempotent deep layout (no layout oscillation)", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      outer: rootFrame("outer", {
        layoutMode: "horizontal",
        width: 240,
        height: 80,
        layoutGap: 8,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      nested: frame("nested", 0, 0, 10, 10, {
        parentId: "outer",
        layoutMode: "vertical",
        layoutGap: 4,
        layoutSizingHorizontal: "fill",
        layoutSizingVertical: "hug",
      }),
      a: frame("a", 0, 0, 40, 20, { parentId: "nested" }),
      b: frame("b", 0, 0, 60, 20, { parentId: "nested" }),
    };
    const childOrder = { outer: ["nested"], nested: ["a", "b"] };
    let cur = layoutAutoNodeDeep(nodes, childOrder, "outer");
    for (let i = 0; i < 5; i++) {
      const next = layoutAutoNodeDeep(cur, childOrder, "outer");
      assert.deepEqual(
        {
          ow: next.outer!.width,
          oh: next.outer!.height,
          nw: next.nested!.width,
          nh: next.nested!.height,
          ax: next.a!.x,
          bx: next.b!.x,
        },
        {
          ow: cur.outer!.width,
          oh: cur.outer!.height,
          nw: cur.nested!.width,
          nh: cur.nested!.height,
          ax: cur.a!.x,
          bx: cur.b!.x,
        },
      );
      cur = next;
    }
  });

  it("9: hug + fill circular dependency terminates", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 0,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      fill: frame("fill", 0, 0, 80, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
      }),
    };
    const childOrder = { parent: ["fill"] };
    assert.doesNotThrow(() => {
      for (let i = 0; i < 20; i++) {
        layoutAutoNode("parent", nodes, childOrder);
      }
    });
  });

  it("10: hidden children do not affect nested hug size", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "vertical",
        layoutGap: 4,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      row: frame("row", 0, 0, 10, 10, {
        parentId: "parent",
        layoutMode: "horizontal",
        layoutGap: 4,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      visible: frame("visible", 0, 0, 50, 20, { parentId: "row" }),
      hidden: frame("hidden", 0, 0, 200, 20, { parentId: "row", visible: false }),
    };
    const childOrder = { parent: ["row"], row: ["visible", "hidden"] };
    const out = layoutAutoNodeDeep(nodes, childOrder, "parent");
    assert.equal(out.row!.width, 50);
    assert.equal(out.parent!.width, out.row!.width);
  });
});
