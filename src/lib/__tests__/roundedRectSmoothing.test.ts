import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPiecewiseSmoothedRoundedRectPath,
  buildRoundedRectPath,
  buildSuperellipseRoundedRectPath,
  superellipseExponentFromSmoothing,
} from "@/lib/vector/roundedRectPath";
import {
  buildRoundedRectSmoothingComparison,
  measureTopRightCornerTransition,
} from "@/lib/vector/roundedRectSmoothingAnalysis";
import { buildRoundedRectSmoothingComparisonFixtureSvg } from "@/lib/vector/roundedRectSmoothingComparisonFixture";
import { analyzeRoundedRectPath } from "@/lib/vector/roundedRectPathDebug";

describe("roundedRectSmoothing", () => {
  it("maps smoothing to superellipse exponent n≥2", () => {
    assert.equal(superellipseExponentFromSmoothing(0), 2);
    assert.equal(superellipseExponentFromSmoothing(0.6), 3.2);
    assert.equal(superellipseExponentFromSmoothing(1), 4);
  });

  it("superellipse path differs from legacy piecewise cubic+arc", () => {
    const radii = { topLeft: 80, topRight: 80, bottomRight: 80, bottomLeft: 80 };
    const piecewise = buildPiecewiseSmoothedRoundedRectPath(0, 0, 300, 300, radii, 0.6);
    const superellipse = buildSuperellipseRoundedRectPath(0, 0, 300, 300, radii, 0.6);
    assert.notEqual(piecewise, superellipse);
    assert.ok(superellipse.endsWith(" Z"));
    assert.ok(!superellipse.includes(" A "));
  });

  it("canvas smoothed path uses superellipse model without arc commands", () => {
    const d = buildRoundedRectPath({ width: 300, height: 300, radius: 80, smoothing: 0.6 });
    assert.ok(d.includes(" C "));
    assert.ok(!d.includes(" A "));
    assert.ok(analyzeRoundedRectPath({ width: 300, height: 300, radius: 80, smoothing: 0.6 }).closed);
  });

  it("superellipse begins turning sooner than piecewise (earlier vertical taper)", () => {
    const params = { width: 300, height: 300, radius: 80, smoothing: 0.6 as const };
    const comparison = buildRoundedRectSmoothingComparison(params);
    assert.ok(
      comparison.superellipse.peakCurvature < comparison.piecewise.peakCurvature,
      "superellipse should avoid abrupt curvature spike at tangent",
    );
    assert.ok(
      comparison.piecewise.peakCurvature / comparison.superellipse.peakCurvature > 5,
      "piecewise model spikes curvature much higher near tangent",
    );
  });

  it("exports visual comparison fixture with both models", () => {
    const svg = buildRoundedRectSmoothingComparisonFixtureSvg();
    assert.ok(svg.includes("Piecewise cubic + arc"));
    assert.ok(svg.includes("Superellipse (canvas)"));
    assert.ok(svg.includes('stroke="#ffffff"'));
  });

  it("measures tangent location on rect bounds", () => {
    const d = buildRoundedRectPath({ width: 140, height: 100, radius: 24, smoothing: 0.6 });
    const metrics = measureTopRightCornerTransition(d, 140, 100, 24, 0.6);
    assert.ok(metrics.verticalTangentY > 20);
    assert.ok(metrics.verticalTangentY <= 100);
    assert.ok(metrics.transitionArcLength > 0);
  });
});
