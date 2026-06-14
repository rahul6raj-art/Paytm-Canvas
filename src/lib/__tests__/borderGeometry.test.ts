import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRoundedRectBorderFills,
  resolveBorderRingBounds,
  roundedRectBorderFills,
} from "@/lib/borderGeometry";
import { resolveStrokeSideWidths, resolveStrokeSides } from "@/lib/strokeAlign";

const W = 200;
const H = 100;
const RADII = [24, 24, 24, 24] as const;

function borderInput(
  sides: Partial<Record<"top" | "right" | "bottom" | "left", number>>,
  position: "inside" | "center" | "outside" = "inside",
) {
  const sideWidths = {
    top: sides.top ?? 0,
    right: sides.right ?? 0,
    bottom: sides.bottom ?? 0,
    left: sides.left ?? 0,
  };
  return {
    width: W,
    height: H,
    radii: [...RADII] as [number, number, number, number],
    sides: {
      top: sideWidths.top > 0,
      right: sideWidths.right > 0,
      bottom: sideWidths.bottom > 0,
      left: sideWidths.left > 0,
    },
    sideWidths,
    position,
  };
}

function ptsCurvedCorner(
  points: { x: number; y: number }[],
  corner: "tl" | "tr" | "br" | "bl",
  w = W,
  h = H,
): boolean {
  return points.some((p) => {
    if (corner === "tl") return p.x > 0 && p.x < 20 && p.y > 0 && p.y < 20;
    if (corner === "tr") return p.x > w - 20 && p.x < w && p.y > 0 && p.y < 20;
    if (corner === "br") return p.x > w - 20 && p.x < w && p.y > h - 20 && p.y < h;
    return p.x > 0 && p.x < 20 && p.y > h - 20 && p.y < h;
  });
}

describe("borderGeometry/resolveBorderRingBounds", () => {
  it("inside position insets inner contour by side widths", () => {
    const ring = resolveBorderRingBounds(borderInput({ top: 8, left: 12 }));
    assert.ok(ring);
    assert.equal(ring!.outer.width, W);
    assert.equal(ring!.inner.x, 12);
    assert.equal(ring!.inner.y, 8);
    assert.equal(ring!.inner.width, W - 12);
    assert.equal(ring!.inner.height, H - 8);
  });
});

