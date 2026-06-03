import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  arrowEndpointStylePatch,
  arrowHeadSizeForNode,
  arrowHeadToStrokeEndpoint,
  getArrowAngle,
  getArrowHeadPolygon,
  getArrowLength,
  resolveArrowEndKind,
  strokeEndpointToArrowHead,
} from "@/lib/shapes/arrowGeometry";

describe("arrowGeometry", () => {
  it("maps arrowhead kinds to stroke endpoints", () => {
    assert.equal(arrowHeadToStrokeEndpoint("triangle"), "triangle-arrow");
    assert.equal(strokeEndpointToArrowHead("circle-arrow"), "circle");
  });

  it("arrowEndpointStylePatch syncs start/end fields", () => {
    const patch = arrowEndpointStylePatch({ startArrow: "none", endArrow: "triangle" });
    assert.equal(patch.startArrow, "none");
    assert.equal(patch.endArrow, "triangle");
    assert.equal(patch.strokeEndPoint, "triangle-arrow");
  });

  it("computes angle and length", () => {
    const ep = { x1: 0, y1: 0, x2: 100, y2: 0 };
    assert.ok(Math.abs(getArrowAngle(ep)) < 1e-6);
    assert.equal(getArrowLength(ep), 100);
  });

  it("default arrow end is triangle for arrow nodes", () => {
    assert.equal(resolveArrowEndKind({ type: "arrow" }), "triangle");
  });

  it("arrowHeadSize defaults from stroke width", () => {
    assert.equal(arrowHeadSizeForNode({ strokeWidth: 4 }), Math.max(10, 12));
    assert.equal(arrowHeadSizeForNode({ strokeWidth: 4, arrowHeadSize: 20 }), 20);
  });

  it("triangle head polygon has three points", () => {
    const poly = getArrowHeadPolygon({ x: 100, y: 50 }, 0, "triangle", 12);
    assert.equal(poly.length, 3);
  });
});
