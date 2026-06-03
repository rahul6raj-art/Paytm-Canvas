import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  constrainLineEndpointTo45Degrees,
  lineGeometryFromDrag,
  resolveLineEndpoints,
} from "../shapes/shapeCreation";

describe("lineGeometryFromDrag", () => {
  it("snaps to 45° with Shift", () => {
    const end = constrainLineEndpointTo45Degrees({ x: 0, y: 0 }, { x: 100, y: 95 });
    const len = Math.hypot(100, 95);
    const c = len * Math.cos(Math.PI / 4);
    assert.ok(Math.abs(end.x - c) < 1);
    assert.ok(Math.abs(end.y - c) < 1);
  });

  it("mirrors endpoints from center with Alt/Option", () => {
    const { start, end } = resolveLineEndpoints(
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { shiftKey: false, altKey: true },
    );
    assert.equal(start.x, 0);
    assert.equal(end.x, 200);
    assert.equal(start.y, 100);
    assert.equal(end.y, 100);
  });

  it("builds geometry from resolved endpoints", () => {
    const g = lineGeometryFromDrag(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { shiftKey: false, altKey: true },
    );
    assert.equal(g.x, -100);
    assert.equal(g.width, 200);
    assert.equal(g.rotation, 0);
  });
});
