import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeResizedBounds } from "@/lib/resize";

describe("resize in parent-local space", () => {
  it("grows height when dragging the south handle down inside a frame", () => {
    const start = { x: 97, y: 331, width: 204, height: 8 };
    const next = computeResizedBounds(
      "s",
      start,
      { x: 200, y: 360 },
      { shiftKey: false, altKey: false },
      "rectangle",
    );
    assert.equal(next.y, start.y);
    assert.equal(next.width, start.width);
    assert.equal(next.height, 29);
  });

  it("shrinks width when dragging east handle only if pointer is left of the right edge", () => {
    const start = { x: 97, y: 331, width: 204, height: 8 };
    const next = computeResizedBounds(
      "e",
      start,
      { x: 301, y: 335 },
      { shiftKey: false, altKey: false },
      "rectangle",
    );
    assert.equal(next.width, 204);
  });
});
