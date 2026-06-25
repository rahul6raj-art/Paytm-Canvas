import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  distancePointToLineSegment,
  layoutFromLineEndpoints,
  lineAngleDegrees,
  lineEndpointsFromLayout,
  lineEndpointsPatchFromBoxResize,
  lineLength,
  linePatchFromEndpoints,
  lineStrokeWorldBounds,
} from "@/lib/shapes/lineGeometry";
import type { EditorNode } from "@/stores/useEditorStore";

describe("lineGeometry", () => {
  it("distancePointToLineSegment measures perpendicular distance", () => {
    const d = distancePointToLineSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    assert.ok(Math.abs(d - 5) < 1e-6);
  });

  it("layoutFromLineEndpoints stores parent-local endpoints with zero frame height", () => {
    const layout = layoutFromLineEndpoints(0, 0, 100, 0, 2);
    assert.equal(layout.lineX1, 0);
    assert.equal(layout.lineY1, 0);
    assert.equal(layout.lineX2, 100);
    assert.equal(layout.lineY2, 0);
    assert.equal(layout.width, 100);
    assert.equal(layout.height, 0);
    assert.equal(layout.rotation, 0);
  });

  it("lineEndpointsFromLayout round-trips horizontal line", () => {
    const node: Pick<EditorNode, "x" | "y" | "width" | "height" | "rotation"> = {
      x: 0,
      y: 0,
      width: 50,
      height: 0,
      rotation: 0,
    };
    const ep = lineEndpointsFromLayout(node);
    assert.ok(Math.abs(ep.x1) < 1e-6);
    assert.ok(Math.abs(ep.y1) < 1e-6);
    assert.ok(Math.abs(ep.x2 - 50) < 1e-6);
    assert.ok(Math.abs(ep.y2) < 1e-6);
  });

  it("lineLength and lineAngleDegrees", () => {
    const ep = { x1: 0, y1: 0, x2: 100, y2: 100 };
    assert.ok(Math.abs(lineLength(ep) - 100 * Math.SQRT2) < 1e-3);
    assert.equal(lineAngleDegrees(ep), 45);
  });

  it("linePatchFromEndpoints updates box from endpoints", () => {
    const patch = linePatchFromEndpoints(0, 0, 0, 80, { strokeWidth: 4 });
    assert.equal(patch.lineY2, 80);
    assert.ok(patch.width >= 80);
  });

  it("lineStrokeWorldBounds matches stroke thickness for a horizontal line", () => {
    const bounds = lineStrokeWorldBounds({ x1: 0, y1: 10, x2: 100, y2: 10 }, 2);
    assert.equal(bounds.x, -1);
    assert.equal(bounds.y, 9);
    assert.equal(bounds.width, 102);
    assert.equal(bounds.height, 2);
  });

  it("lineEndpointsPatchFromBoxResize preserves diagonal endpoints on width shrink", () => {
    const layout = layoutFromLineEndpoints(0, 0, 100, 100, 2);
    const before = { ...layout, lineX1: 0, lineY1: 0, lineX2: 100, lineY2: 100 };
    const after = { ...before, width: before.width * 0.5 };
    const ep = lineEndpointsPatchFromBoxResize(before, after);
    assert.ok(Math.abs(ep.lineX2! - ep.lineX1! - 50) < 1);
    assert.ok(Math.abs(ep.lineY2! - ep.lineY1! - 50) < 1);
  });
});
