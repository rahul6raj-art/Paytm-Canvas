import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FigNode } from "openfig-core";
import { placementFromFigNode } from "@/lib/figImport/figNodeGeometry";

describe("figNodeGeometry", () => {
  it("applies scale from transform matrix to width and height", () => {
    const node = {
      size: { x: 100, y: 50 },
      transform: { m00: 2, m01: 0, m02: 10, m10: 0, m11: 1.5, m12: 20 },
    } as FigNode;
    const p = placementFromFigNode(node);
    assert.equal(p.x, 10);
    assert.equal(p.y, 20);
    assert.equal(p.width, 200);
    assert.equal(p.height, 75);
  });

  it("extracts rotation from transform", () => {
    const node = {
      size: { x: 40, y: 40 },
      transform: { m00: 0, m01: 0, m02: 0, m10: 1, m11: 0, m12: 0 },
    } as FigNode;
    const p = placementFromFigNode(node);
    assert.ok(Math.abs(p.rotation - 90) < 0.1);
  });
});
