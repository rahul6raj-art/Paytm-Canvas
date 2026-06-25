import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isZeroAreaShapeNode } from "../shapes/shapeDraft";

describe("isZeroAreaShapeNode", () => {
  it("detects 0×0 rectangles", () => {
    assert.equal(
      isZeroAreaShapeNode({ type: "rectangle", width: 0, height: 0 }),
      true,
    );
    assert.equal(
      isZeroAreaShapeNode({ type: "rectangle", width: 10, height: 0 }),
      false,
    );
  });

  it("detects zero-length lines", () => {
    assert.equal(
      isZeroAreaShapeNode({
        type: "line",
        width: 0,
        height: 0,
        lineX1: 0,
        lineY1: 0,
        lineX2: 0,
        lineY2: 0,
      }),
      true,
    );
  });
});
