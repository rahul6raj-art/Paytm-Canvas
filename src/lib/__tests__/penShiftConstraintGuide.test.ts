import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolvePenSegmentPreviewTarget } from "@/lib/penTool/penInteraction";
import { resolvePenHoverPreview } from "@/lib/penTool/placement";
import {
  classifyPenShiftSnapAxis,
  resolvePenShiftConstraintGuide,
  resolvePenShiftSnappedPointer,
  shouldShowPenShiftConstraintGuide,
} from "@/lib/penTool/shiftConstraintGuide";

describe("pen shift constraint guide", () => {
  const previousAnchor = { x: 0, y: 0 };

  it("guide appears when Shift is pressed", () => {
    const rawPointer = { x: 12, y: 11 };
    const snappedPointer = resolvePenShiftSnappedPointer(rawPointer, previousAnchor, true);
    assert.equal(
      shouldShowPenShiftConstraintGuide({
        previousAnchor,
        rawPointer,
        snappedPointer,
        shiftKey: true,
      }),
      true,
    );
    assert.ok(resolvePenShiftConstraintGuide({
      previousAnchor,
      rawPointer,
      snappedPointer,
      shiftKey: true,
    }));
  });

  it("guide disappears when Shift is released", () => {
    const rawPointer = { x: 12, y: 11 };
    const snappedPointer = resolvePenShiftSnappedPointer(rawPointer, previousAnchor, false);
    assert.equal(
      shouldShowPenShiftConstraintGuide({
        previousAnchor,
        rawPointer,
        snappedPointer,
        shiftKey: false,
      }),
      false,
    );
    assert.equal(
      resolvePenShiftConstraintGuide({
        previousAnchor,
        rawPointer,
        snappedPointer,
        shiftKey: false,
      }),
      null,
    );
  });

  it("guide endpoint matches snapped preview point", () => {
    const rawPointer = { x: 40, y: 10 };
    const snappedPointer = resolvePenShiftSnappedPointer(rawPointer, previousAnchor, true)!;
    const guide = resolvePenShiftConstraintGuide({
      previousAnchor,
      rawPointer,
      snappedPointer,
      shiftKey: true,
    });
    assert.deepEqual(guide?.to, snappedPointer);
    assert.deepEqual(guide?.from, previousAnchor);
    assert.deepEqual(
      snappedPointer,
      resolvePenHoverPreview(rawPointer, previousAnchor, true),
    );
    assert.deepEqual(
      resolvePenSegmentPreviewTarget(snappedPointer, null, previousAnchor),
      snappedPointer,
    );
  });

  it("guide updates during pointer movement", () => {
    const firstRaw = { x: 20, y: 5 };
    const secondRaw = { x: 5, y: 30 };
    const firstSnapped = resolvePenShiftSnappedPointer(firstRaw, previousAnchor, true)!;
    const secondSnapped = resolvePenShiftSnappedPointer(secondRaw, previousAnchor, true)!;
    const firstGuide = resolvePenShiftConstraintGuide({
      previousAnchor,
      rawPointer: firstRaw,
      snappedPointer: firstSnapped,
      shiftKey: true,
    });
    const secondGuide = resolvePenShiftConstraintGuide({
      previousAnchor,
      rawPointer: secondRaw,
      snappedPointer: secondSnapped,
      shiftKey: true,
    });
    assert.notDeepEqual(firstGuide?.to, secondGuide?.to);
    assert.equal(firstGuide?.axis, "h");
    assert.equal(secondGuide?.axis, "v");
  });

  it("classifies horizontal, vertical, and diagonal snap axes", () => {
    assert.equal(classifyPenShiftSnapAxis({ x: 0, y: 0 }, { x: 40, y: 0 }), "h");
    assert.equal(classifyPenShiftSnapAxis({ x: 0, y: 0 }, { x: 0, y: 40 }), "v");
    assert.equal(classifyPenShiftSnapAxis({ x: 0, y: 0 }, { x: 30, y: 30 }), "d");
  });

  it("does not show guide without a previous anchor", () => {
    const rawPointer = { x: 10, y: 10 };
    assert.equal(
      resolvePenShiftConstraintGuide({
        previousAnchor: null,
        rawPointer,
        snappedPointer: rawPointer,
        shiftKey: true,
      }),
      null,
    );
  });
});
