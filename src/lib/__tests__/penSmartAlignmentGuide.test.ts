import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PEN_SMART_GUIDE_TOLERANCE_PX,
  penSmartGuideToleranceWorld,
  resolvePenSmartAlignmentGuide,
} from "@/lib/penTool/penSmartAlignmentGuide";
import { resolvePenShiftConstraintGuide } from "@/lib/penTool/shiftConstraintGuide";

describe("pen smart alignment guide", () => {
  const anchors = [
    { x: 0, y: 0 },
    { x: 100, y: 40 },
    { x: 200, y: 40 },
  ];

  it("shows horizontal guide when pointer y aligns with an existing anchor", () => {
    const guide = resolvePenSmartAlignmentGuide({
      anchors,
      previewPoint: { x: 250, y: 41 },
      zoom: 1,
      toleranceScreenPx: 5,
    });
    assert.equal(guide?.axis, "h");
    assert.deepEqual(guide?.from, { x: 100, y: 40 });
    assert.deepEqual(guide?.to, { x: 250, y: 40 });
  });

  it("shows vertical guide when pointer x aligns with an existing anchor", () => {
    const guide = resolvePenSmartAlignmentGuide({
      anchors,
      previewPoint: { x: 101, y: 120 },
      zoom: 1,
      toleranceScreenPx: 5,
    });
    assert.equal(guide?.axis, "v");
    assert.deepEqual(guide?.from, { x: 100, y: 40 });
    assert.deepEqual(guide?.to, { x: 100, y: 120 });
  });

  it("does not show guide outside tolerance", () => {
    const guide = resolvePenSmartAlignmentGuide({
      anchors,
      previewPoint: { x: 250, y: 50 },
      zoom: 1,
      toleranceScreenPx: 5,
    });
    assert.equal(guide, null);
  });

  it("uses zoom-aware tolerance in world units", () => {
    assert.equal(penSmartGuideToleranceWorld(2), PEN_SMART_GUIDE_TOLERANCE_PX / 2);
    assert.equal(penSmartGuideToleranceWorld(0.5), PEN_SMART_GUIDE_TOLERANCE_PX / 0.5);

    const alignedAtZoom2 = resolvePenSmartAlignmentGuide({
      anchors,
      previewPoint: { x: 250, y: 42.4 },
      zoom: 2,
      toleranceScreenPx: 5,
    });
    const misalignedAtZoom2 = resolvePenSmartAlignmentGuide({
      anchors,
      previewPoint: { x: 250, y: 42.6 },
      zoom: 2,
      toleranceScreenPx: 5,
    });
    assert.ok(alignedAtZoom2);
    assert.equal(misalignedAtZoom2, null);
  });

  it("keeps shift constraint guide separate from smart alignment guide", () => {
    const previewPoint = { x: 250, y: 40 };
    const smart = resolvePenSmartAlignmentGuide({
      anchors,
      previewPoint,
      zoom: 1,
    });
    const shift = resolvePenShiftConstraintGuide({
      previousAnchor: anchors[anchors.length - 1]!,
      rawPointer: { x: 250, y: 40 },
      snappedPointer: { x: 240, y: 40 },
      shiftKey: true,
    });
    assert.equal(smart?.axis, "h");
    assert.equal(shift?.axis, "h");
    assert.deepEqual(smart?.from, { x: 100, y: 40 });
    assert.deepEqual(shift?.from, { x: 200, y: 40 });
    assert.notDeepEqual(smart?.from, shift?.from);
  });

  it("guide endpoint follows preview point", () => {
    const previewPoint = { x: 280, y: 39.5 };
    const guide = resolvePenSmartAlignmentGuide({
      anchors,
      previewPoint,
      zoom: 1,
    });
    assert.deepEqual(guide?.to, { x: previewPoint.x, y: 40 });
  });

  it("ignores the latest anchor when searching for alignment matches", () => {
    const guide = resolvePenSmartAlignmentGuide({
      anchors: [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
      ],
      previewPoint: { x: 200, y: 50.2 },
      zoom: 1,
    });
    assert.equal(guide, null);
  });

  it("picks the closest matching guide when multiple anchors align", () => {
    const stacked = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 102 },
    ];
    const guide = resolvePenSmartAlignmentGuide({
      anchors: stacked,
      previewPoint: { x: 260, y: 100.5 },
      zoom: 1,
    });
    assert.deepEqual(guide?.from, { x: 100, y: 100 });
    assert.equal(guide?.axis, "h");
  });
});
