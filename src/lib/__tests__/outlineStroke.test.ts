import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  canOutlineStroke,
  convertStrokeToVector,
  createCapGeometry,
  expandClosedContourStroke,
  expandOpenPolylineStroke,
  generateStrokeGeometry,
  outlineStroke,
} from "@/lib/outlineStroke";

function baseNode(partial: Partial<EditorNode> & Pick<EditorNode, "type">): EditorNode {
  return {
    id: "n1",
    parentId: null,
    name: "Shape",
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    fillEnabled: true,
    strokeColor: "#ff0000",
    strokeWidth: 4,
    strokeEnabled: true,
    strokePosition: "center",
    strokeLinejoin: "miter",
    strokeLinecap: "butt",
    ...partial,
  };
}

describe("outlineStroke", () => {
  it("outlines a horizontal line with round caps", () => {
    const node = baseNode({
      type: "line",
      width: 120,
      height: 4,
      lineX1: 0,
      lineY1: 2,
      lineX2: 120,
      lineY2: 2,
      strokeLinecap: "round",
    });
    const result = outlineStroke(node);
    assert.ok(result);
    assert.ok(result.pathPoints.length >= 4);
    assert.equal(result.fill, "#ff0000");
    assert.equal(result.pathClosed, true);
  });

  it("outlines a rectangle as a stroke ring (evenodd)", () => {
    const node = baseNode({ type: "rectangle", cornerRadius: 0 });
    const result = outlineStroke(node);
    assert.ok(result);
    assert.equal(result.fillRule, "evenodd");
    assert.ok(result.pathD.includes("Z"));
    const converted = convertStrokeToVector(node);
    assert.ok(converted);
    assert.equal(converted.type, "path");
    assert.equal(converted.strokeWidth, 0);
    assert.equal(converted.strokeEnabled, false);
    assert.equal(converted.fill, "#ff0000");
    assert.equal(converted.pathFillRule, "evenodd");
  });

  it("outlines a rounded rectangle", () => {
    const node = baseNode({ type: "rectangle", cornerRadius: 12 });
    const result = outlineStroke(node);
    assert.ok(result);
    assert.ok(result.pathPoints.length >= 8);
  });

  it("outlines an ellipse", () => {
    const node = baseNode({ type: "ellipse" });
    const result = outlineStroke(node);
    assert.ok(result);
    assert.equal(result.fillRule, "evenodd");
  });

  it("outlines a polygon", () => {
    const node = baseNode({ type: "polygon", polygonSides: 6 });
    const result = outlineStroke(node);
    assert.ok(result);
    assert.ok(result.pathPoints.length >= 6);
  });

  it("outlines a star path", () => {
    const node = baseNode({
      type: "path",
      starPoints: 5,
      starInnerRadius: 0.4,
      pathPoints: [],
      pathClosed: true,
    });
    const result = outlineStroke(node);
    assert.ok(result);
  });

  it("outlines an arrow shaft (Figma removes arrowhead on outline)", () => {
    const node = baseNode({
      type: "arrow",
      width: 140,
      height: 20,
      lineX1: 0,
      lineY1: 10,
      lineX2: 140,
      lineY2: 10,
      endArrow: "triangle",
    });
    const result = outlineStroke(node);
    assert.ok(result);
    assert.ok(result.pathD.length > 0);
  });

  it("allows gradient strokes and preserves gradient fill", () => {
    const node = baseNode({
      type: "rectangle",
      strokeType: "gradient",
      strokeGradient: {
        kind: "linear",
        stops: [{ id: "s1", color: "#ff0000", position: 0 }],
        transform: { cx: 0.5, cy: 0.5, width: 1, height: 1, rotation: 0 },
      },
    });
    assert.equal(canOutlineStroke(node), true);
    const converted = convertStrokeToVector(node);
    assert.ok(converted);
    assert.equal(converted.fillType, "gradient");
    assert.ok(converted.fillGradient);
  });

  it("outlines per-side rectangle strokes", () => {
    const node = baseNode({
      type: "rectangle",
      strokeSides: "top",
      strokeWidth: 6,
    });
    assert.equal(canOutlineStroke(node), true);
    const result = outlineStroke(node);
    assert.ok(result);
    assert.ok(result.pathD.includes("Z"));
  });

  it("outlines dashed line strokes into separate dash geometry", () => {
    const node = baseNode({
      type: "line",
      width: 120,
      height: 4,
      lineX1: 0,
      lineY1: 2,
      lineX2: 120,
      lineY2: 2,
      strokeStyle: "dashed",
      strokeDashLength: 8,
      strokeDashGap: 4,
    });
    const result = outlineStroke(node);
    assert.ok(result);
    assert.ok(result.pathD.split("Z").length >= 2);
  });

  it("allows text layers with visible stroke", () => {
    const node = baseNode({ type: "text", content: "Hello", strokeWidth: 2 });
    assert.equal(canOutlineStroke(node), true);
  });

  it("supports miter, round, and bevel joins on closed contours", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    for (const join of ["miter", "round", "bevel"] as const) {
      const band = expandClosedContourStroke(square, {
        width: 10,
        align: "center",
        join,
        cap: "butt",
      });
      assert.ok(band);
      assert.ok(band.outer.length >= 4);
      assert.ok(band.inner.length >= 4);
    }
  });

  it("supports butt, round, and square caps on open paths", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    for (const cap of ["butt", "round", "square"] as const) {
      const poly = expandOpenPolylineStroke(line, {
        width: 8,
        align: "center",
        join: "miter",
        cap,
      });
      assert.ok(poly.length >= 4);
    }
  });

  it("createCapGeometry returns square extension points", () => {
    const caps = createCapGeometry(
      { x: 100, y: 0 },
      { x: 1, y: 0 },
      4,
      "square",
      { x: 100, y: 4 },
      { x: 100, y: -4 },
      false,
    );
    assert.equal(caps.length, 2);
  });

  it("generateStrokeGeometry handles outside-aligned closed stroke", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ];
    const result = generateStrokeGeometry(square, true, {
      width: 6,
      align: "outside",
      join: "miter",
      cap: "butt",
    });
    assert.ok(result);
    assert.equal(result.fillRule, "evenodd");
  });
});
