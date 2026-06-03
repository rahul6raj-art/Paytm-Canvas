import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cornerRadiusMetricAtPoint,
  radiusFromRelativeCornerDrag,
} from "@/lib/shapes/shapeToPath";
import { arcInnerRadiusRatioFromRelativeDrag } from "@/lib/shapes/ellipseArc";

describe("cornerRadiusDrag", () => {
  it("top-left metric uses min of x and y from corner", () => {
    assert.equal(cornerRadiusMetricAtPoint(0, 30, 10, 100, 100), 10);
    assert.equal(cornerRadiusMetricAtPoint(0, 10, 30, 100, 100), 10);
  });

  it("relative drag preserves grab radius when pointer has not moved", () => {
    const r = radiusFromRelativeCornerDrag(0, 20, 20, 5, 20, 5, 100, 100, 50);
    assert.equal(r, 20);
  });

  it("relative drag increases radius when moving along bisector", () => {
    const r = radiusFromRelativeCornerDrag(0, 10, 15, 10, 25, 20, 100, 100, 50);
    assert.equal(r, 20);
  });
});

describe("ellipse arc ratio drag", () => {
  it("relative ratio drag is continuous at grab point", () => {
    const r = arcInnerRadiusRatioFromRelativeDrag(100, 100, 90, 0.2, 50, 70, 50, 70);
    assert.ok(Math.abs(r - 0.2) < 0.01);
  });
});
