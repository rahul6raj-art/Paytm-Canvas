import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { snapPointToAngle, snapVectorToAngle } from "@/lib/penTool/angleSnap";
import {
  penCloseHitRadiusWorld,
  penCurveDragThresholdWorld,
  penHitRadiusWorld,
  penPointerToWorld,
  penViewportToWorld,
} from "@/lib/penTool/coordinates";
import { effectiveHandleMirroring } from "@/lib/penTool/handleMirror";
import {
  hitTestAnchor,
  hitTestInHandle,
  hitTestOutHandle,
  hitTestPenPathAtZoom,
} from "@/lib/penTool/hitTest";
import { overlayPreviewSegmentD } from "@/lib/penTool/renderOverlay";
import {
  buildCornerPathPoint,
  buildSmoothPathPointFromDrag,
  previewSegmentBetween,
} from "@/lib/penTool/bezierGeometry";
import { buildPenPreviewPoints, penPreviewPathD, previewSegmentD } from "@/lib/penTool/bezier";
import { resolvePenDragPreview, resolvePenHoverPreview } from "@/lib/penTool/placement";
import {
  canClosePathAt,
  isCurveDrag,
  placementDragDistance,
  resolvePenClickAnchor,
  shouldShowCurvePlacement,
} from "@/lib/penTool/placement";
import { togglePathPointType } from "@/lib/penTool/vectorPoint";
import { mergePathPointHandles } from "@/lib/pathHandles";
import type { PathPoint } from "@/lib/pathGeometry";

describe("penTool coordinates", () => {
  it("converts viewport to world consistently with pan and zoom", () => {
    const pan = { x: 100, y: 50 };
    const zoom = 2;
    const world = penViewportToWorld(200, 150, pan, zoom);
    assert.equal(world.x, 50);
    assert.equal(world.y, 50);
  });

  it("round-trips client coordinates through a viewport rect", () => {
    const viewport = {
      left: 10,
      top: 20,
      width: 800,
      height: 600,
      right: 810,
      bottom: 620,
    } as DOMRect;
    const pan = { x: 0, y: 0 };
    const zoom = 1;
    const world = penPointerToWorld(110, 70, { getBoundingClientRect: () => viewport } as HTMLElement, {
      pan,
      zoom,
    });
    assert.equal(world.x, 100);
    assert.equal(world.y, 50);
  });

  it("scales hit and close radii with zoom", () => {
    assert.equal(penHitRadiusWorld(1), 16);
    assert.equal(penHitRadiusWorld(2), 8);
    assert.equal(penCloseHitRadiusWorld(1), 10);
    assert.equal(penCurveDragThresholdWorld(1), 5);
  });
});

describe("penTool angleSnap", () => {
  it("snaps to 45° increments from an anchor", () => {
    const snapped = snapPointToAngle({ x: 0, y: 0 }, { x: 10, y: 11 });
    const angle = (Math.atan2(snapped.y, snapped.x) * 180) / Math.PI;
    assert.ok(Math.abs(angle - 45) < 1e-6);
  });

  it("preview and committed hover use the same shift snap", () => {
    const raw = { x: 12, y: 11 };
    const prev = { x: 0, y: 0 };
    const preview = resolvePenHoverPreview(raw, prev, true);
    const { anchor } = resolvePenClickAnchor(raw, prev, { x: 100, y: 100 }, 2, true, 1);
    assert.equal(preview.x, anchor.x);
    assert.equal(preview.y, anchor.y);
  });

  it("click-drag handle direction uses anchor-relative shift snap", () => {
    const anchor = { x: 50, y: 50 };
    const rawDrag = { x: 60, y: 62 };
    const snapped = resolvePenDragPreview(anchor, rawDrag, true);
    const sessionDrag = resolvePenDragPreview(anchor, rawDrag, true);
    assert.equal(snapped.x, sessionDrag.x);
    assert.equal(snapped.y, sessionDrag.y);
  });
});

