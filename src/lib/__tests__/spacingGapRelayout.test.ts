import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyLayoutPatchWithAutoLayout } from "@/lib/autoLayout";
import type { LayoutNode } from "@/lib/autoLayout";

function alFrame(extra: Partial<LayoutNode> = {}): LayoutNode {
  return {
    id: "f",
    parentId: null,
    type: "frame",
    x: 0,
    y: 0,
    width: 141,
    height: 297,
    visible: true,
    locked: false,
    layoutMode: "vertical",
    layoutGap: 10,
    paddingTop: 12,
    paddingRight: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    primaryAxisAlign: "start",
    layoutSizingVertical: "fixed",
    layoutSizingHorizontal: "fixed",
    ...extra,
  };
}

function rect(id: string, y: number, h = 80): LayoutNode {
  return {
    id,
    parentId: "f",
    type: "rectangle",
    x: 12,
    y,
    width: 117,
    height: h,
    visible: true,
    locked: false,
  };
}

describe("spacing gap relayout", () => {
  it("increases horizontal gap when center-aligned frame switches to start", () => {
    const nodes: Record<string, LayoutNode> = {
      f: alFrame({
        layoutMode: "horizontal",
        width: 200,
        height: 80,
        primaryAxisAlign: "center",
      }),
      a: { ...rect("a", 12), x: 12, y: 12, width: 40, height: 40 },
      b: { ...rect("b", 12), x: 92, y: 12, width: 40, height: 40 },
    };
    const childOrder = { f: ["a", "b"] };
    const base = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {});
    const bumped = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {
      layoutGap: 40,
      layoutGapAuto: false,
      primaryAxisAlign: "start",
    });
    const gapBefore = (base.b!.x ?? 0) - ((base.a!.x ?? 0) + (base.a!.width ?? 0));
    const gapAfter = (bumped.b!.x ?? 0) - ((bumped.a!.x ?? 0) + (bumped.a!.width ?? 0));
    assert.equal(gapBefore, 10);
    assert.equal(gapAfter, 40);
  });

  it("increases vertical child offset when layoutGap grows", () => {
    const nodes: Record<string, LayoutNode> = {
      f: alFrame(),
      a: rect("a", 12),
      b: rect("b", 102),
    };
    const childOrder = { f: ["a", "b"] };
    const base = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {});
    const bumped = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {
      layoutGap: 40,
      layoutGapAuto: false,
    });
    assert.ok((bumped.b!.y ?? 0) > (base.b!.y ?? 0));
  });

  it("overlaps children when layoutGap is negative", () => {
    const nodes: Record<string, LayoutNode> = {
      f: alFrame({
        layoutMode: "horizontal",
        width: 200,
        height: 80,
        primaryAxisAlign: "start",
      }),
      a: { ...rect("a", 12), x: 12, y: 12, width: 40, height: 40 },
      b: { ...rect("b", 12), x: 92, y: 12, width: 40, height: 40 },
    };
    const childOrder = { f: ["a", "b"] };
    const out = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {
      layoutGap: -12,
      layoutGapAuto: false,
    });
    const gap = (out.b!.x ?? 0) - ((out.a!.x ?? 0) + (out.a!.width ?? 0));
    assert.equal(gap, -12);
    assert.equal(out.a!.width, 40);
    assert.equal(out.b!.width, 40);
    assert.equal(out.a!.height, 40);
    assert.equal(out.b!.height, 40);
  });

  it("shrinks hug frame for negative gap without shrinking fixed children", () => {
    const nodes: Record<string, LayoutNode> = {
      f: alFrame({
        layoutMode: "horizontal",
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "fixed",
        height: 80,
        primaryAxisAlign: "start",
      }),
      a: { ...rect("a", 12), x: 12, y: 12, width: 50, height: 40 },
      b: { ...rect("b", 12), x: 102, y: 12, width: 60, height: 40 },
    };
    const childOrder = { f: ["a", "b"] };
    const zeroGap = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {
      layoutGap: 0,
      layoutGapAuto: false,
    });
    const negGap = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {
      layoutGap: -20,
      layoutGapAuto: false,
    });
    assert.equal(zeroGap.f!.width, 12 + 50 + 60 + 12);
    assert.equal(negGap.f!.width, 12 + 50 + 60 - 20 + 12);
    assert.equal(negGap.a!.width, 50);
    assert.equal(negGap.b!.width, 60);
    const visualGap =
      (negGap.b!.x ?? 0) - ((negGap.a!.x ?? 0) + (negGap.a!.width ?? 0));
    assert.equal(visualGap, -20);
  });

  it("grows fixed primary-size frame when positive layoutGap increases", () => {
    const nodes: Record<string, LayoutNode> = {
      f: alFrame({
        layoutMode: "horizontal",
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
        width: 200,
        height: 80,
        primaryAxisAlign: "start",
      }),
      a: { ...rect("a", 12), x: 12, y: 12, width: 40, height: 40 },
      b: { ...rect("b", 12), x: 92, y: 12, width: 40, height: 40 },
    };
    const childOrder = { f: ["a", "b"] };
    const small = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {
      layoutGap: 8,
      layoutGapAuto: false,
    });
    const large = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {
      layoutGap: 32,
      layoutGapAuto: false,
    });
    assert.equal(small.f!.width, 12 + 40 + 8 + 40 + 12);
    assert.equal(large.f!.width, 12 + 40 + 32 + 40 + 12);
    assert.ok((large.f!.width ?? 0) > (small.f!.width ?? 0));
  });

  it("keeps clipped fixed frame size when layoutGap changes", () => {
    const nodes: Record<string, LayoutNode> = {
      f: alFrame({
        layoutMode: "horizontal",
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
        width: 120,
        height: 80,
        clipChildren: true,
        primaryAxisAlign: "start",
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
      }),
      a: { ...rect("a", 0), x: 0, y: 0, width: 50, height: 40 },
      b: { ...rect("b", 0), x: 58, y: 0, width: 50, height: 40 },
    };
    const childOrder = { f: ["a", "b"] };
    const gap8 = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {
      layoutGap: 8,
      layoutGapAuto: false,
    });
    const gap32 = applyLayoutPatchWithAutoLayout(nodes, childOrder, "f", {
      layoutGap: 32,
      layoutGapAuto: false,
    });
    assert.equal(gap8.f!.width, 120);
    assert.equal(gap32.f!.width, 120);
    assert.equal(gap32.f!.height, 80);
    assert.equal((gap32.b!.x ?? 0) - ((gap32.a!.x ?? 0) + (gap32.a!.width ?? 0)), 32);
  });
});
