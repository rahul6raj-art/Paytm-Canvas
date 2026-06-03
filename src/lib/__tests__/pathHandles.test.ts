import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyHandleMirroring } from "@/lib/pathHandles";

describe("pathHandles", () => {
  it("mirrors angle and length symmetrically", () => {
    const r = applyHandleMirroring("angle-length", { x: 10, y: 0 }, "out");
    assert.equal(r.handleOut?.x, 10);
    assert.equal(r.handleOut?.y, 0);
    assert.equal(r.handleIn?.x, -10);
    assert.equal(r.handleIn?.y, 0);
  });

  it("keeps independent handles when mirroring is none", () => {
    const r = applyHandleMirroring("none", { x: 5, y: 3 }, "in");
    assert.deepEqual(r.handleIn, { x: 5, y: 3 });
    assert.equal(r.handleOut, undefined);
  });
});
