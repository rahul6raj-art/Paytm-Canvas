import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gradientInspectorBarPaintCss,
  newGradientStopId,
  type FillGradient,
} from "@/lib/fillGradient";

describe("gradient inspector bar", () => {
  it("uses a horizontal preview regardless of gradient angle", () => {
    const g: FillGradient = {
      kind: "linear",
      transform: { cx: 0.5, cy: 0.5, width: 1, height: 1, rotation: 307.855 },
      stops: [
        { id: newGradientStopId(), color: "#ece9e9", position: 0 },
        { id: newGradientStopId(), color: "#ffffff", position: 100 },
      ],
    };
    const css = gradientInspectorBarPaintCss(g, 1);
    assert.match(css, /^linear-gradient\(to right,/);
    assert.doesNotMatch(css, /307\.855deg/);
  });
});
