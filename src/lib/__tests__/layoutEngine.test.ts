import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  layoutAutoNode,
  layoutAutoNodeDeep,
  markLayoutDirty,
  relayoutDirtyTree,
} from "@/lib/layoutEngine";
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

describe("layoutEngine — horizontal button (icon + label)", () => {
  it("lays out icon and label in a hug horizontal row", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      btn: rootFrame("btn", {
        layoutMode: "horizontal",
        layoutGap: 8,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      icon: frame("icon", 0, 0, 16, 16, { parentId: "btn" }),
      label: frame("label", 0, 0, 48, 14, { parentId: "btn" }),
    };
    const childOrder = { btn: ["icon", "label"] };
    const out = layoutAutoNode("btn", nodes, childOrder);
    assert.equal(out.parent?.width, 12 + 16 + 8 + 48 + 12);
    assert.equal(out.children.icon?.x, 12);
    assert.equal(out.children.label?.x, 12 + 16 + 8);
  });
});

describe("layoutEngine — vertical card", () => {
  it("stacks header, body, and button vertically", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      card: rootFrame("card", {
        layoutMode: "vertical",
        layoutGap: 12,
        paddingTop: 16,
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 16,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      header: frame("header", 0, 0, 200, 32, { parentId: "card" }),
      body: frame("body", 0, 0, 200, 80, { parentId: "card" }),
      cta: frame("cta", 0, 0, 120, 36, { parentId: "card" }),
    };
    const childOrder = { card: ["header", "body", "cta"] };
    const out = layoutAutoNode("card", nodes, childOrder);
    assert.equal(out.children.header?.y, 16);
    assert.equal(out.children.body?.y, 16 + 32 + 12);
    assert.equal(out.children.cta?.y, 16 + 32 + 12 + 80 + 12);
  });
});

describe("layoutEngine — nested auto layout", () => {
  it("layouts nested hug frame inside vertical card", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      card: rootFrame("card", {
        layoutMode: "vertical",
        layoutGap: 8,
        paddingTop: 8,
        paddingLeft: 8,
        paddingRight: 8,
        paddingBottom: 8,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      row: frame("row", 0, 0, 10, 10, {
        parentId: "card",
        layoutMode: "horizontal",
        layoutGap: 4,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      a: frame("a", 0, 0, 20, 20, { parentId: "row" }),
      b: frame("b", 0, 0, 30, 20, { parentId: "row" }),
    };
    const childOrder = { card: ["row"], row: ["a", "b"] };
    const out = layoutAutoNodeDeep(nodes, childOrder, "card");
    assert.equal(out.row!.width, 20 + 4 + 30);
    assert.equal(out.a!.x, 0);
    assert.equal(out.b!.x, 24);
  });
});

describe("layoutEngine — auto gap", () => {
  it("uses inferred spacing when layoutGapAuto is true", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 99,
        layoutGapAuto: true,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
        width: 200,
        height: 80,
      }),
      a: frame("a", 0, 0, 40, 40, { parentId: "parent" }),
      b: frame("b", 0, 0, 40, 40, { parentId: "parent", x: 52, y: 0 }),
    };
    const childOrder = { parent: ["a", "b"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.b?.x, 40 + 12);
  });
});

describe("layoutEngine — padding on fixed frame", () => {
  it("keeps frame width/height and shrinks the inner content area when padding grows", () => {
    const base: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 0,
        width: 200,
        height: 80,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 8,
        paddingBottom: 8,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      fixed: frame("fixed", 0, 0, 50, 40, { parentId: "parent" }),
      grow: frame("grow", 0, 0, 10, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
      }),
    };
    const childOrder = { parent: ["fixed", "grow"] };
    const loose = layoutAutoNode("parent", base, childOrder);
    assert.equal(loose.parent?.width, undefined);
    assert.equal(loose.children.grow?.width, 200 - 8 - 8 - 50);

    const tight = layoutAutoNode(
      "parent",
      {
        ...base,
        parent: {
          ...base.parent,
          paddingLeft: 24,
          paddingRight: 24,
        },
      },
      childOrder,
    );
    assert.equal(tight.parent?.width, undefined);
    assert.equal(tight.children.fixed?.x, 24);
    assert.equal(tight.children.grow?.width, 200 - 24 - 24 - 50);
  });
});

describe("layoutEngine — fill child", () => {
  it("stretches fill child on main axis in fixed parent", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        width: 300,
        height: 100,
        layoutGap: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      fixed: frame("fixed", 0, 0, 60, 40, { parentId: "parent" }),
      grow: frame("grow", 0, 0, 10, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
      }),
    };
    const childOrder = { parent: ["fixed", "grow"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.grow?.width, 300 - 60);
  });
});

describe("layoutEngine — absolute child", () => {
  it("does not move absolute children in flow", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 8,
        paddingLeft: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      flow: frame("flow", 0, 0, 40, 20, { parentId: "parent" }),
      badge: frame("badge", 80, 4, 24, 24, {
        parentId: "parent",
        layoutPositioning: "absolute",
      }),
    };
    const childOrder = { parent: ["flow", "badge"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.badge?.x, 80);
    assert.equal(out.children.badge?.y, 4);
    assert.equal(out.children.flow?.x, 0);
  });
});

describe("layoutEngine — wrap", () => {
  it("wraps chips into multiple rows", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutWrap: true,
        layoutGap: 8,
        width: 120,
        height: 200,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "hug",
      }),
      c1: frame("c1", 0, 0, 50, 20, { parentId: "parent" }),
      c2: frame("c2", 0, 0, 50, 20, { parentId: "parent" }),
      c3: frame("c3", 0, 0, 50, 20, { parentId: "parent" }),
    };
    const childOrder = { parent: ["c1", "c2", "c3"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.c1?.y, 0);
    assert.equal(out.children.c2?.x, 58);
    assert.ok((out.children.c3?.y ?? 0) > 20);
  });
});

describe("layoutEngine — dirty relayout", () => {
  it("relayouts only dirty subtree after child width change", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 8,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      a: frame("a", 0, 0, 40, 20, { parentId: "parent" }),
      b: frame("b", 0, 0, 40, 20, { parentId: "parent" }),
    };
    const childOrder = { parent: ["a", "b"] };
    let next = layoutAutoNodeDeep(nodes, childOrder, "parent");
    next = { ...next, a: { ...next.a!, width: 100, layoutDirty: true } };
    next = markLayoutDirty(next, "a");
    next = relayoutDirtyTree(next, childOrder, ["parent"]);
    assert.equal(next.b!.x, 100 + 8);
  });
});
