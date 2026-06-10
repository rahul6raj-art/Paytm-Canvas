import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  angularStopLocalPointFromPosition,
  angularStopPositionFromLocalPoint,
  cssConicAngleFromAtan2Deg,
  fillPaintCss,
  gradientKindUsesCssPaint,
  gradientStopLocalPoint,
  newGradientStopId,
  normalizeFillGradient,
  positionFromLocalPoint,
  svgFillPaint,
  type FillGradient,
} from "@/lib/fillGradient";
import { fillAngularImageData, fillDiamondImageData, interpolateGradientStopColor } from "@/lib/gradientRaster";

function sampleGradient(kind: FillGradient["kind"]): FillGradient {
  return {
    kind,
    transform: { cx: 0.5, cy: 0.5, width: 1, height: 1, rotation: 45 },
    stops: [
      { id: newGradientStopId(), color: "#ff0000", position: 0 },
      { id: newGradientStopId(), color: "#0000ff", position: 100 },
    ],
  };
}

describe("gradient kinds", () => {
  it("flags angular and diamond for CSS paint", () => {
    assert.equal(gradientKindUsesCssPaint("angular"), true);
    assert.equal(gradientKindUsesCssPaint("diamond"), true);
    assert.equal(gradientKindUsesCssPaint("linear"), false);
    assert.equal(gradientKindUsesCssPaint("radial"), false);
  });

  it("produces conic CSS for angular fills", () => {
    const css = fillPaintCss({
      fillEnabled: true,
      fillOpacity: 1,
      fillType: "gradient",
      fillGradient: sampleGradient("angular"),
    });
    assert.match(css, /conic-gradient\(from 45deg at 50% 50%/);
  });

  it("produces layered CSS for diamond fills", () => {
    const css = fillPaintCss({
      fillEnabled: true,
      fillOpacity: 1,
      fillType: "gradient",
      fillGradient: sampleGradient("diamond"),
    });
    assert.match(css, /radial-gradient\(/);
    assert.match(css, /linear-gradient\(/);
  });

  it("registers angular SVG pattern with slice paths", () => {
    const defs: string[] = [];
    const fill = svgFillPaint(
      {
        fillEnabled: true,
        fillOpacity: 1,
        fillType: "gradient",
        fillGradient: sampleGradient("angular"),
      },
      {
        gradientId: "test-angular",
        width: 100,
        height: 80,
        registerGradient: (_id, markup) => defs.push(markup),
      },
    );
    assert.equal(fill, "url(#test-angular)");
    assert.equal(defs.length, 1);
    assert.match(defs[0]!, /pattern id="test-angular"/);
    assert.match(defs[0]!, /<path d="M /);
  });

  it("registers diamond SVG pattern markup", () => {
    const defs: string[] = [];
    const fill = svgFillPaint(
      {
        fillEnabled: true,
        fillOpacity: 1,
        fillType: "gradient",
        fillGradient: sampleGradient("diamond"),
      },
      {
        gradientId: "test-diamond",
        width: 100,
        height: 80,
        registerGradient: (_id, markup) => defs.push(markup),
      },
    );
    assert.equal(fill, "url(#test-diamond)");
    assert.equal(defs.length, 1);
    assert.match(defs[0]!, /pattern id="test-diamond"/);
  });

  it("interpolates stop colors for angular raster", () => {
    const g = normalizeFillGradient(sampleGradient("angular"));
    const mid = interpolateGradientStopColor(g.stops, 50, 1);
    assert.match(mid, /^rgba\(\d+,\d+,\d+,/);
  });

  it("maps angular stops using CSS conic angles (0% = up)", () => {
    const g = normalizeFillGradient(sampleGradient("angular"));
    g.transform.rotation = 0;
    const w = 100;
    const h = 100;
    const cx = 50;
    const cy = 50;

    assert.equal(cssConicAngleFromAtan2Deg(-90), 0);
    assert.equal(cssConicAngleFromAtan2Deg(0), 90);

    const up = angularStopLocalPointFromPosition(g.transform, 0, w, h);
    assert.ok(Math.abs(up.x - cx) < 0.01);
    assert.ok(Math.abs(up.y - (cy - 50)) < 0.01);

    const right = angularStopLocalPointFromPosition(g.transform, 25, w, h);
    assert.ok(Math.abs(right.x - (cx + 50)) < 0.01);
    assert.ok(Math.abs(right.y - cy) < 0.01);

    assert.ok(Math.abs(positionFromLocalPoint(g, up.x, up.y, w, h)) < 1);
    assert.ok(Math.abs(positionFromLocalPoint(g, right.x, right.y, w, h) - 25) < 1);

    const stop0 = g.stops[0]!;
    const lp = gradientStopLocalPoint(g, { ...stop0, position: 0 }, w, h);
    assert.ok(Math.abs(lp.x - up.x) < 0.01);
    assert.ok(Math.abs(lp.y - up.y) < 0.01);

    assert.ok(
      Math.abs(angularStopPositionFromLocalPoint(g.transform, right.x, right.y, w, h) - 25) < 1,
    );
  });

  it("fills angular and diamond image buffers", () => {
    const angular = normalizeFillGradient(sampleGradient("angular"));
    const diamond = normalizeFillGradient(sampleGradient("diamond"));
    const angularData = new Uint8ClampedArray(4 * 4);
    const diamondData = new Uint8ClampedArray(4 * 4);
    fillAngularImageData(angularData, angular, 2, 2, 1);
    fillDiamondImageData(diamondData, diamond, 2, 2, 1);
    assert.ok(angularData.some((v) => v > 0));
    assert.ok(diamondData.some((v) => v > 0));
  });
});
