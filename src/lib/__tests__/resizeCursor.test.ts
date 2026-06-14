import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resizeCursorForRotatedHandle } from "@/lib/transformMath";

describe("resizeCursorForRotatedHandle", () => {
  it("uses axis-aligned cursors at 0° rotation", () => {
    assert.equal(resizeCursorForRotatedHandle("e", 0), "ew-resize");
    assert.equal(resizeCursorForRotatedHandle("w", 0), "ew-resize");
    assert.equal(resizeCursorForRotatedHandle("n", 0), "ns-resize");
    assert.equal(resizeCursorForRotatedHandle("s", 0), "ns-resize");
    assert.equal(resizeCursorForRotatedHandle("nw", 0), "nwse-resize");
    assert.equal(resizeCursorForRotatedHandle("se", 0), "nwse-resize");
    assert.equal(resizeCursorForRotatedHandle("ne", 0), "nesw-resize");
    assert.equal(resizeCursorForRotatedHandle("sw", 0), "nesw-resize");
  });

  it("rotates edge cursors with selection", () => {
    assert.equal(resizeCursorForRotatedHandle("e", 45), "nwse-resize");
    assert.equal(resizeCursorForRotatedHandle("n", 45), "nesw-resize");
  });
});
