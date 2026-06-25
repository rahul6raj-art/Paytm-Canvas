import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  openPathStrokeViewport,
  resolveStrokeEndPoint,
  resolveStrokeStartPoint,
  strokeEndpointDecorationActive,
  strokeEndpointViewportPad,
} from "@/lib/strokeEndpoints";

describe("strokeEndpoints", () => {
  it("resolves undefined start/end as none", () => {
    assert.equal(resolveStrokeStartPoint({}), "none");
    assert.equal(resolveStrokeEndPoint({}), "none");
    assert.equal(resolveStrokeEndPoint({ arrowHead: true }), "triangle-arrow");
  });

  it("detects endpoint decoration", () => {
    assert.equal(strokeEndpointDecorationActive("none", "none"), false);
    assert.equal(strokeEndpointDecorationActive("round", "none"), true);
    assert.equal(strokeEndpointDecorationActive("none", "triangle-arrow"), true);
  });

  it("uses smaller viewport pad for round caps than arrowheads", () => {
    const capPad = strokeEndpointViewportPad(2, "round", "none");
    const arrowPad = strokeEndpointViewportPad(2, "none", "triangle-arrow");
    assert.ok(arrowPad > capPad);
  });

  it("expands render viewport for zero-height paths without changing layer size", () => {
    const vp = openPathStrokeViewport(18, 0, 2, "round", "none");
    assert.ok(vp.svgHeight > 0);
    assert.ok(vp.offsetTop < 0);
    assert.equal(vp.svgWidth, 18 + Math.abs(vp.offsetLeft) * 2);
  });

  it("keeps compact viewport for undecorated paths with normal bounds", () => {
    const vp = openPathStrokeViewport(80, 40, 2, "none", "none");
    assert.equal(vp.offsetLeft, 0);
    assert.equal(vp.offsetTop, 0);
    assert.equal(vp.svgWidth, 80);
    assert.equal(vp.svgHeight, 40);
  });
});