describe("borderGeometry/buildRoundedRectBorderFills", () => {
  for (const side of ["top", "right", "bottom", "left"] as const) {
    it(`${side}-only fill is a closed polygon with curved corners`, () => {
      const fills = buildRoundedRectBorderFills(borderInput({ [side]: 4 }));
      assert.equal(fills.length, 1);
      assert.equal(fills[0]!.side, side);
      assert.match(fills[0]!.pathD, /Z$/);
      assert.ok(fills[0]!.points.length >= 6);
      const ys = fills[0]!.points.map((p) => p.y);
      const xs = fills[0]!.points.map((p) => p.x);
      if (side === "top") {
        assert.ok(ys.some((y) => Math.abs(y) < 0.01));
        assert.ok(xs.some((x) => x >= 24 && x <= W - 24));
        assert.ok(ptsCurvedCorner(fills[0]!.points, "tl"));
        assert.ok(ptsCurvedCorner(fills[0]!.points, "tr", W));
      }
      if (side === "right") {
        assert.ok(Math.max(...xs) > W - 5);
        assert.ok(xs.some((x) => Math.abs(x - W) < 0.01));
      }
      if (side === "bottom") {
        assert.ok(ys.some((y) => Math.abs(y - H) < 0.01));
        assert.ok(ptsCurvedCorner(fills[0]!.points, "br", W, H));
      }
      if (side === "left") {
        assert.ok(xs.some((x) => Math.abs(x) < 0.01));
        assert.ok(ptsCurvedCorner(fills[0]!.points, "bl", 0, H));
      }
    });
  }

  it("top-only inside border uses concentric inner corner arcs", () => {
    const fills = buildRoundedRectBorderFills(borderInput({ top: 8 }, "inside"));
    const pts = fills[0]!.points;
    const innerArcPts = pts.filter((p) => p.y >= 7.5 && p.y <= 24.5 && p.x <= 24.5);
    assert.ok(innerArcPts.length >= 4);
    for (const p of innerArcPts) {
      const dx = p.x - 24;
      const dy = p.y - 24;
      const dist = Math.hypot(dx, dy);
      assert.ok(Math.abs(dist - 16) < 0.5 || Math.abs(dist - 24) < 0.5, `point (${p.x},${p.y}) should lie on concentric arc`);
    }
    const innerEdgePts = pts.filter((p) => Math.abs(p.y - 8) < 0.01 && p.x >= 24 && p.x <= 176);
    assert.ok(innerEdgePts.length >= 1, "inner top edge should meet arc at x=radius");
  });

  it("top-only border follows radius (not a flat strip)", () => {
    const fills = buildRoundedRectBorderFills(borderInput({ top: 8 }));
    const pts = fills[0]!.points;
    const hasCurvedCorner = pts.some((p) => p.y > 0.5 && p.y < 7.5 && p.x > 0 && p.x < 20);
    assert.ok(hasCurvedCorner, "top border should include TL arc interior points");
    assert.ok(pts.some((p) => p.x > W - 20 && p.y > 0.5 && p.y < 7.5));
  });

  it("mixed widths top=8 right=2 bottom=0 left=12", () => {
    const fills = buildRoundedRectBorderFills(
      borderInput({ top: 8, right: 2, bottom: 0, left: 12 }),
    );
    assert.equal(fills.length, 3);
    const bySide = Object.fromEntries(fills.map((f) => [f.side, f]));
    assert.equal(bySide.top!.width, 8);
    assert.equal(bySide.right!.width, 2);
    assert.equal(bySide.left!.width, 12);
    assert.ok(bySide.top!.points.length >= 6);
    assert.ok(bySide.right!.points.length >= 4);
    assert.ok(bySide.left!.points.length >= 6);
  });

  it("top+left splits TL corner along shared seam", () => {
    const fills = buildRoundedRectBorderFills(borderInput({ top: 4, left: 4 }));
    const top = fills.find((f) => f.side === "top")!;
    const left = fills.find((f) => f.side === "left")!;
    const topOwnsOuterTop = top.points.some((p) => Math.abs(p.y) < 0.01 && p.x >= 24 && p.x <= W - 24);
    const leftOwnsOuterLeft = left.points.some((p) => Math.abs(p.x) < 0.01 && p.y >= 24 && p.y <= H - 24);
    assert.ok(topOwnsOuterTop);
    assert.ok(leftOwnsOuterLeft);
    assert.ok(ptsCurvedCorner(top.points, "tl"));
    assert.ok(ptsCurvedCorner(left.points, "tl"));
  });

  it("outside position expands outer contour upward for top border", () => {
    const fills = buildRoundedRectBorderFills(borderInput({ top: 6 }, "outside"));
    const minY = Math.min(...fills[0]!.points.map((p) => p.y));
    assert.ok(minY < -0.5);
  });

  it("top-only border trims at corner radius (no flat overhang)", () => {
    const fills = buildRoundedRectBorderFills(borderInput({ top: 8 }));
    const pts = fills[0]!.points;
    const outerTopPts = pts.filter((p) => Math.abs(p.y) < 0.05);
    assert.ok(outerTopPts.length >= 2);
    const minX = Math.min(...outerTopPts.map((p) => p.x));
    const maxX = Math.max(...outerTopPts.map((p) => p.x));
    assert.ok(minX >= 24 - 0.5, `top stroke should not overhang left corner (minX=${minX})`);
    assert.ok(maxX <= W - 24 + 0.5, `top stroke should not overhang right corner (maxX=${maxX})`);
    assert.ok(pts.some((p) => p.x > 0 && p.x < 24 && p.y > 0 && p.y < 24), "includes TL corner arc");
    assert.ok(pts.some((p) => p.x > W - 24 && p.x < W && p.y > 0 && p.y < 24), "includes TR corner arc");
  });

  it("top+right with mixed colors assigns corners to correct sides", () => {
    const fills = buildRoundedRectBorderFills({
      width: 63,
      height: 76,
      radii: [21, 21, 21, 21],
      sides: { top: true, right: true, bottom: false, left: false },
      sideWidths: { top: 1, right: 1, bottom: 0, left: 0 },
      position: "center",
    });
    assert.equal(fills.length, 2);
    const top = fills.find((f) => f.side === "top")!;
    const right = fills.find((f) => f.side === "right")!;

    const centroid = (pts: { x: number; y: number }[]) => ({
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    });
    const topC = centroid(top.points);
    const rightC = centroid(right.points);
    assert.ok(topC.y < 38, "top fill should live on upper half");
    assert.ok(rightC.x > 31, "right fill should live on right half");

    assert.ok(ptsCurvedCorner(top.points, "tl", 63, 76), "top owns TL corner");
    assert.ok(!ptsCurvedCorner(top.points, "bl", 63, 76), "top must not own BL corner");
    assert.ok(ptsCurvedCorner(right.points, "br", 63, 76), "right owns BR corner");
    assert.ok(!ptsCurvedCorner(right.points, "bl", 63, 76), "right must not own BL corner");

    const topStraight = top.points.some(
      (p) => p.x >= 21 && p.x <= 42 && Math.abs(p.y + 0.5) < 0.05,
    );
    const rightStraight = right.points.some(
      (p) => p.y >= 21 && p.y <= 55 && Math.abs(p.x - 63.5) < 0.05,
    );
    assert.ok(topStraight, "top fill should include straight top edge");
    assert.ok(rightStraight, "right fill should include straight right edge");

    const blRegion = top.points.filter((p) => p.x < 10 && p.y > 66);
    const trRegion = top.points.filter((p) => p.x > 53 && p.y < 10);
    assert.equal(blRegion.length, 0, "top fill must not extend into BL corner");
    assert.ok(trRegion.length > 0, "top fill should include TR corner region");
  });

  it("bridges TR corner when adjacent side widths differ", () => {
    const fills = buildRoundedRectBorderFills({
      width: 26,
      height: 29,
      radii: [13, 13, 13, 13],
      sides: { top: true, right: true, bottom: false, left: false },
      sideWidths: { top: 1, right: 8, bottom: 0, left: 0 },
      position: "center",
    });
    assert.equal(fills.length, 2);
    const top = fills.find((f) => f.side === "top")!;
    const seamRight = { x: 25.02081528017131, y: 0.9791847198286927 };
    assert.ok(
      top.points.some((p) => Math.hypot(p.x - seamRight.x, p.y - seamRight.y) < 0.02),
      "top fill should bridge to the thicker right side outer seam",
    );
    const uniform = buildRoundedRectBorderFills({
      width: 26,
      height: 29,
      radii: [13, 13, 13, 13],
      sides: { top: true, right: true, bottom: false, left: false },
      sideWidths: { top: 1, right: 1, bottom: 0, left: 0 },
      position: "center",
    });
    const topUniform = uniform.find((f) => f.side === "top")!;
    const maxXUniform = Math.max(...topUniform.points.map((p) => p.x));
    const maxXMixed = Math.max(...top.points.map((p) => p.x));
    assert.ok(maxXMixed > maxXUniform + 1, "mixed widths should extend top fill into TR corner");
  });

  it("top+bottom splits horizontal halves with distinct corner ownership", () => {
    const fills = buildRoundedRectBorderFills({
      width: 63,
      height: 76,
      radii: [21, 21, 21, 21],
      sides: { top: true, right: false, bottom: true, left: false },
      sideWidths: { top: 1, right: 0, bottom: 1, left: 0 },
      position: "center",
    });
    assert.equal(fills.length, 2);
    const top = fills.find((f) => f.side === "top")!;
    const bottom = fills.find((f) => f.side === "bottom")!;
    assert.ok(ptsCurvedCorner(top.points, "tl", 63, 76));
    assert.ok(ptsCurvedCorner(top.points, "tr", 63, 76));
    assert.ok(!ptsCurvedCorner(top.points, "bl", 63, 76));
    assert.ok(ptsCurvedCorner(bottom.points, "bl", 63, 76));
    assert.ok(ptsCurvedCorner(bottom.points, "br", 63, 76));
    assert.ok(!ptsCurvedCorner(bottom.points, "tl", 63, 76));
  });
});

describe("borderGeometry/roundedRectBorderFills", () => {
  it("works for frame nodes", () => {
    const fills = roundedRectBorderFills({
      type: "frame",
      width: 120,
      height: 80,
      strokeWidth: 3,
      strokeSides: "bottom",
      cornerRadius: 12,
      strokePosition: "inside",
    });
    assert.ok(fills);
    assert.equal(fills!.length, 1);
    assert.equal(fills![0]!.side, "bottom");
    assert.match(fills![0]!.pathD, /Z$/);
  });

  it("returns null for sharp rectangles (caller uses rect bands)", () => {
    const fills = roundedRectBorderFills({
      type: "rectangle",
      width: 100,
      height: 60,
      strokeWidth: 4,
      strokeSides: "top",
      cornerRadius: 0,
      strokePosition: "inside",
    });
    assert.equal(fills, null);
  });
});
