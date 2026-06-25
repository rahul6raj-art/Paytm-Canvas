import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tessellateSvgPathD } from "@/lib/outlineStroke";
import { buildRoundedRectPath } from "@/lib/vector/roundedRectPath";
import {
  allStrokeSidesEnabled,
  buildRoundedRectStrokeSegments,
  DEFAULT_STROKE_SIDES,
} from "@/lib/vector/roundedRectStrokeSegments";

const W = 200;
const H = 100;
const R = 24;
const STROKE = 8;

function sides(overrides: Partial<Record<"top" | "right" | "bottom" | "left", boolean>>) {
  return { ...DEFAULT_STROKE_SIDES, ...overrides };
}

function topSegment(strokeSides: ReturnType<typeof sides>, smoothing = 0) {
  const segments = buildRoundedRectStrokeSegments({
    width: W,
    height: H,
    radius: R,
    smoothing,
    strokeSides,
    strokeWidth: STROKE,
  });
  const segment = segments.find((s) => s.side === "top");
  assert.ok(segment, "expected top segment");
  return segment!;
}

describe("buildRoundedRectStrokeSegments", () => {
  it("returns empty array when all sides are enabled (use full closed stroke)", () => {
    const segments = buildRoundedRectStrokeSegments({
      width: W,
      height: H,
      radius: R,
      strokeSides: DEFAULT_STROKE_SIDES,
      strokeWidth: STROKE,
    });
    assert.equal(segments.length, 0);
    assert.equal(allStrokeSidesEnabled(DEFAULT_STROKE_SIDES), true);
  });

  it("top-only returns one open path without closing Z", () => {
    const segment = topSegment(sides({ top: true, right: false, bottom: false, left: false }));
    assert.match(segment.d, /^M /);
    assert.doesNotMatch(segment.d, /Z$/i);
  });

  it("top stroke segment contains cubic C commands when radius > 0", () => {
    const segment = topSegment(sides({ top: true, right: false, bottom: false, left: false }));
    assert.match(segment.d, /\bC\b/);
  });

  it("top stroke segment is not a rectangle (uses curved contour, not axis-aligned box)", () => {
    const segment = topSegment(sides({ top: true, right: false, bottom: false, left: false }));
    assert.doesNotMatch(segment.d, /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ Z$/);
    const pts = tessellateSvgPathD(segment.d);
    assert.ok(pts.some((p) => p.y > 0.5 && p.y < R));
  });

  it("top stroke starts and ends on the rounded contour", () => {
    const segment = topSegment(sides({ top: true, right: false, bottom: false, left: false }));
    const pts = tessellateSvgPathD(segment.d);
    const start = pts[0]!;
    const end = pts[pts.length - 1]!;
    assert.ok(Math.abs(start.x) < 1 && Math.abs(start.y - R) < 2);
    assert.ok(Math.abs(end.x - W) < 1 && Math.abs(end.y - R) < 2);
  });

  it("left-only returns one open path", () => {
    const segments = buildRoundedRectStrokeSegments({
      width: W,
      height: H,
      radius: R,
      strokeSides: sides({ top: false, right: false, bottom: false, left: true }),
      strokeWidth: STROKE,
    });
    assert.equal(segments.length, 1);
    assert.equal(segments[0]!.side, "left");
    assert.doesNotMatch(segments[0]!.d, /Z$/i);
  });

  it("adjacent top+left segments meet at the shared TL corner split", () => {
    const strokeSides = sides({ top: true, right: false, bottom: false, left: true });
    const segments = buildRoundedRectStrokeSegments({
      width: W,
      height: H,
      radius: R,
      strokeSides,
      strokeWidth: STROKE,
    });
    assert.equal(segments.length, 2);

    const topPts = tessellateSvgPathD(segments.find((s) => s.side === "top")!.d);
    const leftPts = tessellateSvgPathD(segments.find((s) => s.side === "left")!.d);
    const topStart = topPts[0]!;
    const leftEnd = leftPts[leftPts.length - 1]!;
    assert.ok(Math.hypot(topStart.x - leftEnd.x, topStart.y - leftEnd.y) < 0.5);
  });

  it("opposite left+right segments stay separate", () => {
    const strokeSides = sides({ top: false, right: true, bottom: false, left: true });
    const segments = buildRoundedRectStrokeSegments({
      width: W,
      height: H,
      radius: R,
      strokeSides,
      strokeWidth: STROKE,
    });
    assert.equal(segments.length, 2);
    const leftPts = tessellateSvgPathD(segments.find((s) => s.side === "left")!.d);
    const rightPts = tessellateSvgPathD(segments.find((s) => s.side === "right")!.d);
    assert.ok(Math.max(...leftPts.map((p) => p.x)) < W / 2);
    assert.ok(Math.min(...rightPts.map((p) => p.x)) > W / 2);
  });

  it("does not include geometry from disabled sides", () => {
    const topPts = tessellateSvgPathD(
      topSegment(sides({ top: true, right: false, bottom: false, left: false })).d,
    );
    assert.ok(topPts.every((p) => p.y <= R + 1));
    assert.ok(!topPts.some((p) => p.y >= H - 1));

    const leftSeg = buildRoundedRectStrokeSegments({
      width: W,
      height: H,
      radius: R,
      strokeSides: sides({ top: false, right: false, bottom: false, left: true }),
      strokeWidth: STROKE,
    })[0]!;
    const leftPts = tessellateSvgPathD(leftSeg.d);
    assert.ok(leftPts.every((p) => p.x <= R + 1));
    assert.ok(!leftPts.some((p) => p.x >= W - 1));
  });

  it("partial stroke uses same corner smoothing as full shape", () => {
    const fullPath = buildRoundedRectPath({ width: W, height: H, radius: R, smoothing: 0.6 });
    const segment = topSegment(
      sides({ top: true, right: true, bottom: false, left: false }),
      0.6,
    );
    assert.match(fullPath, /\bC\b/);
    assert.match(segment.d, /\bC\b/);
    const pts = tessellateSvgPathD(segment.d);
    assert.ok(pts.length >= 6);
  });

  it("side stroke path follows curve with smoothing 0.6", () => {
    const segment = topSegment(sides({ top: true, right: false, bottom: false, left: false }), 0.6);
    const pts = tessellateSvgPathD(segment.d);
    assert.ok(pts.some((p) => p.y > 0.2 && p.y < R));
    assert.ok(pts.some((p) => p.x > W - R - 1 && p.x < W && p.y > 0.2));
  });
});

describe("roundedRectPerSideStroke visual fixture", () => {
  it("includes Figma-like per-side stroke samples", async () => {
    const { buildRoundedRectPerSideStrokeFixtureSvg } = await import(
      "@/lib/vector/roundedRectPerSideStrokeFixture"
    );
    const svg = buildRoundedRectPerSideStrokeFixtureSvg();
    assert.ok(svg.includes("top + left"));
    assert.ok(svg.includes("full stroke"));
    assert.ok(svg.includes('fill="#e53935"'));
    assert.ok(svg.includes('fill="#ffffff"'));
  });
});
