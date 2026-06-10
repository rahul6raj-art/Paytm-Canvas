import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampStarPointCount,
  clampStarRatio,
  maxStarCornerRadius,
  roundedPolygonPathD,
  starGeometryPatch,
  starPathD,
  starRatioFromLocalPoint,
  starVertices,
} from "@/lib/shapes/starGeometry";

describe("starGeometry", () => {
  it("clamps point count to 3–100", () => {
    assert.equal(clampStarPointCount(2), 3);
    assert.equal(clampStarPointCount(150), 100);
    assert.equal(clampStarPointCount(5.7), 6);
  });

  it("clamps ratio to 0–1", () => {
    assert.equal(clampStarRatio(-1), 0);
    assert.equal(clampStarRatio(2), 1);
  });

  it("produces 2×points vertices", () => {
    const v = starVertices(5, 0.4, 100, 100);
    assert.equal(v.length, 10);
    assert.ok(Math.abs(v[0]!.y) < 1e-6);
    assert.ok(v[0]!.y < v[1]!.y);
  });

  it("starPathD includes arcs when corner radius > 0", () => {
    const sharp = starPathD(100, 100, 5, 0.4, 0);
    const round = starPathD(100, 100, 5, 0.4, 8);
    assert.ok(sharp.includes("L "));
    assert.ok(!sharp.includes(" A "));
    assert.ok(round.includes(" A "));
    assert.ok(round.endsWith(" Z"));
  });

  it("ratio from local point on inner spike", () => {
    const inner = starVertices(5, 0.4, 100, 100)[1]!;
    const r = starRatioFromLocalPoint(inner.x, inner.y, 5, 100, 100);
    assert.ok(Math.abs(r - 0.4) < 0.05);
  });

  it("starGeometryPatch syncs metadata and anchors", () => {
    const patch = starGeometryPatch(
      { width: 80, height: 80, starPoints: 5, starInnerRadius: 0.5, cornerRadius: 0 },
      { starPoints: 6, cornerRadius: 4 },
    );
    assert.equal(patch.starPoints, 6);
    assert.equal(patch.pathPoints?.length, 12);
    assert.ok((patch.cornerRadius ?? 0) > 0);
  });

  it("roundedPolygonPathD closes for triangle", () => {
    const d = roundedPolygonPathD(
      [
        { x: 50, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      5,
    );
    assert.ok(d.endsWith(" Z"));
  });

  it("roundedPolygonPathD rounds convex corners inward (not outward)", () => {
    const verts = [
      { x: 50, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const r = 8;
    const d = roundedPolygonPathD(verts, r);
    const arcMatch = /A\s+([\d.]+)\s+([\d.]+)\s+0\s+0\s+1\s+([\d.]+)\s+([\d.]+)/.exec(d);
    assert.ok(arcMatch, "expected clockwise fillet arc at top vertex");
    const endX = Number(arcMatch[3]);
    const endY = Number(arcMatch[4]);
    assert.ok(endX > 50 && endY > 0, "top corner arc should trim into the triangle");
    assert.ok(endY < r + 2, "top corner arc should not bulge above the vertex");
  });

  it("maxStarCornerRadius is positive for default star", () => {
    const max = maxStarCornerRadius(5, 0.4, 100, 100);
    assert.ok(max > 5);
  });
});
