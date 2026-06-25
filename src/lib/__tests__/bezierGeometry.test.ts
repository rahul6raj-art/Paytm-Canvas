import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { penPreviewPathD } from "@/lib/penTool/bezier";
import { buildCornerPathPoint, buildSmoothPathPointFromDrag } from "@/lib/penTool/bezierGeometry";
import { pathToSvgD, type PathPoint } from "@/lib/pathGeometry";
import { cubicPathD } from "@/lib/vector/bezierGeometry";

describe("shared bezier path rendering", () => {
  it("pathToSvgD delegates to cubicPathD", () => {
    const points: PathPoint[] = [
      { id: "a", x: 0, y: 0, handleOut: { x: 10, y: 0 } },
      { id: "b", x: 20, y: 0, handleIn: { x: -10, y: 0 } },
    ];
    assert.equal(pathToSvgD(points, false), cubicPathD(points, false));
  });

  it("pen preview SVG path equals final rendered SVG path for open cubic paths", () => {
    const points = [
      { x: 0, y: 0, handleOut: { x: 15, y: 0 } },
      { x: 40, y: 0, handleIn: { x: -15, y: 0 }, handleOut: { x: 15, y: 0 } },
      { x: 80, y: 20, handleIn: { x: -15, y: 0 } },
    ];
    const rendered = pathToSvgD(points as PathPoint[], false);
    const preview = penPreviewPathD(points);
    assert.equal(preview, rendered);
    assert.match(rendered, /^M 0 0 C 15 0, 25 0, 40 0 C 55 0, 65 20, 80 20$/);
  });

  it("closed cubic paths include the closing segment before Z", () => {
    const points: PathPoint[] = [
      { id: "a", x: 0, y: 0, handleOut: { x: 10, y: 0 } },
      { id: "b", x: 20, y: 0, handleIn: { x: -10, y: 0 }, handleOut: { x: 0, y: 10 } },
      { id: "c", x: 20, y: 20, handleIn: { x: 0, y: -10 }, handleOut: { x: -10, y: 0 } },
      { id: "d", x: 0, y: 20, handleIn: { x: 10, y: 0 }, handleOut: { x: -10, y: 0 } },
    ];
    const rendered = pathToSvgD(points, true);
    assert.equal(rendered, cubicPathD(points, true));
    assert.match(rendered, /C -10 20, 0 0, 0 0 Z$/);
  });

  it("corner-only paths render as straight line segments", () => {
    const points: PathPoint[] = [
      buildCornerPathPoint(0, 0),
      buildCornerPathPoint(20, 0),
      buildCornerPathPoint(20, 20),
    ];
    const rendered = pathToSvgD(points, false);
    assert.equal(rendered, "M 0 0 L 20 0 L 20 20");
    assert.equal(penPreviewPathD(points), rendered);
  });

  it("legacy points without pointType still render safely", () => {
    const legacy: PathPoint[] = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 30, y: 0, handleIn: { x: -10, y: 0 } },
      { id: "c", x: 30, y: 30 },
    ];
    const rendered = pathToSvgD(legacy, false);
    assert.equal(rendered, cubicPathD(legacy, false));
    assert.equal(rendered, "M 0 0 C 0 0, 20 0, 30 0 L 30 30");
    assert.equal(penPreviewPathD(legacy), rendered);
  });

  it("pen click-drag commit geometry matches rendered path", () => {
    const prev = buildCornerPathPoint(0, 0);
    const { prevPatch, newPoint } = buildSmoothPathPointFromDrag(
      prev,
      { x: 100, y: 0 },
      { x: 200, y: 0 },
    );
    const committed: PathPoint[] = [{ ...prev, ...prevPatch }, newPoint];
    const rendered = pathToSvgD(committed, false);
    const preview = penPreviewPathD(committed);
    assert.equal(preview, rendered);
    assert.match(rendered, /^M 0 0 C 60 0, 40 0, 100 0$/);
  });
});
