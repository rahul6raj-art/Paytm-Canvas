import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampStarPointCount,
  clampStarRatio,
  maxStarCornerRadius,
  roundedPolygonPathD,
  starGeometryPatch,
  starPathD,
  starPathDForNode,
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

  it("starPathD includes circular fillets when corner radius > 0", () => {
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

  it("starPathDForNode supports per-vertex corner radii", () => {
    const uniform = starPathDForNode({
      width: 100,
      height: 100,
      starPoints: 5,
      starInnerRadius: 0.4,
      cornerRadius: 6,
    });
    const mixed = starPathDForNode({
      width: 100,
      height: 100,
      starPoints: 5,
      starInnerRadius: 0.4,
      cornerRadius: 0,
      cornerRadii: [10, 2, 8, 0, 6, 0, 4, 0, 2, 0],
    });
    assert.ok(uniform.includes(" A "));
    assert.ok(mixed.includes(" A "));
    assert.notEqual(uniform, mixed);
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
    const arcs = [...d.matchAll(/A\s+([\d.]+)\s+([\d.]+)\s+0\s+0\s+[01]\s+([\d.]+)\s+([\d.]+)/g)];
    assert.ok(arcs.length > 0, "expected circular fillets");
    const trim = r / Math.tan(Math.PI / 6);
    const topArc = arcs.find((m) => {
      const endX = Number(m[3]);
      const endY = Number(m[4]);
      return endX > 50 && endY > 0 && endY < trim + 2;
    });
    assert.ok(topArc, "expected fillet at top vertex");
    const endY = Number(topArc![4]);
    assert.ok(endY > 0, "top corner curve should trim into the triangle");
    assert.ok(endY < trim + 2, "top corner curve should not bulge above the vertex");
  });

  it("maxStarCornerRadius is positive for default star", () => {
    const max = maxStarCornerRadius(5, 0.4, 100, 100);
    assert.ok(max > 5);
  });
});
