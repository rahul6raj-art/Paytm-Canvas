import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToSvgD } from "../pathGeometry";
import { shouldSampleFreehandPoint, simplifyPolyline, smoothPolylineToPathPoints } from "../freehandPath";

describe("freehandPath", () => {
  it("samples when movement exceeds zoom-scaled spacing", () => {
    assert.equal(shouldSampleFreehandPoint(0, 0, 0.5, 0, 1), false);
    assert.equal(shouldSampleFreehandPoint(0, 0, 5, 0, 1), true);
  });

  it("simplifies collinear points to endpoints", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ];
    const out = simplifyPolyline(pts, 1);
    assert.equal(out.length, 2);
    assert.deepEqual(out[0], { x: 0, y: 0 });
    assert.deepEqual(out[1], { x: 30, y: 0 });
  });

  it("smooths polylines into cubic bezier path points", () => {
    const arc: { x: number; y: number }[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * Math.PI;
      arc.push({ x: Math.cos(t) * 100, y: Math.sin(t) * 100 });
    }
    const smoothed = smoothPolylineToPathPoints(arc, false, () => "pt-test");
    assert.ok(smoothed.length >= 3);
    assert.ok(smoothed.some((p) => p.handleIn || p.handleOut));
    const d = pathToSvgD(smoothed, false);
    assert.match(d, / C /);
  });
});