describe("penTool placement threshold", () => {
  it("treats tiny movement as corner click", () => {
    const placement = { anchor: { x: 0, y: 0 }, drag: { x: 3, y: 0 } };
    assert.equal(isCurveDrag(placementDragDistance(placement), 1), false);
    assert.equal(shouldShowCurvePlacement(placement, 1), false);
  });

  it("treats intentional drag as smooth point", () => {
    const placement = { anchor: { x: 0, y: 0 }, drag: { x: 8, y: 0 } };
    assert.equal(isCurveDrag(placementDragDistance(placement), 1), true);
    assert.equal(shouldShowCurvePlacement(placement, 1), true);
  });
});

describe("penTool close path", () => {
  it("detects close hit in screen-calibrated world radius once two segments exist", () => {
    assert.equal(canClosePathAt({ x: 5, y: 0 }, { x: 0, y: 0 }, 2, 1), false);
    assert.equal(canClosePathAt({ x: 5, y: 0 }, { x: 0, y: 0 }, 3, 1), true);
    assert.equal(canClosePathAt({ x: 20, y: 0 }, { x: 0, y: 0 }, 3, 1), false);
  });

  it("prioritizes close over shift snap", () => {
    const { closePath } = resolvePenClickAnchor(
      { x: 2, y: 1 },
      { x: 50, y: 0 },
      { x: 0, y: 0 },
      3,
      true,
      1,
    );
    assert.equal(closePath, true);
  });
});

describe("penTool hitTest", () => {
  const pts: PathPoint[] = [
    { id: "a", x: 0, y: 0, handleOut: { x: 20, y: 0 } },
    { id: "b", x: 40, y: 0, handleIn: { x: -20, y: 0 } },
  ];

  it("uses zoom-aware thresholds", () => {
    assert.equal(hitTestAnchor(0, 0, pts, penHitRadiusWorld(1))?.pointId, "a");
    assert.equal(hitTestPenPathAtZoom(20, 0, pts, false, 1)?.kind, "in-handle");
  });
});

describe("penTool handleMirror", () => {
  it("alt-drag keeps only the moved handle on smooth points", () => {
    const point: PathPoint = {
      id: "a",
      x: 0,
      y: 0,
      pointType: "smooth",
      handleIn: { x: -10, y: 0 },
      handleOut: { x: 10, y: 0 },
    };
    const mirroring = effectiveHandleMirroring(point, "angle-length", true);
    const next = mergePathPointHandles(point, { handleOut: { x: 10, y: 5 } }, mirroring, "out");
    assert.deepEqual(next.handleOut, { x: 10, y: 5 });
    assert.deepEqual(next.handleIn, { x: -10, y: 0 });
  });

  it("legacy points without pointType do not mirror handles", () => {
    const legacy: PathPoint = { id: "a", x: 0, y: 0, handleOut: { x: 5, y: 0 } };
    assert.equal(effectiveHandleMirroring(legacy, "angle-length"), "none");
    const toggled = togglePathPointType(legacy, 10);
    assert.equal(toggled.pointType, "smooth");
  });
});

describe("penTool path point model", () => {
  it("click creates corner point without handles", () => {
    const pt = buildCornerPathPoint(10, 20);
    assert.equal(pt.pointType, "corner");
    assert.equal(pt.x, 10);
    assert.equal(pt.y, 20);
    assert.equal(pt.handleIn, undefined);
    assert.equal(pt.handleOut, undefined);
  });

  it("click-drag creates mirrored smooth handles with clamped length", () => {
    const prev = buildCornerPathPoint(0, 0);
    const { prevPatch, newPoint } = buildSmoothPathPointFromDrag(
      prev,
      { x: 100, y: 0 },
      { x: 200, y: 0 },
    );
    assert.deepEqual(prevPatch.handleOut, { x: 60, y: 0 });
    assert.equal(newPoint.pointType, "smooth");
    assert.deepEqual(newPoint.handleIn, { x: -60, y: 0 });
    assert.deepEqual(newPoint.handleOut, { x: 60, y: 0 });
  });
});

