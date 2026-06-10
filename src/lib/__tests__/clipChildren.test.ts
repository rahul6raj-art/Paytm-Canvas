import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clipContentContainerStyle,
  shouldClipChildren,
} from "@/lib/clipChildren";
import { applyDeepAutoLayout, type LayoutNode } from "@/lib/autoLayout";

function frame(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<LayoutNode> = {},
): LayoutNode {
  return {
    id,
    parentId: null,
    type: "frame",
    x,
    y,
    width,
    height,
    visible: true,
    locked: false,
    ...extra,
  };
}

describe("clipChildren", () => {
  it("clips only when explicitly enabled", () => {
    assert.equal(shouldClipChildren({ type: "frame" }), false);
    assert.equal(shouldClipChildren({ type: "frame", clipChildren: false }), false);
    assert.equal(shouldClipChildren({ type: "frame", clipChildren: true }), true);
  });

  it("returns clip-path styles for canvas child containers", () => {
    const style = clipContentContainerStyle({ type: "frame", clipChildren: true }, 8);
    assert.equal(style.overflow, "hidden");
    assert.match(String(style.clipPath), /inset\(0 round 8px\)/);
  });

  it("hug auto-layout frame with clip keeps size instead of expanding", () => {
    const nodes: Record<string, LayoutNode> = {
      parent: {
        id: "parent",
        parentId: null,
        type: "frame",
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        visible: true,
        locked: false,
        layoutMode: "horizontal",
        layoutGap: 8,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        layoutSizingHorizontal: "hug",
        layoutSizingVertical: "hug",
        clipChildren: true,
      },
      a: frame("a", 0, 0, 60, 40, { parentId: "parent" }),
      b: frame("b", 0, 0, 60, 40, { parentId: "parent" }),
    };
    const childOrder = { parent: ["a", "b"] };
    const next = applyDeepAutoLayout(nodes, childOrder, "parent");
    assert.equal(next.parent!.width, 100);
    assert.equal(next.parent!.height, 80);
    assert.ok((next.b!.x ?? 0) + (next.b!.width ?? 0) > 100);
  });
});
