import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldSampleFreehandPoint, simplifyPolyline } from "../freehandPath";

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
});
