import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeResizedBounds } from "@/lib/resize";

describe("resize rotated layer in node-local space", () => {
  it("resizes predictably when bounds and pointer share node-local space", () => {
    const start = { x: 0, y: 0, width: 200, height: 100 };
    const next = computeResizedBounds(
      "se",
      start,
      { x: 220, y: 110 },
      { shiftKey: false, altKey: false },
      "rectangle",
    );
    assert.equal(next.x, 0);
    assert.equal(next.y, 0);
    assert.equal(next.width, 220);
    assert.equal(next.height, 110);
  });
});
