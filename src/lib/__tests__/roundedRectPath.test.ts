import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRoundedRectFillAndStrokePaths,
  buildRoundedRectPath,
  buildRoundedRectStrokePath,
  clampRoundedRectRadii,
  KAPPA,
  normalizeRoundedRectRadii,
  offsetRoundedRectPath,
} from "@/lib/vector/roundedRectPath";
import { buildRoundedRectVisualFixtureSvg } from "@/lib/vector/roundedRectVisualFixture";
import {
  analyzeRoundedRectPath,
  buildRoundedRectComparisonDebugSvg,
  buildRoundedRectDebugSvg,
  parsePathSegments,
} from "@/lib/vector/roundedRectPathDebug";

describe("roundedRectPath", () => {
  it("builds a sharp rectangle path when all radii are zero", () => {
    const d = buildRoundedRectPath({ width: 120, height: 80, radius: 0 });
    assert.equal(d, "M 0 0 H 120 V 80 H 0 Z");
  });

  it("uses cubic curves for regular rounded corners when smoothing is zero", () => {
    const d = buildRoundedRectPath({ width: 100, height: 60, radius: 20, smoothing: 0 });
    assert.ok(d.includes(" C "), "uses cubic Bézier corners");
    assert.ok(!d.includes(" A "), "does not use arc commands");
    assert.ok(d.endsWith(" Z"));
    const k = 20 * KAPPA;
    assert.ok(d.includes(`${20 - k}`) || d.includes(Number((20 - k).toFixed(4)).toString()));
  });

  it("builds a smoothed path distinct from the circular path", () => {
    const circular = buildRoundedRectPath({ width: 160, height: 100, radius: 32, smoothing: 0 });
    const smoothed = buildRoundedRectPath({ width: 160, height: 100, radius: 32, smoothing: 0.6 });
    assert.notEqual(circular, smoothed);
    assert.ok(smoothed.endsWith(" Z"));
    assert.ok(!smoothed.includes("NaN"));
  });

  it("smoothed path stays on rect bounds as one continuous perimeter", () => {
    const base = { width: 140, height: 100, radius: 24 };
    for (const smoothing of [0, 0.6] as const) {
      const analysis = analyzeRoundedRectPath({ ...base, smoothing });
      assert.ok(analysis.closed, `smoothing=${smoothing} must close with Z`);
      assert.ok(analysis.touchesTop, `smoothing=${smoothing} must touch top edge`);
      assert.ok(analysis.touchesRight, `smoothing=${smoothing} must touch right edge`);
      assert.ok(analysis.touchesBottom, `smoothing=${smoothing} must touch bottom edge`);
      assert.ok(analysis.touchesLeft, `smoothing=${smoothing} must touch left edge`);
      assert.ok(analysis.bounds.minX >= -0.5, `smoothing=${smoothing} minX in bounds`);
      assert.ok(analysis.bounds.maxX <= base.width + 0.5, `smoothing=${smoothing} maxX in bounds`);
      assert.ok(analysis.bounds.minY >= -0.5, `smoothing=${smoothing} minY in bounds`);
      assert.ok(analysis.bounds.maxY <= base.height + 0.5, `smoothing=${smoothing} maxY in bounds`);
      const kinds = analysis.segments.map((s) => s.kind);
      assert.ok(kinds.includes("M"), "must move-to start");
      assert.ok(kinds.includes("Z"), "must close");
      if (smoothing === 0) {
        assert.ok(analysis.hasHorizontalStraights && analysis.hasVerticalStraights);
      } else {
        assert.ok(kinds.includes("C"), "smoothed uses cubic transitions");
        assert.ok(!kinds.includes("A"), "superellipse smoothed path has no arc segments");
        assert.ok(kinds.filter((k) => k === "L").length >= 3, "smoothed connects right/bottom/left side edges");
        assert.ok(kinds.includes("Z"), "top edge closes back to start via Z");
      }
    }
  });

  it("parsePathSegments extracts H/V/C commands from full perimeter", () => {
    const d = buildRoundedRectPath({ width: 100, height: 60, radius: 20, smoothing: 0 });
    const segments = parsePathSegments(d);
    assert.deepEqual(
      segments.map((s) => s.kind),
      ["M", "H", "C", "V", "C", "H", "C", "V", "C", "Z"],
    );
  });

  it("parsePathSegments resolves smoothed superellipse paths on rect bounds", () => {
    const d = buildRoundedRectPath({ width: 140, height: 100, radius: 24, smoothing: 0.6 });
    const analysis = analyzeRoundedRectPath({ width: 140, height: 100, radius: 24, smoothing: 0.6 });
    assert.ok(analysis.bounds.minX >= -0.5);
    assert.ok(analysis.bounds.maxY <= 100.5);
    assert.ok(analysis.perimeterKinds.filter((k) => k === "C").length >= 8);
    assert.ok(analysis.perimeterKinds.includes("L"));
    assert.ok(!analysis.perimeterKinds.includes("A"));
  });

  it("builds a closed full-perimeter path for large rounded squares", () => {
    const fill = buildRoundedRectPath({ width: 300, height: 300, radius: 80, smoothing: 0 });
    assert.ok(fill.endsWith(" Z"));
    assert.ok(fill.includes(" H "));
    assert.ok(fill.includes(" V "));
    const nums = fill.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
    assert.equal(Math.min(...nums), 0);
    assert.equal(Math.max(...nums), 300);

    const base = { width: 300, height: 300, radius: 80, smoothing: 0 as const };
    const center = buildRoundedRectStrokePath({ ...base, strokeAlign: "center", strokeWidth: 20 });
    const inside = buildRoundedRectStrokePath({ ...base, strokeAlign: "inside", strokeWidth: 20 });
    const outside = buildRoundedRectStrokePath({ ...base, strokeAlign: "outside", strokeWidth: 20 });

    assert.equal(center, fill);
    assert.ok(inside.endsWith(" Z"));
    assert.ok(outside.endsWith(" Z"));
    assert.ok(inside.startsWith("M 80 10"));
    assert.ok(outside.startsWith("M 80 -10"));
    assert.notEqual(inside, fill);
    assert.notEqual(outside, fill);
  });

  it("supports independent corner radii", () => {
    const d = buildRoundedRectPath({
      width: 120,
      height: 80,
      radius: { topLeft: 24, topRight: 8, bottomRight: 16, bottomLeft: 0 },
      smoothing: 0,
    });
    assert.ok(d.startsWith("M 24 0"));
    assert.ok(d.includes("H 112"));
    assert.ok(d.includes("V 64"));
    assert.ok(d.includes("H 0"));
  });

  it("clamps radii so adjacent corners never overlap", () => {
    const clamped = clampRoundedRectRadii(
      normalizeRoundedRectRadii({ topLeft: 80, topRight: 80, bottomRight: 80, bottomLeft: 80 }),
      100,
      40,
    );
    assert.ok(clamped.topLeft + clamped.topRight <= 100 + 1e-6);
    assert.ok(clamped.topLeft + clamped.bottomLeft <= 40 + 1e-6);
  });

  it("insets inside stroke geometry by half stroke width", () => {
    const { fillPath, strokePath } = buildRoundedRectFillAndStrokePaths({
      width: 100,
      height: 60,
      radius: 20,
      smoothing: 0,
      strokeAlign: "inside",
      strokeWidth: 10,
    });
    assert.notEqual(fillPath, strokePath);
    const inset = offsetRoundedRectPath(100, 60, 20, -5, 0);
    assert.equal(strokePath, inset);
    assert.ok(strokePath.startsWith("M 20 5"));
  });

  it("outsets outside stroke geometry by half stroke width", () => {
    const strokePath = buildRoundedRectStrokePath({
      width: 100,
      height: 60,
      radius: 20,
      smoothing: 0,
      strokeAlign: "outside",
      strokeWidth: 10,
    });
    const outset = offsetRoundedRectPath(100, 60, 20, 5, 0);
    assert.equal(strokePath, outset);
    assert.ok(strokePath.startsWith("M 20 -5"));
  });

  it("uses original geometry for center stroke", () => {
    const fillPath = buildRoundedRectPath({ width: 100, height: 60, radius: 20, smoothing: 0.6 });
    const strokePath = buildRoundedRectStrokePath({
      width: 100,
      height: 60,
      radius: 20,
      smoothing: 0.6,
      strokeAlign: "center",
      strokeWidth: 8,
    });
    assert.equal(strokePath, fillPath);
  });
});

