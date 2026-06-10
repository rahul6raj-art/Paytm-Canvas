import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyLayoutPatchWithAutoLayout } from "@/lib/autoLayout";
import { computeMinLayoutGap } from "@/lib/layoutEngine/minLayoutGap";
import type { LayoutNode } from "@/lib/autoLayout";

function alFrame(extra: Partial<LayoutNode> = {}): LayoutNode {
  return {
    id: "f",
    parentId: null,
    type: "frame",
    x: 0,
    y: 0,
    width: 200,
    height: 120,
    visible: true,
    locked: false,
    layoutMode: "vertical",
    layoutGap: 10,
    paddingTop: 12,
    paddingRight: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    primaryAxisAlign: "start",
    layoutSizingHorizontal: "fixed",
    layoutSizingVertical: "hug",
    ...extra,
  };
}

function rect(id: string, y: number, h: number): LayoutNode {
  return {
    id,
    parentId: "f",
    type: "rectangle",
    x: 12,
    y,
    width: 80,
    height: h,
    visible: true,
    locked: false,
  };
}

describe("computeMinLayoutGap", () => {
  it("allows negative gap until the last child reaches the inner top edge", () => {
    const nodes: Record<string, LayoutNode> = {
      f: alFrame(),
      a: rect("a", 12, 50),
      b: rect("b", 74, 40),
    };
    const childOrder = { f: ["a", "b"] };
    const minGap = computeMinLayoutGap("f", nodes, childOrder);
    assert.equal(minGap, -50);

    const out = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {
      layoutGap: minGap,
      layoutGapAuto: false,
    });
    assert.equal(out.b!.y, 12);
    assert.equal(out.a!.height, 50);
    assert.equal(out.b!.height, 40);
  });
});
