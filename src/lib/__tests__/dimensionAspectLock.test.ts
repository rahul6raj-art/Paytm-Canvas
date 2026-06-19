import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyAspectLockedDimensions } from "@/lib/dimensionAspectLock";

describe("applyAspectLockedDimensions", () => {
  it("changes only width when unlocked", () => {
    const next = applyAspectLockedDimensions(
      { width: 100, height: 50 },
      "width",
      80,
      false,
    );
    assert.deepEqual(next, { width: 80, height: 50 });
  });

  it("scales height when width changes and locked", () => {
    const next = applyAspectLockedDimensions(
      { width: 100, height: 50 },
      "width",
      80,
      true,
    );
    assert.equal(next.width, 80);
    assert.equal(next.height, 40);
  });

  it("scales width when height changes and locked", () => {
    const next = applyAspectLockedDimensions(
      { width: 100, height: 50 },
      "height",
      25,
      true,
    );
    assert.equal(next.width, 50);
    assert.equal(next.height, 25);
  });
});