describe("roundedRectPath visual fixture", () => {
  it("includes standard, smoothed, stroke-aligned, and mixed-radius samples", () => {
    const svg = buildRoundedRectVisualFixtureSvg();
    assert.ok(svg.includes("Standard SVG rx/ry"));
    assert.ok(svg.includes("Figma-like smoothed"));
    assert.ok(svg.includes("Center stroke"));
    assert.ok(svg.includes("Inside stroke"));
    assert.ok(svg.includes("Outside stroke"));
    assert.ok(svg.includes("Mixed corner radii"));
    assert.ok(svg.includes('fill="#e53935"'));
    assert.ok(svg.includes('fill="#9e9e9e"'));
    assert.ok(svg.includes('stroke="#ffffff"'));
    assert.ok(svg.includes("Large radius"));
    assert.ok(svg.includes("Regression: gray fill + white 20px center stroke, r=80"));
    assert.ok(svg.includes('fill="#9e9e9e"'));
    assert.ok(svg.includes('fill-rule="evenodd"'));
    assert.ok(svg.includes('stroke="red"'));
    assert.ok(svg.includes("Path debug"));
  });

  it("exports comparison debug SVG for smoothing 0 vs 0.6", () => {
    const svg = buildRoundedRectComparisonDebugSvg({ width: 140, height: 100, radius: 24 });
    assert.ok(svg.includes("smoothing=0"));
    assert.ok(svg.includes("smoothing=0.6"));
    assert.ok(svg.includes('stroke="red"'));
  });
});
