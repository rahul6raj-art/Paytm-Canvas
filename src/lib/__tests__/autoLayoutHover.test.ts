import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAutoLayoutHoverContext } from "@/lib/autoLayout/autoLayoutHover";
import type { EditorNode } from "@/stores/useEditorStore";

function hStack(): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  const nodes: Record<string, EditorNode> = {
    f: {
      id: "f",
      parentId: null,
      type: "frame",
      name: "Stack",
      x: 0,
      y: 0,
      width: 200,
      height: 80,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      layoutMode: "horizontal",
      layoutGap: 16,
      paddingTop: 8,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8,
    },
    a: {
      id: "a",
      parentId: "f",
      type: "rectangle",
      name: "A",
      x: 8,
      y: 8,
      width: 50,
      height: 40,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
    },
    b: {
      id: "b",
      parentId: "f",
      type: "rectangle",
      name: "B",
      x: 74,
      y: 8,
      width: 50,
      height: 40,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
    },
  };
  return { nodes, childOrder: { f: ["a", "b"] } };
}

describe("autoLayoutHover", () => {
  it("returns gap guides for middle child in horizontal stack", () => {
    const { nodes, childOrder } = hStack();
    const ctx = getAutoLayoutHoverContext("a", nodes, childOrder);
    assert.ok(ctx);
    assert.equal(ctx.hoveredChildId, "a");
    assert.equal(ctx.gapGuides.length, 1);
    assert.equal(ctx.gapGuides[0]!.gap, 16);
  });

  it("ignores absolute positioned children", () => {
    const { nodes, childOrder } = hStack();
    nodes.b = { ...nodes.b!, layoutPositioning: "absolute" };
    const ctx = getAutoLayoutHoverContext("b", nodes, childOrder);
    assert.equal(ctx, null);
  });
});
