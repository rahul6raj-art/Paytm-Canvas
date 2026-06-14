import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampStrokeWidth,
  DEFAULT_PENCIL_STROKE_WIDTH,
  isFreehandPathNode,
  nodeSupportsStrokeWidth,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
} from "../strokeAdjust";

describe("clampStrokeWidth", () => {
  it("clamps to min and max", () => {
    assert.equal(clampStrokeWidth(-5), STROKE_WIDTH_MIN);
    assert.equal(clampStrokeWidth(999), STROKE_WIDTH_MAX);
    assert.equal(clampStrokeWidth(4), 4);
  });

  it("falls back for non-finite values", () => {
    assert.equal(clampStrokeWidth(Number.NaN), DEFAULT_PENCIL_STROKE_WIDTH);
  });
});

describe("nodeSupportsStrokeWidth", () => {
  it("includes open paths and vector shapes", () => {
    assert.equal(nodeSupportsStrokeWidth({ type: "path", isBooleanGroup: false }), true);
    assert.equal(nodeSupportsStrokeWidth({ type: "rectangle", isBooleanGroup: false }), true);
    assert.equal(nodeSupportsStrokeWidth({ type: "text", isBooleanGroup: false }), false);
    assert.equal(nodeSupportsStrokeWidth(null), false);
  });
});

describe("isFreehandPathNode", () => {
  it("detects pencil strokes only", () => {
    assert.equal(isFreehandPathNode({ type: "path", pathClosed: false }), true);
    assert.equal(isFreehandPathNode({ type: "path", pathClosed: true }), false);
    assert.equal(isFreehandPathNode({ type: "path", pathClosed: false, starPoints: 5 }), false);
    assert.equal(isFreehandPathNode({ type: "path", pathClosed: false, polygonSides: 6 }), false);
    assert.equal(isFreehandPathNode({ type: "rectangle" }), false);
  });
});
