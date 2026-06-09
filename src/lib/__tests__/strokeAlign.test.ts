import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveStrokeSideWidths,
  resolveStrokeSides,
  shouldUseAlignedPathStroke,
  strokeEdgeRects,
  strokeUsesCssIndividualBorders,
  usesPerEdgeStroke,
} from "@/lib/strokeAlign";

describe("strokeAlign", () => {
  it("resolves single-side presets", () => {
    assert.deepEqual(resolveStrokeSides({ strokeSides: "top" }), {
      top: true,
      right: false,
      bottom: false,
      left: false,
    });
  });

  it("uses CSS individual borders for partial solid strokes on rectangles", () => {
    const node = {
      type: "rectangle" as const,
      strokeSides: "top" as const,
      strokePosition: "inside" as const,
      strokeStyle: "solid" as const,
      cornerRadius: 24,
    };
    assert.equal(usesPerEdgeStroke(node), true);
    assert.equal(strokeUsesCssIndividualBorders(node), true);
  });

  it("uses CSS borders for center partial strokes (Figma inset band model)", () => {
    const node = {
      type: "rectangle" as const,
      strokeSides: "top" as const,
      strokePosition: "center" as const,
      strokeStyle: "solid" as const,
    };
    assert.equal(strokeUsesCssIndividualBorders(node), true);
  });

  it("uses per-edge rects only for partial sides on sharp rects with outside stroke", () => {
    const node = {
      type: "rectangle" as const,
      strokeSides: "top" as const,
      strokePosition: "outside" as const,
      strokeStyle: "solid" as const,
    };
    assert.equal(usesPerEdgeStroke(node), true);
    assert.equal(strokeUsesCssIndividualBorders(node), false);
    const sides = resolveStrokeSides(node);
    const sideWidths = resolveStrokeSideWidths({ ...node, strokeWidth: 4 });
    const rects = strokeEdgeRects(100, 50, "center", sides, sideWidths);
    assert.equal(rects.length, 1);
    assert.equal(rects[0]!.height, 4);
  });

  it("does not use per-edge rects for inside stroke when all sides are selected", () => {
    const node = {
      type: "rectangle" as const,
      strokeSides: "all" as const,
      strokePosition: "inside" as const,
    };
    assert.equal(usesPerEdgeStroke(node), false);
    assert.equal(shouldUseAlignedPathStroke(node, true), true);
  });

  it("uses aligned path stroke for outside on closed paths", () => {
    const node = {
      type: "ellipse" as const,
      strokePosition: "outside" as const,
      strokeSides: "all" as const,
    };
    assert.equal(shouldUseAlignedPathStroke(node, true), true);
    assert.equal(shouldUseAlignedPathStroke(node, false), false);
  });
});
