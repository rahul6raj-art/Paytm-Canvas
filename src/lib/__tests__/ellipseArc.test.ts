import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  angularDeltaDeg,
  arcInnerRadiusRatioFromLocalPoint,
  arcInnerRadiusRatioFromPointer,
  arcInnerRadiusRatioFromRelativeDrag,
  bisectorRadialScaleAtRatioOne,
  clockwiseSweepBetween,
  effectiveEllipseArc,
  ellipseArcPathD,
  ellipseArcRatioDragBaseline,
  ellipseEndAngleUnwrapped,
  ellipseRatioHandleLocal,
  projectLocalOntoArcBisector,
  ellipseSweepHandleLocal,
  formatArcRatioPercent,
  formatArcSweepDegrees,
  formatArcSweepPercent,
  hasEllipseArcInnerHole,
  sweepDegToPercent,
  sweepPercentToDeg,
  isFullEllipseArc,
  startDegAndSweepFromStartHandleDrag,
  sweepDegFromEndHandleDrag,
  sweepDegFromPointer,
  unwrapAngleNear,
} from "@/lib/shapes/ellipseArc";

describe("ellipseArc", () => {
  it("defaults to full circle", () => {
    const arc = effectiveEllipseArc({});
    assert.equal(arc.sweepDeg, 360);
    assert.equal(arc.innerRadiusRatio, 0);
    assert.ok(isFullEllipseArc(arc.sweepDeg));
    assert.ok(!hasEllipseArcInnerHole(arc.innerRadiusRatio));
  });

  it("sweep handle sits at start + sweep on perimeter", () => {
    const p = ellipseSweepHandleLocal(100, 100, 0, 90);
    assert.ok(Math.abs(p.x - 50) < 0.01);
    assert.ok(Math.abs(p.y - 100) < 0.01);
  });

  it("ratio handle follows inner radius on arc bisector", () => {
    const p = ellipseRatioHandleLocal(100, 100, 0, 180, 0.5);
    assert.ok(Math.abs(p.x - 50) < 0.01);
    assert.ok(Math.abs(p.y - 75) < 0.01);
  });

  it("partial arc path closes through center", () => {
    const d = ellipseArcPathD(100, 100, 0, 90);
    assert.match(d, /^M 50(\.0+)? 50/);
    assert.match(d, / Z$/);
  });

  it("donut path uses evenodd-friendly twin subpaths", () => {
    const d = ellipseArcPathD(100, 100, 0, 360, 0.5);
    assert.equal((d.match(/ M /g) ?? []).length, 1);
    assert.ok(d.includes(" Z"));
  });

  it("ring sector path connects outer and inner arcs", () => {
    const d = ellipseArcPathD(100, 100, 0, 90, 0.4);
    assert.ok(!/^M 50/.test(d));
    assert.match(d, / L /);
    assert.match(d, / Z$/);
  });

  it("arcInnerRadiusRatioFromLocalPoint scales by radial distance", () => {
    const ratio = arcInnerRadiusRatioFromLocalPoint(100, 100, 75, 50, 0);
    assert.ok(Math.abs(ratio - 0.5) < 0.05);
  });

  it("pointer ratio uses distance at pointer angle (bottom increases on circle)", () => {
    const ratio = arcInnerRadiusRatioFromPointer(100, 100, 50, 75);
    assert.ok(Math.abs(ratio - 0.5) < 0.05);
    const lower = arcInnerRadiusRatioFromPointer(100, 100, 50, 60);
    const bottom = arcInnerRadiusRatioFromPointer(100, 100, 50, 95);
    assert.ok(bottom > lower);
  });

  it("relative ratio drag follows bisector radial delta", () => {
    const ratio = arcInnerRadiusRatioFromRelativeDrag(100, 100, 90, 0.2, 50, 70, 50, 90);
    assert.ok(ratio > 0.2);
  });

  it("bisector ratio drag ignores perpendicular pointer motion", () => {
    const ratio = arcInnerRadiusRatioFromRelativeDrag(100, 100, 0, 0.3, 40, 50, 40, 90);
    assert.ok(Math.abs(ratio - 0.3) < 0.01);
  });

  it("dragging outward along bisector increases ratio", () => {
    const moved = arcInnerRadiusRatioFromRelativeDrag(100, 100, 90, 0, 50, 60, 50, 95);
    assert.ok(moved > 0);
  });

  it("bisector ratio drag decreases when moving toward center", () => {
    const decreased = arcInnerRadiusRatioFromRelativeDrag(100, 100, 90, 0.5, 50, 75, 50, 55);
    assert.ok(decreased < 0.5);
    assert.ok(decreased > 0);
  });

  it("ratio at handle matches stored ratio on ellipse at 45° bisector", () => {
    const ratio = 0.5;
    const mid = 45;
    const handle = ellipseRatioHandleLocal(200, 100, 0, 90, ratio);
    const sample = arcInnerRadiusRatioFromLocalPoint(200, 100, handle.x, handle.y, mid);
    assert.ok(Math.abs(sample - ratio) < 0.02);
  });

  it("inward and outward bisector drag on circle", () => {
    const out = arcInnerRadiusRatioFromRelativeDrag(100, 100, 90, 0.3, 50, 65, 50, 90);
    const inn = arcInnerRadiusRatioFromRelativeDrag(100, 100, 90, 0.3, 50, 65, 50, 55);
    assert.ok(out > 0.3);
    assert.ok(inn < 0.3);
  });

  it("inward bisector drag on wide ellipse decreases ratio", () => {
    const mid = 45;
    const ratio = 0.5;
    const handle = ellipseRatioHandleLocal(200, 100, 0, 90, ratio);
    const cx = 100;
    const cy = 50;
    const towardCenter = {
      x: cx + (handle.x - cx) * 0.4,
      y: cy + (handle.y - cy) * 0.4,
    };
    const decreased = arcInnerRadiusRatioFromRelativeDrag(
      200,
      100,
      mid,
      ratio,
      handle.x,
      handle.y,
      towardCenter.x,
      towardCenter.y,
    );
    assert.ok(decreased < ratio);
    assert.ok(decreased >= 0);
  });

  it("ratio drag baseline matches visible handle", () => {
    const baseline = ellipseArcRatioDragBaseline(100, 100, 0, 360, 0.317);
    const sample = arcInnerRadiusRatioFromLocalPoint(
      100,
      100,
      baseline.grabLocal.x,
      baseline.grabLocal.y,
      baseline.ratioAngleDeg,
    );
    assert.ok(Math.abs(sample - baseline.grabRatio) < 0.01);
    assert.ok(Math.abs(baseline.grabRatio - 0.317) < 0.02);
  });

  it("absolute bisector ratio increases and decreases from handle", () => {
    const mid = 90;
    const ratio = 0.4;
    const handle = ellipseRatioHandleLocal(100, 100, 0, 180, ratio);
    const towardCenter = arcInnerRadiusRatioFromLocalPoint(
      100,
      100,
      handle.x,
      handle.y - 15,
      mid,
    );
    const awayFromCenter = arcInnerRadiusRatioFromLocalPoint(
      100,
      100,
      handle.x,
      handle.y + 10,
      mid,
    );
    assert.ok(awayFromCenter > ratio);
    assert.ok(towardCenter < ratio);
    assert.ok(towardCenter >= 0);
  });

  it("project onto bisector enables smooth relative drag", () => {
    const mid = 90;
    const handle = ellipseRatioHandleLocal(100, 100, 0, 180, 0.5);
    const projected = projectLocalOntoArcBisector(100, 100, handle.x + 8, handle.y, mid);
    const ratio = arcInnerRadiusRatioFromRelativeDrag(
      100,
      100,
      mid,
      0.5,
      handle.x,
      handle.y,
      projected.x,
      projected.y,
    );
    assert.ok(Math.abs(ratio - 0.5) < 0.02);
  });

  it("inward drag from soften-zero handle position decreases toward 0", () => {
    const mid = 180;
    const handle = ellipseRatioHandleLocal(100, 100, 0, 360, 0);
    const decreased = arcInnerRadiusRatioFromRelativeDrag(
      100,
      100,
      mid,
      0.06,
      handle.x,
      handle.y,
      50,
      50,
    );
    assert.ok(decreased < 0.06);
  });

  it("formatArcRatioPercent shows one decimal", () => {
    assert.equal(formatArcRatioPercent(0.277), "27.7%");
  });

  it("sweepDegFromPointer measures clockwise sweep from start", () => {
    const sweep = sweepDegFromPointer(0, 50, 50, 50, 100);
    assert.ok(Math.abs(sweep - 90) < 1);
  });

  it("unwrapAngleNear keeps continuity across 0°", () => {
    assert.equal(unwrapAngleNear(10, 350), 370);
    assert.equal(unwrapAngleNear(340, 350), 340);
  });

  it("clockwiseSweepBetween always returns positive sweep", () => {
    assert.equal(clockwiseSweepBetween(350, 10), 20);
    assert.equal(clockwiseSweepBetween(0, 90), 90);
  });

  it("end handle drag extends sweep clockwise past 180° without flipping", () => {
    const sweep = sweepDegFromEndHandleDrag(0, 350, 10);
    assert.equal(sweep, 360);
  });

  it("end handle drag shrinks sweep counter-clockwise", () => {
    const sweep = sweepDegFromEndHandleDrag(0, 350, 340);
    assert.equal(sweep, 340);
  });

  it("breaking a full circle uses clockwise sweep from start", () => {
    const endU = ellipseEndAngleUnwrapped(0, 360, 0);
    const sweep = sweepDegFromEndHandleDrag(0, endU, 90, { fromFullCircle: true });
    assert.ok(Math.abs(sweep - 90) < 0.01);
  });

  it("breaking a full circle counter-clockwise keeps large sweep", () => {
    const endU = ellipseEndAngleUnwrapped(0, 360, 0);
    const sweep = sweepDegFromEndHandleDrag(0, endU, 350, { fromFullCircle: true });
    assert.ok(Math.abs(sweep - 350) < 0.01);
  });

  it("start handle drag moves start and preserves fixed end", () => {
    const endU = ellipseEndAngleUnwrapped(0, 90, 90);
    const next = startDegAndSweepFromStartHandleDrag(endU, 45);
    assert.equal(next.startDeg, 45);
    assert.equal(next.sweepDeg, 45);
  });

  it("full circle end is unwrapped one revolution ahead of start", () => {
    const endU = ellipseEndAngleUnwrapped(0, 360, 0);
    assert.equal(endU, 360);
  });

  it("formatArcSweepDegrees", () => {
    assert.equal(formatArcSweepDegrees(90.4), "90°");
    assert.equal(formatArcSweepDegrees(360), "360°");
  });

  it("sweep percent round-trip for panel", () => {
    assert.ok(Math.abs(sweepDegToPercent(360) - 100) < 0.01);
    assert.ok(Math.abs(sweepDegToPercent(300.456) - 83.46) < 0.1);
    assert.ok(Math.abs(sweepPercentToDeg(83.46) - 300.456) < 0.2);
    assert.equal(formatArcSweepPercent(300.456), "83.46%");
  });

  it("angularDeltaDeg uses shortest path across 0°", () => {
    assert.ok(Math.abs(angularDeltaDeg(350, 10) - 20) < 0.01);
    assert.ok(Math.abs(angularDeltaDeg(10, 350) + 20) < 0.01);
  });

  it("partial arc path uses line segments (no large-arc flip)", () => {
    const d = ellipseArcPathD(100, 100, 0, 200);
    assert.ok(!d.includes(" 0 1 "));
    assert.match(d, / L /);
  });
});
