import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePenCommitCornerPoint,
  resolvePenLivePreviewTarget,
  resolvePenPointCommit,
  resolvePenSegmentPreviewTarget,
} from "@/lib/penTool/penInteraction";
import {
  resolvePenClickAnchor,
  resolvePenDragPreview,
  resolvePenHoverPreview,
  placementDragDistance,
} from "@/lib/penTool/placement";
import {
  refreshPenHoverPreview,
  refreshPenPlacementDrag,
} from "@/lib/penTool/penShiftPreview";

describe("pen shift snap live updates", () => {
  const prev = { x: 0, y: 0 };
  const raw = { x: 12, y: 11 };

  it("press Shift after drawing starts snaps segment preview", () => {
    const free = resolvePenHoverPreview(raw, prev, false);
    const snapped = resolvePenHoverPreview(raw, prev, true);
    assert.notDeepEqual(free, snapped);
    const angle = (Math.atan2(snapped.y - prev.y, snapped.x - prev.x) * 180) / Math.PI;
    assert.ok(Math.abs(angle - 45) < 1e-6);
  });

  it("release Shift unsnaps segment preview", () => {
    const snapped = refreshPenHoverPreview(raw, prev, true);
    const restored = refreshPenHoverPreview(raw, prev, false);
    assert.deepEqual(restored, raw);
    assert.notDeepEqual(restored, snapped);
  });

  it("Shift-click corner commit matches segment preview", () => {
    const preview = resolvePenHoverPreview(raw, prev, true);
    const placement = {
      anchor: resolvePenClickAnchor(raw, prev, null, 2, true, 1).anchor,
      drag: raw,
    };
    const commit = resolvePenCommitCornerPoint(placement, prev, true, raw);
    assert.deepEqual(commit, preview);
  });

  it("Shift-drag handle snaps angle while preserving distance", () => {
    const anchor = { x: 50, y: 50 };
    const dragRaw = { x: 60, y: 62 };
    const snapped = resolvePenDragPreview(anchor, dragRaw, true);
    const rawDist = Math.hypot(dragRaw.x - anchor.x, dragRaw.y - anchor.y);
    const snapDist = Math.hypot(snapped.x - anchor.x, snapped.y - anchor.y);
    assert.ok(Math.abs(rawDist - snapDist) < 1e-6);
    const angle = (Math.atan2(snapped.y - anchor.y, snapped.x - anchor.x) * 180) / Math.PI;
    assert.ok(Math.abs(angle - 45) < 1e-6);
  });

  it("Shift state changes during handle drag update live without pointer move", () => {
    const anchor = { x: 0, y: 0 };
    const rawDrag = { x: 10, y: 9 };
    const free = refreshPenPlacementDrag(anchor, rawDrag, false);
    const snapped = refreshPenPlacementDrag(anchor, rawDrag, true);
    assert.deepEqual(free, rawDrag);
    assert.notDeepEqual(snapped, free);
    assert.deepEqual(
      refreshPenPlacementDrag(anchor, rawDrag, false),
      rawDrag,
    );
  });

  it("segment preview during click-drag uses segment snap from previous anchor", () => {
    const prev = { x: 0, y: 0 };
    const placement = {
      anchor: { x: 100, y: 0 },
      drag: { x: 130, y: 30 },
      rawDrag: { x: 12, y: 11 },
      shiftKey: true,
    };
    const target = resolvePenSegmentPreviewTarget(null, placement, prev);
    assert.deepEqual(target, resolvePenHoverPreview(placement.rawDrag!, prev, true));
    assert.notDeepEqual(target, { x: 100, y: 0 });
  });

  it("constraint guide endpoint matches segment preview target during placement", () => {
    const prev = { x: 0, y: 0 };
    const rawDrag = { x: 12, y: 11 };
    const placement = {
      anchor: { x: 100, y: 0 },
      drag: { x: 130, y: 30 },
      rawDrag,
      shiftKey: true,
    };
    const preview = resolvePenSegmentPreviewTarget(null, placement, prev);
    const snapped = resolvePenHoverPreview(rawDrag, prev, true);
    assert.deepEqual(preview, snapped);
  });

  it("Shift-click without drag commits corner even when handle snap is far from anchor", () => {
    const prev = { x: 0, y: 0 };
    const pressRaw = { x: 50, y: 10 };
    const anchor = resolvePenClickAnchor(pressRaw, prev, null, 2, true, 1).anchor;
    const placement = {
      anchor,
      drag: resolvePenDragPreview(anchor, pressRaw, true),
      rawDrag: pressRaw,
      pressRaw,
      shiftKey: true,
    };
    assert.ok(placementDragDistance(placement) < 1e-6);
    assert.equal(resolvePenPointCommit(placement, 5), "corner");
  });

  it("Shift-click-drag commits smooth from pointer movement", () => {
    const prev = { x: 0, y: 0 };
    const pressRaw = { x: 50, y: 10 };
    const rawDrag = { x: 70, y: 30 };
    const anchor = resolvePenClickAnchor(pressRaw, prev, null, 2, true, 1).anchor;
    const placement = {
      anchor,
      drag: resolvePenDragPreview(anchor, rawDrag, true),
      rawDrag,
      pressRaw,
      shiftKey: true,
    };
    assert.ok(placementDragDistance(placement) > 5);
    assert.equal(resolvePenPointCommit(placement, 5), "smooth");
  });

  it("Shift held on press shows straight segment hint target during placement", () => {
    const prev = { x: 0, y: 0 };
    const pressRaw = { x: 12, y: 11 };
    const placement = {
      anchor: resolvePenClickAnchor(pressRaw, prev, null, 2, true, 1).anchor,
      drag: pressRaw,
      rawDrag: pressRaw,
      pressRaw,
      shiftKey: true,
    };
    const target = resolvePenSegmentPreviewTarget(null, placement, prev);
    assert.deepEqual(target, resolvePenHoverPreview(pressRaw, prev, true));
  });
});
