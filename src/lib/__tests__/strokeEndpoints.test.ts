import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveStrokeEndPoint,
  strokeEndpointUsesMarker,
  unifiedLineCap,
} from "../strokeEndpoints";

describe("strokeEndpoints", () => {
  it("maps legacy arrowHead to triangle endpoint", () => {
    assert.equal(resolveStrokeEndPoint({ arrowHead: true }), "triangle-arrow");
  });

  it("detects arrow markers", () => {
    assert.equal(strokeEndpointUsesMarker("triangle-arrow"), true);
    assert.equal(strokeEndpointUsesMarker("round"), false);
  });

  it("unifies matching caps", () => {
    assert.equal(unifiedLineCap("round", "round"), "round");
    assert.equal(unifiedLineCap("round", "none"), undefined);
  });
});
