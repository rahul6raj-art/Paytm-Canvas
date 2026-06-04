import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveStrokeSides,
  shouldUseAlignedPathStroke,
  strokeEdgeRects,
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

  it("uses per-edge rects when only top side is stroked", () => {
    const node = {
      type: "rectangle" as const,
      strokeSides: "top" as const,
      strokePosition: "inside" as const,
    };
    assert.equal(usesPerEdgeStroke(node), true);
    const rects = strokeEdgeRects(100, 50, 4, "inside", resolveStrokeSides(node));
    assert.equal(rects.length, 1);
    assert.equal(rects[0]!.height, 4);
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
