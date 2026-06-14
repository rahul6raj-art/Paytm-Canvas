import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampInspectorScrubValue,
  valueFromScrubDrag,
} from "@/lib/useInspectorValueScrub";

describe("useInspectorValueScrub", () => {
  it("valueFromScrubDrag changes by one unit per pixel", () => {
    assert.equal(valueFromScrubDrag(10, 100, 105, {}), 15);
    assert.equal(valueFromScrubDrag(90, 200, 195, {}), 85);
  });

  it("valueFromScrubDrag respects min, max, and shift multiplier", () => {
    assert.equal(valueFromScrubDrag(98, 0, 5, { min: 0, max: 100 }), 100);
    assert.equal(valueFromScrubDrag(0, 0, 3, { shift: true }), 30);
  });

  it("clampInspectorScrubValue rounds decimals", () => {
    assert.equal(clampInspectorScrubValue(1.236, 0, 2, 2), 1.24);
  });
});
