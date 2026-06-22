import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampPolygonSides,
  clampPolygonCornerRadius,
  isPolygonNode,
  maxPolygonCornerRadius,
  polygonGeometryPatch,
  polygonPathD,
  polygonPathDForNode,
  polygonVertices,
  pointInPolygon,
} from "@/lib/shapes/polygonGeometry";

describe("polygonGeometry", () => {
  it("clamps sides to 3–100", () => {
    assert.equal(clampPolygonSides(2), 3);
    assert.equal(clampPolygonSides(150), 100);
    assert.equal(clampPolygonSides(5.4), 5);
  });

  it("triangle has 3 vertices with top vertex and base on box bottom", () => {
    const v = polygonVertices(3, 100, 100);
    assert.equal(v.length, 3);
    assert.ok(Math.abs(v[0]!.x - 50) < 1e-6);
    assert.ok(Math.abs(v[0]!.y) < 1e-6);
    assert.ok(Math.abs(v[1]!.x - 100) < 1e-6);
    assert.ok(Math.abs(v[1]!.y - 100) < 1e-6);
    assert.ok(Math.abs(v[2]!.x) < 1e-6);
    assert.ok(Math.abs(v[2]!.y - 100) < 1e-6);
  });

  it("triangle fills non-square bounding box like Figma", () => {
    const v = polygonVertices(3, 669, 598);
    assert.ok(Math.abs(v[0]!.y) < 1e-6);
    assert.ok(Math.abs(v[1]!.y - 598) < 1e-6);
    assert.ok(Math.abs(v[2]!.y - 598) < 1e-6);
    assert.ok(Math.abs(v[1]!.x - 669) < 1e-6);
    assert.ok(Math.abs(v[2]!.x) < 1e-6);
  });

  it("hexagon has 6 vertices", () => {
    assert.equal(polygonVertices(6, 80, 60).length, 6);
  });

  it("polygonPathD uses circular fillets when corner radius > 0", () => {
    const sharp = polygonPathD(100, 100, 6, 0);
    const round = polygonPathD(100, 100, 6, 12);
    assert.ok(sharp.includes("L "));
    assert.ok(!sharp.includes(" A "));
    assert.ok(round.includes(" A "));
    assert.ok(round.endsWith(" Z"));
  });

  it("triangle corner radius rounds inward toward center", () => {
    const d = polygonPathD(100, 100, 3, 10);
    const top = polygonVertices(3, 100, 100)[0]!;
    const arcMatch = /A\s+([\d.]+)\s+([\d.]+)\s+0\s+0\s+[01]\s+([\d.]+)\s+([\d.]+)/.exec(d);
    assert.ok(arcMatch, "expected inward circular fillet on triangle");
    const endX = Number(arcMatch[3]);
    const endY = Number(arcMatch[4]);
    assert.ok(endX > top.x, "first curve should move down-right from the top spike");
    assert.ok(endY > top.y, "fillet should stay inside the shape, not above the tip");
  });

  it("corner radius is clamped to feasible max", () => {
    const max = maxPolygonCornerRadius(3, 100, 100);
    assert.ok(max > 0);
    assert.equal(clampPolygonCornerRadius(3, 100, 100, max + 50), max);
  });

  it("polygonPathDForNode supports per-vertex corner radii", () => {
    const uniform = polygonPathDForNode({
      width: 100,
      height: 100,
      polygonSides: 3,
      cornerRadius: 8,
    });
    const mixed = polygonPathDForNode({
      width: 100,
      height: 100,
      polygonSides: 3,
      cornerRadius: 0,
      cornerRadii: [12, 4, 0],
    });
    assert.ok(uniform.includes(" A "));
    assert.ok(mixed.includes(" A "));
    assert.notEqual(uniform, mixed);
  });

  it("polygonGeometryPatch resizes cornerRadii when sides change", () => {
    const patch = polygonGeometryPatch(
      { width: 80, height: 80, polygonSides: 3, cornerRadius: 0, cornerRadii: [10, 5, 2] },
      { polygonSides: 4 },
    );
    assert.equal(patch.polygonSides, 4);
    assert.deepEqual(patch.cornerRadii, [10, 5, 2, 10]);
  });

  it("polygonGeometryPatch syncs metadata and anchors", () => {
    const patch = polygonGeometryPatch(
      { width: 80, height: 80, polygonSides: 6, cornerRadius: 0 },
      { polygonSides: 3, cornerRadius: 8 },
    );
    assert.equal(patch.polygonSides, 3);
    assert.equal(patch.pathPoints?.length, 3);
    assert.ok((patch.cornerRadius ?? 0) > 0);
  });

  it("isPolygonNode recognizes polygon kind and legacy path", () => {
    assert.ok(isPolygonNode({ type: "polygon", polygonSides: 6, starPoints: undefined }));
    assert.ok(
      isPolygonNode({ type: "path", polygonSides: 5, starPoints: undefined }),
    );
    assert.ok(!isPolygonNode({ type: "path", polygonSides: 5, starPoints: 4 }));
    assert.ok(!isPolygonNode({ type: "rectangle", polygonSides: undefined, starPoints: undefined }));
  });

  it("pointInPolygon detects interior", () => {
    const v = polygonVertices(4, 100, 100);
    assert.ok(pointInPolygon(50, 50, v));
    assert.ok(!pointInPolygon(-10, 50, v));
  });
});
