import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToSvgD, type PathPoint } from "@/lib/pathGeometry";
import { mergePathPointHandles, type PathHandleMirroring } from "@/lib/pathHandles";
import { effectiveHandleMirroring } from "@/lib/penTool/handleMirror";
import {
  buildHandleDragPatch,
  pathPointsToSvgPathD,
  relativeHandleFromPointer,
  segmentPathD,
} from "@/lib/vector/pathHandleDrag";

function makePoint(
  id: string,
  x: number,
  y: number,
  extra?: Partial<PathPoint>,
): PathPoint {
  return { id, x, y, pointType: "corner", ...extra };
}

/** Mirror store `updatePathPoint` handle patch application. */
function applyHandleDrag(
  points: PathPoint[],
  pointIndex: number,
  kind: "handle-in" | "handle-out",
  pointerLocal: { x: number; y: number },
  opts?: { breakMirror?: boolean; nodeMirroring?: PathHandleMirroring },
): PathPoint[] {
  const point = points[pointIndex]!;
  const relative = relativeHandleFromPointer({ x: point.x, y: point.y }, pointerLocal);
  const patch =
    kind === "handle-in" ? { handleIn: relative } : { handleOut: relative };
  const movedWhich = kind === "handle-in" ? "in" : "out";
  let merged: PathPoint = { ...point };
  const mirroring = effectiveHandleMirroring(
    merged,
    opts?.nodeMirroring ?? "none",
    opts?.breakMirror,
  );
  merged = mergePathPointHandles(merged, patch, mirroring, movedWhich);
  return points.map((p, i) => (i === pointIndex ? merged : p));
}

describe("path handle drag geometry", () => {
  const base: PathPoint[] = [
    makePoint("p0", 0, 0),
    makePoint("p1", 100, 0),
    makePoint("p2", 200, 0),
  ];

  it("stores pointer position as handle vector relative to anchor", () => {
    const anchor = { x: 100, y: 50 };
    const pointer = { x: 130, y: 80 };
    const relative = relativeHandleFromPointer(anchor, pointer);
    assert.deepEqual(relative, { x: 30, y: 30 });
    assert.deepEqual(
      {
        x: anchor.x + relative.x,
        y: anchor.y + relative.y,
      },
      pointer,
    );
  });

  it("dragging point[0].handleOut changes segment 0→1 SVG path", () => {
    const before = segmentPathD(base, 0);
    assert.equal(before, "M 0 0 L 100 0");

    const next = applyHandleDrag(base, 0, "handle-out", { x: 50, y: 30 });
    const after = segmentPathD(next, 0);
    assert.equal(after, "M 0 0 C 50 30, 100 0, 100 0");
    assert.notEqual(after, before);
  });

  it("dragging point[1].handleIn changes segment 0→1 SVG path", () => {
    const next = applyHandleDrag(base, 1, "handle-in", { x: 70, y: 40 });
    const seg01 = segmentPathD(next, 0);
    assert.equal(seg01, "M 0 0 C 0 0, 70 40, 100 0");
  });

  it("dragging point[1].handleOut does not affect segment 0→1, only segment 1→2", () => {
    const next = applyHandleDrag(base, 1, "handle-out", { x: 130, y: 50 });
    const seg01 = segmentPathD(next, 0);
    const seg12 = segmentPathD(next, 1);
    assert.equal(seg01, "M 0 0 L 100 0");
    assert.equal(seg12, "M 100 0 C 130 50, 200 0, 200 0");
  });

  it("main path d changes after handle drag and matches pathToSvgD", () => {
    const next = applyHandleDrag(base, 0, "handle-out", { x: 40, y: 20 });
    const d = pathPointsToSvgPathD(next, false);
    assert.equal(d, pathToSvgD(next, false));
    assert.equal(d, "M 0 0 C 40 20, 100 0, 100 0 L 200 0");
  });

  it("smooth point mirrors opposite handle when dragging handleOut", () => {
    const smooth = makePoint("s", 0, 0, { pointType: "smooth" });
    const merged = buildHandleDragPatch(smooth, "handle-out", { x: 100, y: 0 });
    assert.deepEqual(merged.handleOut, { x: 100, y: 0 });
    assert.deepEqual(merged.handleIn, { x: -100, y: 0 });
  });

  it("smooth point mirrors opposite handle when dragging handleIn", () => {
    const smooth = makePoint("s", 50, 50, { pointType: "smooth" });
    const merged = buildHandleDragPatch(smooth, "handle-in", { x: 20, y: 80 });
    assert.deepEqual(merged.handleIn, { x: -30, y: 30 });
    assert.deepEqual(merged.handleOut, { x: 30, y: -30 });
  });

  it("Alt-drag breaks smooth mirroring", () => {
    const smooth = makePoint("s", 0, 0, {
      pointType: "smooth",
      handleIn: { x: -20, y: 0 },
      handleOut: { x: 20, y: 0 },
    });
    const merged = buildHandleDragPatch(smooth, "handle-out", { x: 100, y: 0 }, { breakMirror: true });
    assert.deepEqual(merged.handleOut, { x: 100, y: 0 });
    assert.deepEqual(merged.handleIn, { x: -20, y: 0 });
  });

  it("corner point drag updates only the dragged handle", () => {
    const corner = makePoint("c", 0, 0, {
      pointType: "corner",
      handleIn: { x: -10, y: 0 },
      handleOut: { x: 10, y: 0 },
    });
    const merged = buildHandleDragPatch(corner, "handle-out", { x: 80, y: 0 });
    assert.deepEqual(merged.handleOut, { x: 80, y: 0 });
    assert.deepEqual(merged.handleIn, { x: -10, y: 0 });
  });

  it("segment control points follow C1 = P0 + handleOut and C2 = P1 + handleIn", () => {
    const points: PathPoint[] = [
      makePoint("a", 0, 0, { handleOut: { x: 30, y: 10 } }),
      makePoint("b", 100, 0, { handleIn: { x: -20, y: 15 } }),
    ];
    assert.equal(segmentPathD(points, 0), "M 0 0 C 30 10, 80 15, 100 0");
  });
});
