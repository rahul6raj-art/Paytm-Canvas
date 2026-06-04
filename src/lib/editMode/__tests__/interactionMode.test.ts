import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCanvasInteractionMode } from "../interactionMode";

describe("resolveCanvasInteractionMode", () => {
  const base = {
    tool: "move",
    editingTextId: null,
    shapeEditModeNodeId: null,
    pathEditModeNodeId: null,
    transformInteractionMode: "none" as const,
    isMovingSelection: false,
  };

  it("returns textEdit when editing text", () => {
    assert.equal(
      resolveCanvasInteractionMode({ ...base, editingTextId: "t1" }),
      "textEdit",
    );
  });

  it("returns edit for shape or path edit", () => {
    assert.equal(
      resolveCanvasInteractionMode({ ...base, shapeEditModeNodeId: "n1" }),
      "edit",
    );
    assert.equal(
      resolveCanvasInteractionMode({ ...base, pathEditModeNodeId: "n1" }),
      "edit",
    );
  });

  it("returns resize/rotate during transform gestures", () => {
    assert.equal(
      resolveCanvasInteractionMode({ ...base, transformInteractionMode: "resize" }),
      "resize",
    );
    assert.equal(
      resolveCanvasInteractionMode({ ...base, transformInteractionMode: "rotate" }),
      "rotate",
    );
  });

  it("returns move while dragging selection", () => {
    assert.equal(
      resolveCanvasInteractionMode({ ...base, isMovingSelection: true }),
      "move",
    );
  });
});
