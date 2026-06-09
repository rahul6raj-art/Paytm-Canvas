import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getActiveSideChains,
  roundedRectStrokeSegments,
  traceChainPathD,
} from "@/lib/roundedRectSideStroke";
import { resolveStrokeSideWidths, resolveStrokeSides } from "@/lib/strokeAlign";

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

  it("emits one path per active side (top+right includes TL and TR arcs on top)", () => {
    const segs = roundedRectStrokeSegments({
      type: "rectangle",
      width: 200,
      height: 100,
      strokeWidth: 4,
      strokeSides: "custom",
      strokeSidesCustom: { top: 4, right: 4, bottom: 0, left: 0 },
      cornerRadius: 24,
      strokePosition: "outside",
      strokeStyle: "solid",
    });
    assert.ok(segs);
    assert.equal(segs!.length, 2);
    const top = segs!.find((s) => s.sides[0] === "top")!;
    assert.match(top.pathD, /M 0 24/);
    assert.equal((top.pathD.match(/A 24 24/g) ?? []).length, 2);
    assert.match(top.pathD, /H 176/);
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
});
