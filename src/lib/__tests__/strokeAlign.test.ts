import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveStrokeSideWidths,
  resolveStrokeSides,
  shouldUseAlignedPathStroke,
  strokeEdgeRects,
  resolveStrokeSideColor,
  strokeSideColorsAreMixed,
  strokeSideWeightsAreMixed,
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

  it("uses geometry paths for partial strokes on rounded rectangles", () => {
    const node = {
      type: "rectangle" as const,
      width: 100,
      height: 60,
      strokeSides: "top" as const,
      strokePosition: "inside" as const,
      strokeStyle: "solid" as const,
      cornerRadius: 24,
    };
    assert.equal(usesPerEdgeStroke(node), true);
    assert.equal(strokeUsesCssIndividualBorders(node), false);
  });

  it("uses CSS individual borders for partial solid strokes on sharp rectangles", () => {
    const node = {
      type: "rectangle" as const,
      strokeSides: "top" as const,
      strokePosition: "inside" as const,
      strokeStyle: "solid" as const,
      cornerRadius: 0,
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

  it("detects mixed active side weights", () => {
    assert.equal(
      strokeSideWeightsAreMixed({
        strokeWidth: 4,
        strokeSides: "custom",
        strokeSidesCustom: { top: 8, right: 2, bottom: 0, left: 0 },
      }),
      true,
    );
    assert.equal(
      strokeSideWeightsAreMixed({
        strokeWidth: 4,
        strokeSides: "custom",
        strokeSidesCustom: { top: 4, right: 4, bottom: 0, left: 0 },
      }),
      false,
    );
    assert.equal(
      strokeSideWeightsAreMixed({
        strokeWidth: 4,
        strokeSides: "top",
      }),
      false,
    );
  });

  it("resolves per-side stroke colors with fallback", () => {
    assert.equal(
      resolveStrokeSideColor({ strokeColor: "#111111", strokeSidesCustomColors: { top: "#ff0000" } }, "top"),
      "#ff0000",
    );
    assert.equal(
      resolveStrokeSideColor({ strokeColor: "#111111", strokeSidesCustomColors: { top: "#ff0000" } }, "left"),
      "#111111",
    );
  });

  it("detects mixed active side colors", () => {
    assert.equal(
      strokeSideColorsAreMixed({
        strokeWidth: 4,
        strokeSides: "custom",
        strokeSidesCustom: { top: 4, right: 4, bottom: 0, left: 0 },
        strokeColor: "#111111",
        strokeSidesCustomColors: { top: "#ff0000", right: "#0000ff" },
      }),
      true,
    );
    assert.equal(
      strokeSideColorsAreMixed({
        strokeWidth: 4,
        strokeSides: "custom",
        strokeSidesCustom: { top: 4, right: 4, bottom: 0, left: 0 },
        strokeColor: "#111111",
      }),
      false,
    );
  });

  it("uses per-edge stroke when all sides active but colors differ", () => {
    const node = {
      type: "rectangle" as const,
      width: 100,
      height: 60,
      strokeWidth: 4,
      strokeSides: "custom" as const,
      strokeSidesCustom: { top: 4, right: 4, bottom: 4, left: 4 },
      strokeColor: "#111111",
      strokeSidesCustomColors: { top: "#ff0000", right: "#0000ff" },
      strokePosition: "inside" as const,
      strokeStyle: "solid" as const,
      cornerRadius: 0,
    };
    assert.equal(usesPerEdgeStroke(node), true);
    assert.equal(strokeUsesCssIndividualBorders(node), false);
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
