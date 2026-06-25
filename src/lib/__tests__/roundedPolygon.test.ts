import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildRoundedPolygonPathSvgD,
  maxUniformFilletRadius,
  percentToCornerRadius,
  resolveRoundedPolygonCorners,
} from "@/lib/geometry/roundedPolygon";
import { circularFilletArcSweep } from "@/lib/geometry/roundedCornerUtils";
import { polygonVertices } from "@/lib/shapes/polygonGeometry";

describe("roundedPolygon", () => {
  it("max uniform fillet uses edge-coupled constraints", () => {
    const verts = polygonVertices(3, 100, 100);
    const maxR = maxUniformFilletRadius(verts);
    assert.ok(maxR > 0);
    assert.ok(maxR < Math.min(100, 100) / 2);
  });

  it("triangle corner fillets use convex exterior arcs (not inward notches)", () => {
    const verts = polygonVertices(3, 100, 100);
    const corners = resolveRoundedPolygonCorners(verts, { radiusPercent: 0.5 });
    const top = corners[0]!;
    assert.equal(circularFilletArcSweep(verts[2]!, verts[0]!, verts[1]!), 1);
    assert.ok(top.curveD.includes(" 0 1 "), top.curveD);
    assert.ok(top.start.y > top.vertex.y);
    assert.ok(top.end.y > top.vertex.y);
  });

  it("radiusPercent 1 on triangle produces equal circular arcs (circle-like)", () => {
    const verts = polygonVertices(3, 100, 100);
    const maxR = maxUniformFilletRadius(verts);
    const d = buildRoundedPolygonPathSvgD(verts, { radiusPercent: 1 });
    const arcRadii = [...d.matchAll(/A\s+([\d.]+)\s+([\d.]+)/g)].map((m) => Number(m[1]));
    assert.equal(arcRadii.length, 3);
    for (const r of arcRadii) {
      assert.ok(Math.abs(r - maxR) < 0.5, `expected arc radius ~${maxR}, got ${r}`);
    }
    assert.ok(!d.includes(" Q "));
    assert.ok(d.endsWith(" Z"));
  });

  it("percentToCornerRadius matches radiusPercent API", () => {
    const verts = polygonVertices(6, 120, 120);
    const maxR = maxUniformFilletRadius(verts);
    assert.ok(Math.abs(percentToCornerRadius(verts, 0.5) - maxR * 0.5) < 1e-6);
  });

  it("corner smoothing emits cubic corner transitions", () => {
    const verts = polygonVertices(4, 100, 100);
    const d = buildRoundedPolygonPathSvgD(verts, {
      radiusPercent: 0.4,
      cornerSmoothing: 0.6,
    });
    assert.ok(d.includes(" C "));
    assert.ok(d.endsWith(" Z"));
    const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
    assert.ok(Math.min(...nums) >= -1, "smoothed square stays near bounds");
    assert.ok(Math.max(...nums) <= 101, "smoothed square stays near bounds");
  });

  it("hexagon at max radius stays closed without degenerate segments", () => {
    const verts = polygonVertices(6, 200, 200);
    const d = buildRoundedPolygonPathSvgD(verts, { radiusPercent: 1 });
    assert.ok(d.endsWith(" Z"));
    assert.ok(!d.includes("NaN"));
    assert.ok(!d.includes("Infinity"));
  });
});
