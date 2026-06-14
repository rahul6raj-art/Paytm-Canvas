import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampNodeDimensions,
  clampResizePointerLocal,
  MAX_NODE_DIMENSION,
} from "@/lib/nodeGeometryClamp";

describe("nodeGeometryClamp", () => {
  it("clamps astronomical resize dimensions", () => {
    const { width, height } = clampNodeDimensions(7.389e38, 7.389e38, 219, 205);
    assert.ok(width <= MAX_NODE_DIMENSION * 50);
    assert.ok(height <= MAX_NODE_DIMENSION * 50);
  });

  it("clamps resize pointer to a sane neighborhood of start bounds", () => {
    const start = { x: 0, y: 0, width: 219, height: 205 };
    const p = clampResizePointerLocal({ x: 7.389e38, y: 7.389e38 }, start, true);
    assert.ok(p.x < 1e6);
    assert.ok(p.y < 1e6);
  });
});
