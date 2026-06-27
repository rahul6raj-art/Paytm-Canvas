import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  freezeAutoLayoutGap,
  freezeAutoLayoutGapBeforeChildInsert,
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

describe("layoutEngine — child list order", () => {
  it("relayouts flow children to match childOrder, not stale x positions", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      row: rootFrame("row", {
        layoutMode: "horizontal",
        layoutGap: 10,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
        width: 200,
        height: 60,
      }),
      a: frame("a", 0, 0, 40, 40, { parentId: "row" }),
      b: frame("b", 50, 0, 40, 40, { parentId: "row" }),
    };
    const childOrder = { row: ["b", "a"] };
    const out = layoutAutoNode("row", nodes, childOrder);
    assert.equal(out.children.b?.x, 0);
    assert.equal(out.children.a?.x, 50);
  });
});

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
  it("freezeAutoLayoutGap preserves inferred gap when turning Auto off", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 0,
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
    const patch = freezeAutoLayoutGap(nodes.parent, nodes, childOrder);
    assert.ok(patch);
    assert.equal(patch!.layoutGapAuto, false);
    assert.equal(patch!.layoutGap, 12);
  });

  it("freezeAutoLayoutGapBeforeChildInsert preserves inferred gap before child insert", () => {
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
      c: frame("c", 0, 0, 30, 30, { parentId: null }),
    };
    const childOrder = { parent: ["a", "b"] };
    const patch = freezeAutoLayoutGapBeforeChildInsert(
      nodes.parent,
      nodes,
      childOrder,
      "c",
    );
    assert.ok(patch);
    assert.equal(patch!.layoutGapAuto, false);
    assert.equal(patch!.layoutGap, 12);
  });

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

  it("syncs layoutGap on parent when layoutGapAuto relayouts", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 0,
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
    assert.equal(out.parent?.layoutGap, 12);
  });
});

describe("layoutEngine — layoutGrow fill distribution", () => {
  it("splits extra main-axis space by layoutGrow weights", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        layoutGap: 0,
        width: 300,
        height: 60,
        paddingLeft: 0,
        paddingRight: 0,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      a: frame("a", 0, 0, 50, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
        layoutGrow: 1,
      }),
      b: frame("b", 0, 0, 50, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
        layoutGrow: 3,
      }),
    };
    const childOrder = { parent: ["a", "b"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.a?.width, 75);
    assert.equal(out.children.b?.width, 225);
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
  it("grows the frame when padding increases without shrinking a fixed child", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        width: 408,
        height: 269,
        layoutGap: 0,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 16,
        paddingBottom: 16,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      child: frame("child", 0, 0, 408, 269, { parentId: "parent" }),
    };
    const childOrder = { parent: ["child"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.child?.width, 408);
    assert.equal(out.children.child?.height, 269);
    assert.equal(out.children.child?.x, 16);
    assert.equal(out.children.child?.y, 16);
    assert.equal(out.parent?.width, 408 + 32);
    assert.equal(out.parent?.height, 269 + 32);
  });

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

describe("layoutEngine — fixed width with hug height", () => {
  it("uses fixed width for inner layout when only counter axis hugs", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        width: 80,
        height: 200,
        layoutGap: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "hug",
      }),
      fixed: frame("fixed", 0, 0, 50, 40, { parentId: "parent" }),
      grow: frame("grow", 0, 0, 10, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
      }),
    };
    const childOrder = { parent: ["fixed", "grow"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.grow?.width, 30);
    assert.equal(out.parent?.width, undefined);
  });

  it("shrinks fill child when fixed frame width decreases", () => {
    const childOrder = { parent: ["fixed", "grow"] };
    const baseChild = {
      fixed: frame("fixed", 0, 0, 50, 40, { parentId: "parent" }),
      grow: frame("grow", 0, 0, 10, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
      }),
    };
    const wide = layoutAutoNode(
      "parent",
      {
        parent: rootFrame("parent", {
          layoutMode: "horizontal",
          width: 200,
          height: 80,
          layoutGap: 0,
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          layoutSizingHorizontal: "fixed",
          layoutSizingVertical: "fixed",
        }),
        ...baseChild,
      },
      childOrder,
    );
    const narrow = layoutAutoNode(
      "parent",
      {
        parent: rootFrame("parent", {
          layoutMode: "horizontal",
          width: 80,
          height: 80,
          layoutGap: 0,
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          layoutSizingHorizontal: "fixed",
          layoutSizingVertical: "fixed",
        }),
        ...baseChild,
      },
      childOrder,
    );
    assert.equal(wide.children.grow?.width, 150);
    assert.equal(narrow.children.grow?.width, 30);
    assert.ok((narrow.children.grow?.width ?? 0) < (wide.children.grow?.width ?? 0));
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

describe("layoutEngine — sizing pipeline", () => {
  it("pass 4–5: fill children consume remaining space after fixed siblings", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        width: 300,
        height: 80,
        layoutGap: 10,
        paddingLeft: 0,
        paddingRight: 0,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      fixed: frame("fixed", 0, 0, 60, 40, { parentId: "parent" }),
      fill: frame("fill", 0, 0, 10, 40, {
        parentId: "parent",
        layoutSizingHorizontal: "fill",
      }),
    };
    const childOrder = { parent: ["fixed", "fill"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.fixed?.width, 60);
    assert.equal(out.children.fill?.width, 300 - 60 - 10);
  });

  it("pass 2: hug width follows padding + children + gaps", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      row: rootFrame("row", {
        layoutMode: "horizontal",
        layoutGap: 8,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 4,
        paddingBottom: 4,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
      }),
      a: frame("a", 0, 0, 30, 20, { parentId: "row" }),
      b: frame("b", 0, 0, 50, 20, { parentId: "row" }),
    };
    const childOrder = { row: ["a", "b"] };
    const out = layoutAutoNode("row", nodes, childOrder);
    assert.equal(out.parent?.width, 12 + 30 + 8 + 50 + 12);
  });

  it("pass 6: fill cross axis stretches to parent inner height", () => {
    const nodes: Record<string, LayoutEngineNode> = {
      parent: rootFrame("parent", {
        layoutMode: "horizontal",
        width: 200,
        height: 100,
        layoutGap: 0,
        paddingTop: 10,
        paddingBottom: 10,
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
      }),
      child: frame("child", 0, 0, 80, 20, {
        parentId: "parent",
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fill",
      }),
    };
    const childOrder = { parent: ["child"] };
    const out = layoutAutoNode("parent", nodes, childOrder);
    assert.equal(out.children.child?.height, 80);
    assert.equal(out.children.child?.y, 10);
  });
});
