import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { taperWeightAlongPath } from "@/lib/taperedStrokePath";

describe("taperWeightAlongPath", () => {
  it("is zero at both ends and peaks at center (symmetric)", () => {
    assert.ok(taperWeightAlongPath(0, "symmetric") < 1e-10);
    assert.ok(taperWeightAlongPath(1, "symmetric") < 1e-10);
    assert.ok(taperWeightAlongPath(0.5, "symmetric") > 0.99);
  });

  it("start profile is full at t=0 and thin at t=1", () => {
    assert.ok(taperWeightAlongPath(0, "start") > 0.99);
    assert.ok(taperWeightAlongPath(1, "start") < 1e-10);
  });

  it("end profile is thin at t=0 and full at t=1", () => {
    assert.ok(taperWeightAlongPath(0, "end") < 1e-10);
    assert.ok(taperWeightAlongPath(1, "end") > 0.99);
  });

  it("uniform profile is constant", () => {
    assert.equal(taperWeightAlongPath(0, "uniform"), 1);
    assert.equal(taperWeightAlongPath(0.5, "uniform"), 1);
  });
});
