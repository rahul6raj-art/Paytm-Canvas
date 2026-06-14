import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isCanvasBgCreationTool,
  isCanvasCreationContainerHit,
} from "@/lib/canvasInteractionGuards";
import type { EditorNode } from "@/stores/useEditorStore";

describe("canvasInteractionGuards", () => {
  it("treats frame and plain group hits as creation containers", () => {
    const nodes: Record<string, EditorNode> = {
      f: { id: "f", type: "frame", visible: true, locked: false } as EditorNode,
      g: { id: "g", type: "group", visible: true, locked: false } as EditorNode,
      r: { id: "r", type: "rectangle", visible: true, locked: false } as EditorNode,
    };
    assert.equal(isCanvasCreationContainerHit("f", nodes), true);
    assert.equal(isCanvasCreationContainerHit("g", nodes), true);
    assert.equal(isCanvasCreationContainerHit("r", nodes), false);
    assert.equal(isCanvasCreationContainerHit(null, nodes), false);
  });

  it("marks shape tools as canvas background creation tools", () => {
    assert.equal(isCanvasBgCreationTool("rect", "design"), true);
    assert.equal(isCanvasBgCreationTool("move", "design"), false);
  });
});
