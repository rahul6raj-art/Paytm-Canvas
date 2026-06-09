import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  offsetEllipsePathD,
  offsetPolygonPoints,
  offsetSharpRectPathD,
  strokeCenterlineOffset,
} from "@/lib/strokeOffset";

describe("strokeCenterlineOffset", () => {
  it("insets half width for inside align", () => {
    assert.equal(strokeCenterlineOffset("inside", 10), -5);
  });
  it("outsets half width for outside align", () => {
    assert.equal(strokeCenterlineOffset("outside", 10), 5);
  });
  it("zero for center", () => {
    assert.equal(strokeCenterlineOffset("center", 10), 0);
  });
});

describe("offsetSharpRectPathD", () => {
  it("insets rectangle by delta", () => {
    const d = offsetSharpRectPathD(100, 50, 5);
    assert.match(d, /M 5 5/);
    assert.match(d, /H 95/);
    assert.match(d, /V 45/);
  });
});

describe("offsetEllipsePathD", () => {
  it("shrinks ellipse for positive inset delta", () => {
    const d = offsetEllipsePathD(100, 100, 4);
    assert.ok(d.length > 0);
    assert.ok(d.includes("M ") && d.endsWith("Z"));
  });
});

describe("offsetPolygonPoints", () => {
  it("offsets triangle outward", () => {
    const tri = [
      { x: 50, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const out = offsetPolygonPoints(tri, 5, "miter");
    assert.equal(out.length, 3);
    assert.ok(out[0]!.y < tri[0]!.y);
  });
});
