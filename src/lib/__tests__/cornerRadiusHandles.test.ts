import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldShowCornerRadiusHandlesOnCanvas,
  supportsCornerRadiusHandles,
  supportsParametricShapeCornerRadiusHandles,
} from "@/lib/cornerRadius";
import { cornerRadiusHandlePosition } from "@/lib/shapes/shapeToPath";

const baseGate = {
  editorMode: "design" as const,
  tool: "move" as const,
  penDrawingNodeId: null,
  pencilDrawingNodeId: null,
  isPlacingComment: false,
  selectedIds: ["r1"],
  transformInteractionMode: "none" as const,
  dragActive: false,
};

describe("corner radius handles", () => {
  it("supports rectangle and frame only", () => {
    assert.equal(supportsCornerRadiusHandles({ type: "rectangle", visible: true, locked: false }), true);
    assert.equal(supportsCornerRadiusHandles({ type: "frame", visible: true, locked: false }), true);
    assert.equal(supportsCornerRadiusHandles({ type: "ellipse", visible: true, locked: false }), false);
  });

  it("shows on single-selected rectangle in move tool without edit mode", () => {
    assert.equal(
      shouldShowCornerRadiusHandlesOnCanvas(baseGate, {
        type: "rectangle",
        visible: true,
        locked: false,
      }),
      true,
    );
  });

  it("hides during resize, rotate, and move drag", () => {
    const node = { type: "rectangle" as const, visible: true, locked: false };
    assert.equal(
      shouldShowCornerRadiusHandlesOnCanvas(
        { ...baseGate, transformInteractionMode: "resize" },
        node,
      ),
      false,
    );
    assert.equal(
      shouldShowCornerRadiusHandlesOnCanvas(
        { ...baseGate, transformInteractionMode: "rotate" },
        node,
      ),
      false,
    );
    assert.equal(
      shouldShowCornerRadiusHandlesOnCanvas({ ...baseGate, dragActive: true }, node),
      false,
    );
  });

  it("handle sits inside top-left corner on bisector when radius is set", () => {
    const p = cornerRadiusHandlePosition(100, 100, [20, 0, 0, 0], 0);
    assert.equal(p.x, 20);
    assert.equal(p.y, 20);
  });

  it("handle uses min inset inside corner when radius is zero", () => {
    const p = cornerRadiusHandlePosition(100, 100, [0, 0, 0, 0], 0, 12);
    assert.equal(p.x, 12);
    assert.equal(p.y, 12);
  });

  it("handle position stays finite when dimensions are NaN", () => {
    const p = cornerRadiusHandlePosition(Number.NaN, 100, [0, 0, 0, 0], 0, 12);
    assert.ok(Number.isFinite(p.x));
    assert.ok(Number.isFinite(p.y));
  });
});

describe("parametric shape corner radius handles", () => {
  it("supports polygon and star nodes", () => {
    assert.equal(
      supportsParametricShapeCornerRadiusHandles({
        type: "path",
        visible: true,
        locked: false,
        polygonSides: 3,
        starPoints: undefined,
      }),
      true,
    );
    assert.equal(
      supportsParametricShapeCornerRadiusHandles({
        type: "path",
        visible: true,
        locked: false,
        polygonSides: undefined,
        starPoints: 5,
      }),
      true,
    );
  });
});
