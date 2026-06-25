import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  canOutlineStroke,
  convertStrokeToVector,
  createCapGeometry,
  expandClosedContourStroke,
  expandOpenPolylineStroke,
  filledStrokeOutlineFromPathD,
  generateStrokeGeometry,
  outlineStroke,
} from "@/lib/outlineStroke";
import { resolvePathOutlineD } from "@/lib/shapes/shapeToPath";

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
    assert.ok(
      result.pathD.includes(" A ") || result.pathD.includes(" C "),
      `expected smooth arc/cubic commands, got: ${result.pathD.slice(0, 120)}`,
    );
    assert.equal((result.pathD.match(/ L /g) || []).length, 0);
  });

  it("outlines a rounded rectangle with inside stroke using smooth arcs", () => {
    const node = baseNode({
      type: "rectangle",
      width: 200,
      height: 150,
      cornerRadius: 80,
      strokeWidth: 40,
      strokePosition: "inside",
    });
    const result = outlineStroke(node);
    assert.ok(result);
    assert.equal(result.fillRule, "evenodd");
    assert.ok(
      (result.pathD.match(/ A /g) || []).length >= 8 ||
        (result.pathD.match(/ C /g) || []).length >= 8,
      result.pathD.slice(0, 200),
    );
    assert.equal((result.pathD.match(/ L /g) || []).length, 0);
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

  it("outlines edited path geometry with corner fillets (matches fill outline)", () => {
    const pathPoints = [
      { id: "a", x: 60, y: 0 },
      { id: "b", x: 120, y: 50 },
      { id: "c", x: 60, y: 100 },
      { id: "d", x: 0, y: 50 },
    ];
    const sharp = baseNode({
      type: "path",
      width: 120,
      height: 100,
      pathClosed: true,
      cornerRadius: 0,
      pathPoints,
    });
    const rounded = baseNode({
      ...sharp,
      cornerRadius: 16,
    });
    const sharpOutline = outlineStroke(sharp);
    const roundedOutline = outlineStroke(rounded);
    assert.ok(sharpOutline);
    assert.ok(roundedOutline);
    assert.notEqual(
      sharpOutline!.pathD,
      roundedOutline!.pathD,
      "gradient stroke outline should follow filleted path geometry, not sharp anchors",
    );
  });

  it("outlines edited path with large corner fillets for gradient stroke ring", () => {
    const pathPoints = [
      { id: "a", x: 911, y: 0 },
      { id: "b", x: 1823, y: 500 },
      { id: "c", x: 1400, y: 1367 },
      { id: "d", x: 400, y: 1200 },
      { id: "e", x: 0, y: 400 },
    ];
    const node = baseNode({
      type: "path",
      width: 1823,
      height: 1367,
      pathClosed: true,
      pathPoints,
      cornerRadius: 237,
      strokeWidth: 42,
    });
    const sharp = outlineStroke({ ...node, cornerRadius: 0 });
    const rounded = outlineStroke(node);
    assert.ok(sharp?.pathD);
    assert.ok(rounded?.pathD);
    assert.notEqual(sharp!.pathD, rounded!.pathD);
    assert.ok(
      (rounded!.pathD.match(/ M /g) || []).length <= 2,
      "gradient stroke ring should be one compound path, not per-vertex blobs",
    );
  });

  it("filledStrokeOutlineFromPathD follows the same path as fill for edited shapes", () => {
    const pathPoints = [
      { id: "a", x: 953, y: 0 },
      { id: "b", x: 1906, y: 554 },
      { id: "c", x: 1500, y: 1108 },
      { id: "d", x: 450, y: 980 },
      { id: "e", x: 0, y: 420 },
    ];
    const node = baseNode({
      type: "path",
      width: 1906,
      height: 1108,
      pathClosed: true,
      pathPoints,
      cornerRadius: 201,
      strokeWidth: 56,
    });
    const fillD = resolvePathOutlineD(node);
    const fromFillPath = filledStrokeOutlineFromPathD(node, fillD, true);
    assert.ok(fromFillPath?.pathD);
    assert.equal(fromFillPath!.fillRule, "evenodd");
    assert.ok(
      (fromFillPath!.pathD.match(/ M /g) || []).length <= 2,
      "stroke ring should be a single compound path",
    );
  });

  it("filledStrokeOutlineFromPathD works for parametric star paths", () => {
    const node = baseNode({
      type: "path",
      width: 200,
      height: 200,
      starPoints: 5,
      starInnerRadius: 0.4,
      pathPoints: [],
      pathClosed: true,
      strokeWidth: 12,
    });
    const fillD = resolvePathOutlineD(node);
    const outlined = filledStrokeOutlineFromPathD(node, fillD, true);
    assert.ok(outlined?.pathD);
    assert.ok(outlined!.pathD.length > fillD.length);
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
        stops: [
          { id: "s1", color: "#ff0000", position: 0 },
          { id: "s2", color: "#0000ff", position: 100 },
        ],
        transform: { cx: 0.5, cy: 0.5, width: 1, height: 1, rotation: 0 },
        handles: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
          { x: 1, y: 0 },
        ],
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

  it("allows text layers with visible fill for outline", () => {
    const node = baseNode({
      type: "text",
      content: "Hello",
      strokeWidth: 0,
      strokeEnabled: false,
    });
    assert.equal(canOutlineStroke(node), true);
  });

  it("outlines open freehand paths and respects stroke position", () => {
    const node = baseNode({
      type: "path",
      width: 180,
      height: 80,
      pathPoints: [
        { id: "a", x: 0, y: 40 },
        { id: "b", x: 90, y: 10 },
        { id: "c", x: 180, y: 60 },
      ],
      pathClosed: false,
      fillEnabled: false,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    });
    const center = outlineStroke(node);
    const inside = outlineStroke({ ...node, strokePosition: "inside" });
    const outside = outlineStroke({ ...node, strokePosition: "outside" });
    assert.ok(center?.pathD);
    assert.ok(inside?.pathD);
    assert.ok(outside?.pathD);
    assert.notEqual(inside!.pathD, outside!.pathD);
    const converted = convertStrokeToVector(node);
    assert.ok(converted);
    assert.equal(converted.pathClosed, true);
    assert.equal(converted.strokeEnabled, false);
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
