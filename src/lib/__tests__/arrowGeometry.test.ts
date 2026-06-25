import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  arrowChevronMarkerPathD,
  arrowEndpointStylePatch,
  arrowHeadSizeForNode,
  arrowHeadToStrokeEndpoint,
  getArrowAngle,
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

  it("default arrow end is line for arrow nodes", () => {
    assert.equal(resolveArrowEndKind({ type: "arrow" }), "line");
  });

  it("arrowHeadSize defaults from stroke width", () => {
    assert.equal(arrowHeadSizeForNode({ strokeWidth: 4 }), Math.max(10, 12));
    assert.equal(arrowHeadSizeForNode({ strokeWidth: 4, arrowHeadSize: 20 }), 20);
  });

  it("chevron marker tip aligns with ref point", () => {
    const chevron = arrowChevronMarkerPathD(18);
    assert.equal(chevron.refX, 18);
    assert.equal(chevron.refY, chevron.markerHeight / 2);
    assert.match(chevron.pathD, new RegExp(` L ${chevron.refX} ${chevron.refY} `));
  });
});
