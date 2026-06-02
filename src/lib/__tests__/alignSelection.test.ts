import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  alignNodesInDocument,
  applyAlignToNodes,
  suspendAutoLayoutForManualPosition,
} from "@/lib/alignSelection";
import { getNodeTransformedWorldBounds } from "@/lib/transformMath";

function rect(id: string, x: number, y: number, w: number, h: number, rot?: number): EditorNode {
  return {
    id,
    parentId: null,
    type: "rectangle",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: rot ?? 0,
    visible: true,
    locked: false,
    expanded: true,
  };
}

describe("applyAlignToNodes", () => {
  it("aligns left edges in world space", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 10, 20, 40, 30),
      b: rect("b", 80, 50, 30, 20),
    };
    const out = applyAlignToNodes(nodes, ["a", "b"], "left");
    const ba = getNodeTransformedWorldBounds("a", out);
    const bb = getNodeTransformedWorldBounds("b", out);
    assert.equal(ba.x, bb.x);
  });

  it("aligns rotated layers by visual bounds", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 100, 40, 0),
      b: rect("b", 200, 0, 100, 40, 45),
    };
    const out = applyAlignToNodes(nodes, ["a", "b"], "top");
    const ba = getNodeTransformedWorldBounds("a", out);
    const bb = getNodeTransformedWorldBounds("b", out);
    assert.ok(Math.abs(ba.y - bb.y) < 0.5, `expected same top, got ${ba.y} vs ${bb.y}`);
  });

  it("aligns children inside an offset frame", () => {
    const nodes: Record<string, EditorNode> = {
      frame: {
        ...rect("frame", 100, 50, 400, 300),
        type: "frame",
        name: "Frame",
      },
      a: { ...rect("a", 10, 20, 40, 30), parentId: "frame" },
      b: { ...rect("b", 120, 80, 30, 20), parentId: "frame" },
    };
    const out = applyAlignToNodes(nodes, ["a", "b"], "left");
    const ba = getNodeTransformedWorldBounds("a", out);
    const bb = getNodeTransformedWorldBounds("b", out);
    assert.equal(ba.x, bb.x);
  });
});

describe("suspendAutoLayoutForManualPosition", () => {
  it("disables auto-layout on the shared parent", () => {
    const nodes: Record<string, EditorNode> = {
      parent: {
        ...rect("parent", 0, 0, 200, 200),
        type: "frame",
        layoutMode: "horizontal",
        layoutGap: 8,
      },
      a: { ...rect("a", 0, 0, 40, 40), parentId: "parent" },
      b: { ...rect("b", 60, 0, 40, 40), parentId: "parent" },
    };
    const out = suspendAutoLayoutForManualPosition(nodes, ["a", "b"]);
    assert.equal(out.parent?.layoutMode, "none");
  });
});

describe("alignNodesInDocument", () => {
  it("aligns siblings inside an auto-layout frame", () => {
    const nodes: Record<string, EditorNode> = {
      parent: {
        ...rect("parent", 0, 0, 300, 120),
        type: "frame",
        layoutMode: "horizontal",
        layoutGap: 16,
        paddingLeft: 8,
        paddingTop: 8,
      },
      a: { ...rect("a", 8, 8, 50, 40), parentId: "parent" },
      b: { ...rect("b", 90, 8, 50, 40), parentId: "parent" },
    };
    const out = alignNodesInDocument(nodes, ["a", "b"], "top");
    assert.equal(out.parent?.layoutMode, "none");
    const ba = getNodeTransformedWorldBounds("a", out);
    const bb = getNodeTransformedWorldBounds("b", out);
    assert.ok(Math.abs(ba.y - bb.y) < 0.5);
  });
});
