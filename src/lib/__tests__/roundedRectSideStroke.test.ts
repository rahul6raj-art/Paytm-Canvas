import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildRectSideStrokePath,
  getActiveSideChains,
  roundedCornerArc,
  roundedRectStrokeSegments,
  traceChainPathD,
} from "@/lib/roundedRectSideStroke";
import { resolveStrokeSideWidths, resolveStrokeSides } from "@/lib/strokeAlign";

const RADII = [24, 24, 24, 24] as const;
const W = 200;
const H = 100;

function allSides(on: boolean) {
  return { top: on, right: on, bottom: on, left: on };
}

describe("roundedCornerArc", () => {
  it("splits TL corner into non-overlapping halves", () => {
    const first = roundedCornerArc("tl", 24, W, H, "first");
    const second = roundedCornerArc("tl", 24, W, H, "second");
    const full = roundedCornerArc("tl", 24, W, H, "full");
    assert.match(first, /M 0 24/);
    assert.match(second, /24 0$/);
    assert.equal((full.match(/A 24 24/g) ?? []).length, 1);
    assert.equal((first.match(/A 24 24/g) ?? []).length, 1);
    assert.equal((second.match(/A 24 24/g) ?? []).length, 1);
  });
});

describe("buildRectSideStrokePath", () => {
  for (const side of ["top", "right", "bottom", "left"] as const) {
    it(`${side}-only stroke follows corner radius with two arcs`, () => {
      const path = buildRectSideStrokePath(side, W, H, RADII, {
        ...allSides(false),
        [side]: true,
      });
      assert.ok(path);
      assert.match(path!, /\bA\b/);
      assert.equal((path!.match(/A 24 24/g) ?? []).length, 2);
    });
  }

  it("top+left shares TL corner without drawing full arc on both sides", () => {
    const top = buildRectSideStrokePath("top", W, H, RADII, {
      top: true,
      right: false,
      bottom: false,
      left: true,
    });
    const left = buildRectSideStrokePath("left", W, H, RADII, {
      top: true,
      right: false,
      bottom: false,
      left: true,
    });
    assert.ok(top && left);
    assert.equal((top!.match(/A 24 24/g) ?? []).length, 2);
    assert.equal((left!.match(/A 24 24/g) ?? []).length, 2);
    assert.doesNotMatch(top!, /A 24 24 0 0 1 24 0/);
    assert.match(left!, /A 24 24 0 0 1 24 0/);
  });

  it("top edge is a straight horizontal segment", () => {
    const path = buildRectSideStrokePath("top", W, H, RADII, {
      top: true,
      right: false,
      bottom: false,
      left: false,
    });
    assert.match(path!, /H 176/);
  });
});

describe("traceChainPathD", () => {
  it("connects top and right with one TR arc and straight legs", () => {
    const d = traceChainPathD(["top", "right"], 200, 100, [24, 24, 24, 24]);
    assert.match(d, /M 24 0/);
    assert.match(d, /L 176 0/);
    assert.equal((d.match(/A 24 24/g) ?? []).length, 1);
    assert.match(d, /L 200 76/);
  });
});

describe("getActiveSideChains", () => {
  it("merges top and right into one chain", () => {
    const sides = resolveStrokeSides({
      strokeSides: "custom",
      strokeWidth: 4,
      strokeSidesCustom: { top: 4, right: 4, bottom: 0, left: 0 },
    });
    assert.deepEqual(getActiveSideChains(sides), [["top", "right"]]);
  });
});

describe("roundedRectStrokeSegments", () => {
  it("includes both corner arcs for a single active side (bottom)", () => {
    const segs = roundedRectStrokeSegments({
      type: "rectangle",
      width: 200,
      height: 100,
      strokeWidth: 4,
      strokeSides: "custom",
      strokeSidesCustom: { top: 0, right: 0, bottom: 4, left: 0 },
      cornerRadius: 24,
      strokePosition: "outside",
      strokeStyle: "solid",
    });
    assert.ok(segs);
    assert.equal(segs!.length, 1);
    assert.deepEqual(segs![0]!.sides, ["bottom"]);
    assert.equal((segs![0]!.pathD.match(/A 24 24/g) ?? []).length, 2);
  });

  it("emits one path per active side (top+right splits TR corner)", () => {
    const segs = roundedRectStrokeSegments({
      type: "rectangle",
      width: 200,
      height: 100,
      strokeWidth: 4,
      strokeSides: "custom",
      strokeSidesCustom: { top: 4, right: 4, bottom: 0, left: 0 },
      cornerRadius: 24,
      strokePosition: "inside",
      strokeStyle: "solid",
    });
    assert.ok(segs);
    assert.equal(segs!.length, 2);
    const top = segs!.find((s) => s.sides[0] === "top")!;
    const right = segs!.find((s) => s.sides[0] === "right")!;
    assert.match(top.pathD, /M 0 24/);
    assert.equal((top.pathD.match(/A 24 24/g) ?? []).length, 2);
    assert.match(top.pathD, /H 176/);
    assert.doesNotMatch(top.pathD, /A 24 24 0 0 1 200 24/);
    assert.match(right.pathD, /A 24 24 0 0 1 200 24/);
  });

  it("left+right yields two vertical side segments", () => {
    const segs = roundedRectStrokeSegments({
      type: "rectangle",
      width: 200,
      height: 100,
      strokeWidth: 4,
      strokeSides: "custom",
      strokeSidesCustom: { top: 0, right: 4, bottom: 0, left: 4 },
      cornerRadius: 24,
      strokePosition: "outside",
      strokeStyle: "solid",
    });
    assert.ok(segs);
    assert.equal(segs!.length, 2);
    assert.deepEqual(
      segs!.map((s) => s.sides[0]).sort(),
      ["left", "right"],
    );
  });

  it("works for inside stroke alignment on frames", () => {
    const segs = roundedRectStrokeSegments({
      type: "frame",
      width: 120,
      height: 80,
      strokeWidth: 3,
      strokeSides: "bottom",
      cornerRadius: 12,
      strokePosition: "inside",
      strokeStyle: "solid",
    });
    assert.ok(segs);
    assert.equal(segs!.length, 1);
    assert.match(segs![0]!.pathD, /\bA\b/);
  });
});
