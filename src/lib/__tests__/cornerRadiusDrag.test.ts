import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maxCornerRadiusForIndex, resolveCornerRadiusDragMax } from "@/lib/cornerRadius";
import {
  cornerRadiusDragDelta,
  cornerRadiusMetricAtPoint,
  radiusFromRelativeCornerDrag,
} from "@/lib/shapes/shapeToPath";
import { arcInnerRadiusRatioFromRelativeDrag } from "@/lib/shapes/ellipseArc";

describe("cornerRadiusDrag", () => {
  it("top-left metric uses min of x and y from corner", () => {
    assert.equal(cornerRadiusMetricAtPoint(0, 30, 10, 100, 100), 10);
    assert.equal(cornerRadiusMetricAtPoint(0, 10, 30, 100, 100), 10);
  });

  it("cardinal horizontal drag delta for top-left", () => {
    assert.equal(cornerRadiusDragDelta(0, 12, 12, 22, 12), 10);
  });

  it("cardinal vertical drag delta for top-left", () => {
    assert.equal(cornerRadiusDragDelta(0, 12, 12, 12, 22), 10);
  });

  it("relative drag preserves grab radius when pointer has not moved", () => {
    const r = radiusFromRelativeCornerDrag(0, 20, 20, 5, 20, 5, 100, 100, 50);
    assert.equal(r, 20);
  });

  it("relative drag increases on horizontal-only move (top-left)", () => {
    const r = radiusFromRelativeCornerDrag(0, 12, 12, 12, 25, 12, 100, 100, 50);
    assert.equal(r, 25);
  });

  it("relative drag increases when moving along bisector", () => {
    const r = radiusFromRelativeCornerDrag(0, 10, 15, 10, 25, 25, 100, 100, 50);
    assert.equal(r, 25);
  });

  it("relative drag clamps at max radius", () => {
    const r = radiusFromRelativeCornerDrag(0, 45, 45, 45, 90, 45, 100, 100, 50);
    assert.equal(r, 50);
  });

  it("relative drag stays at max on further inward drag", () => {
    const r = radiusFromRelativeCornerDrag(0, 50, 50, 50, 95, 50, 100, 100, 50);
    assert.equal(r, 50);
  });

  it("maxCornerRadiusForIndex respects opposite corners", () => {
    assert.equal(maxCornerRadiusForIndex(0, [10, 30, 0, 0], 100, 80), 70);
    assert.equal(maxCornerRadiusForIndex(3, [20, 0, 0, 10], 100, 80), 60);
  });

  it("resolveCornerRadiusDragMax uses linked half-size", () => {
    assert.equal(resolveCornerRadiusDragMax(0, [0, 0, 0, 0], true, 100, 60), 30);
  });
});

describe("ellipse arc ratio drag", () => {
  it("relative ratio drag is continuous at grab point", () => {
    const r = arcInnerRadiusRatioFromRelativeDrag(100, 100, 90, 0.2, 50, 70, 50, 70);
    assert.ok(Math.abs(r - 0.2) < 0.01);
  });
});