describe("penTool bezier geometry", () => {
  it("preview segment equals committed cubic path for same points", () => {
    const points = [
      { x: 0, y: 0, handleOut: { x: 10, y: 0 } },
      { x: 20, y: 0, handleIn: { x: -10, y: 0 }, handleOut: { x: 10, y: 0 } },
    ];
    const committed = penPreviewPathD(points);
    const preview = previewSegmentD(points[0]!, { x: 20, y: 0 }, {
      anchor: { x: 20, y: 0 },
      drag: { x: 30, y: 0 },
    });
    const fullPreview = penPreviewPathD(buildPenPreviewPoints([points[0]!], { x: 20, y: 0 }, { x: 30, y: 0 }));
    assert.match(committed, /^M 0 0 C/);
    assert.equal(preview.isCurve, true);
    assert.match(fullPreview, /C 10 0, 10 0, 20 0/);
  });

  it("falls back to straight line when handles are absent", () => {
    const seg = previewSegmentBetween({ x: 0, y: 0 }, { x: 10, y: 5 });
    assert.equal(seg.isCurve, false);
    assert.match(seg.path, /L 10 5$/);
  });
});

describe("penTool handleMirror extended", () => {
  it("smooth handle drag mirrors opposite handle by default", () => {
    const point: PathPoint = {
      id: "a",
      x: 0,
      y: 0,
      pointType: "smooth",
      handleIn: { x: -10, y: 0 },
      handleOut: { x: 10, y: 0 },
    };
    const mirroring = effectiveHandleMirroring(point, "angle-length");
    const next = mergePathPointHandles(point, { handleOut: { x: 0, y: 10 } }, mirroring, "out");
    assert.deepEqual(next.handleOut, { x: 0, y: 10 });
    assert.deepEqual(next.handleIn, { x: 0, y: -10 });
  });

  it("corner point does not mirror handles", () => {
    const corner: PathPoint = {
      id: "a",
      x: 0,
      y: 0,
      pointType: "corner",
      handleOut: { x: 10, y: 0 },
    };
    assert.equal(effectiveHandleMirroring(corner, "angle-length"), "none");
    const next = mergePathPointHandles(corner, { handleOut: { x: 10, y: 5 } }, "none", "out");
    assert.deepEqual(next.handleOut, { x: 10, y: 5 });
    assert.equal(next.handleIn, undefined);
  });
});

describe("penTool shift snap handles", () => {
  it("snaps click-drag handle direction to 45°", () => {
    const anchor = { x: 0, y: 0 };
    const raw = { x: 10, y: 9 };
    const snapped = resolvePenDragPreview(anchor, raw, true);
    const angle = (Math.atan2(snapped.y - anchor.y, snapped.x - anchor.x) * 180) / Math.PI;
    assert.ok(Math.abs(angle - 45) < 1e-6);
  });
});

describe("penTool preview rendering", () => {
  it("builds matching world and overlay segment paths", () => {
    const last = { x: 0, y: 0 };
    const target = { x: 10, y: 0 };
    const world = previewSegmentD(last, target, null);
    const overlay = overlayPreviewSegmentD(last, target, null, {
      screenSpace: true,
      pan: { x: 0, y: 0 },
      zoom: 1,
    });
    assert.equal(world.isCurve, false);
    assert.equal(overlay.isCurve, false);
    assert.match(world.path, /L 10 0$/);
    assert.match(overlay.path, /L 10 0$/);
  });

  it("builds cubic path d for smooth segments", () => {
    const d = penPreviewPathD([
      { x: 0, y: 0, handleOut: { x: 10, y: 0 } },
      { x: 20, y: 0, handleIn: { x: -10, y: 0 } },
    ]);
    assert.match(d, /C 10 0, 10 0, 20 0/);
  });
});
