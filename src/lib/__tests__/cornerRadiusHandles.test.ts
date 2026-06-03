import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { supportsCornerRadiusHandles } from "@/lib/cornerRadius";
import { cornerRadiusHandlePosition } from "@/lib/shapes/shapeToPath";

describe("corner radius handles", () => {
  it("supports rectangle and frame only", () => {
    assert.equal(supportsCornerRadiusHandles({ type: "rectangle", visible: true, locked: false }), true);
    assert.equal(supportsCornerRadiusHandles({ type: "frame", visible: true, locked: false }), true);
    assert.equal(supportsCornerRadiusHandles({ type: "ellipse", visible: true, locked: false }), false);
  });

  it("handle sits on top-left arc start when radius is set", () => {
    const p = cornerRadiusHandlePosition(100, 100, [20, 0, 0, 0], 0);
    assert.equal(p.x, 20);
    assert.equal(p.y, 0);
  });
});
