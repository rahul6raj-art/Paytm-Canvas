import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeFillDividerDragPatch } from "@/lib/autoLayout/fillDividerDrag";

describe("fillDividerDrag", () => {
  it("redistributes grow weights when both children fill", () => {
    const patch = computeFillDividerDragPatch(20, "horizontal", {
      startLeftMain: 80,
      startRightMain: 80,
      startLeftGrow: 1,
      startRightGrow: 1,
      leftMainSizing: "fill",
      rightMainSizing: "fill",
    });
    assert.ok(patch.leftGrow! > 1);
    assert.ok(patch.rightGrow! < 1);
    assert.equal(Math.round((patch.leftGrow! + patch.rightGrow!) * 10) / 10, 2);
  });

  it("resizes fixed child when paired with fill", () => {
    const patch = computeFillDividerDragPatch(-10, "horizontal", {
      startLeftMain: 60,
      startRightMain: 100,
      startLeftGrow: 1,
      startRightGrow: 1,
      leftMainSizing: "fixed",
      rightMainSizing: "fill",
    });
    assert.equal(patch.leftWidth, 50);
    assert.equal(patch.leftGrow, undefined);
  });

  it("resizes right fixed child when left fills", () => {
    const patch = computeFillDividerDragPatch(15, "vertical", {
      startLeftMain: 40,
      startRightMain: 60,
      startLeftGrow: 2,
      startRightGrow: 1,
      leftMainSizing: "fill",
      rightMainSizing: "fixed",
    });
    assert.equal(patch.rightHeight, 45);
  });
});
