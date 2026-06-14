import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  constrainLineEndpointTo45Degrees,
  createShapeNode,
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

describe("createShapeNode live drag", () => {
  it("starts rectangle at 0×0 on pointer down", () => {
    const node = createShapeNode(
      "rectangle",
      { x: 50, y: 60 },
      { x: 50, y: 60 },
      { shiftKey: false, altKey: false },
      undefined,
      "live",
    );
    assert.equal(node.x, 50);
    assert.equal(node.y, 60);
    assert.equal(node.width, 0);
    assert.equal(node.height, 0);
  });

  it("grows rectangle with drag during live phase", () => {
    const node = createShapeNode(
      "rectangle",
      { x: 10, y: 20 },
      { x: 35, y: 45 },
      { shiftKey: false, altKey: false },
      undefined,
      "live",
    );
    assert.equal(node.width, 25);
    assert.equal(node.height, 25);
  });

  it("ellipse Option-from-center tracks horizontal drag without spurious vertical growth", () => {
    const node = createShapeNode(
      "ellipse",
      { x: 100, y: 100 },
      { x: 160, y: 100 },
      { shiftKey: false, altKey: true },
      undefined,
      "live",
    );
    assert.equal(node.width, 120);
    assert.equal(node.height, 120);
    assert.equal(node.x, 40);
    assert.equal(node.y, 40);
  });

  it("allows zero width or height independently during live phase", () => {
    const horizontal = createShapeNode(
      "rectangle",
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { shiftKey: false, altKey: false },
      undefined,
      "live",
    );
    assert.equal(horizontal.width, 40);
    assert.equal(horizontal.height, 0);

    const vertical = createShapeNode(
      "rectangle",
      { x: 0, y: 0 },
      { x: 0, y: 30 },
      { shiftKey: false, altKey: false },
      undefined,
      "live",
    );
    assert.equal(vertical.width, 0);
    assert.equal(vertical.height, 30);
  });
});
