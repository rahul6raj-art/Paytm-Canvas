import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickNodesInMarquee } from "@/lib/canvasMarqueeSelection";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(id: string, parentId: string | null, x: number, y: number, w: number, h: number): EditorNode {
  return {
    id,
    parentId,
    type: "frame",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
  };
}

function text(id: string, parentId: string, x: number, y: number): EditorNode {
  return {
    id,
    parentId,
    type: "text",
    name: id,
    x,
    y,
    width: 120,
    height: 24,
    rotation: 0,
    visible: true,
    locked: false,
    content: "Label",
  };
}

describe("pickNodesInMarquee", () => {
  it("selects the frame only when marquee covers frame and nested text", () => {
    const nodes: Record<string, EditorNode> = {
      screen: frame("screen", null, 0, 0, 376, 844),
      label: text("label", "screen", 24, 80),
    };

    const picked = pickNodesInMarquee(nodes, { x0: 0, y0: 0, x1: 376, y1: 844 });
    assert.deepEqual(picked, ["screen"]);
  });
});
