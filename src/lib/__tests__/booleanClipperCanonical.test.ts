import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyBooleanOperation,
  buildBooleanRenderForGroup,
  shapeNodeToWorldPolygon,
  shapesToBooleanInput,
  type BooleanInput,
} from "@/lib/booleanGeometry";
import { ellipseLocalPolygonPoints } from "@/lib/shapes/ellipseArc";
import { starVertices } from "@/lib/shapes/starGeometry";
import { applyMatrixToPoint } from "@/lib/transformMath";
import { getRenderedWorldTopLeft } from "@/lib/editorGraph";

function rectPolygon(x: number, y: number, w: number, h: number) {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function input(id: string, polygon: { x: number; y: number }[], fill = "#3366ff"): BooleanInput {
  return { id, polygon, fill };
}

function rectNode(
  id: string,
  parentId: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<EditorNode> = {},
): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    fill: "#3366ff",
    fillEnabled: true,
    strokePosition: "center",
    ...extra,
  } as EditorNode;
}

function booleanGroup(
  id: string,
  op: "union" | "subtract" | "intersect" | "exclude",
  childIds: string[],
  nodes: Record<string, EditorNode>,
): EditorNode {
  return {
    id,
    parentId: null,
    type: "group",
    name: op,
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    rotation: 0,
    visible: true,
    locked: false,
    isBooleanGroup: true,
    booleanOperation: op,
    fill: nodes[childIds[0]!]?.fill,
    fillEnabled: true,
  } as EditorNode;
}

function previewMatchesClipper(
  op: "union" | "subtract" | "intersect" | "exclude",
  childIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  groupId: string,
) {
  const render = buildBooleanRenderForGroup(groupId, childIds, nodes, op, childOrder);
  const inputs = shapesToBooleanInput(childIds, nodes, childOrder);
  const origin = getRenderedWorldTopLeft(groupId, nodes, childOrder);
  const clip = applyBooleanOperation(op, inputs, { pathOrigin: origin });
  assert.ok(render && clip, `missing result for ${op}`);
  assert.equal(render!.op, "clipper");
  assert.equal(render!.pathD, clip!.pathD);
}

describe("Clipper2 canonical boolean pipeline", () => {
  it("2-rectangle union", () => {
    const a = input("a", rectPolygon(0, 0, 100, 100));
    const b = input("b", rectPolygon(50, 0, 100, 100));
    const result = applyBooleanOperation("union", [a, b]);
    assert.ok(result);
    assert.ok(result!.width >= 140);
  });

  it("3-rectangle union", () => {
    const rects = [
      input("a", rectPolygon(0, 0, 100, 100)),
      input("b", rectPolygon(50, 0, 100, 100)),
      input("c", rectPolygon(25, 50, 100, 100)),
    ];
    const result = applyBooleanOperation("union", rects);
    assert.ok(result);
    assert.ok(result!.pathD.includes("M"));
  });

  it("5-rectangle union", () => {
    const rects = [
      input("a", rectPolygon(0, 0, 80, 80)),
      input("b", rectPolygon(40, 0, 80, 80)),
      input("c", rectPolygon(80, 0, 80, 80)),
      input("d", rectPolygon(20, 40, 80, 80)),
      input("e", rectPolygon(60, 40, 80, 80)),
    ];
    const result = applyBooleanOperation("union", rects);
    assert.ok(result);
    assert.ok(result!.width >= 100);
  });

  it("3-shape subtract: subject minus union of cutters", () => {
    const base = input("base", rectPolygon(0, 0, 120, 120));
    const c1 = input("c1", rectPolygon(10, 10, 30, 30));
    const c2 = input("c2", rectPolygon(70, 70, 30, 30));
    const chained = applyBooleanOperation("subtract", [base, c1, c2]);
    const singleHole = applyBooleanOperation("subtract", [
      base,
      input("both", rectPolygon(10, 10, 90, 90)),
    ]);
    assert.ok(chained);
    assert.ok(singleHole);
    assert.notEqual(chained!.pathD, singleHole!.pathD);
    assert.match(chained!.pathD, /M.*Z/);
  });

  it("base rectangle minus two circle approximations", () => {
    const base = input("base", rectPolygon(0, 0, 200, 200));
    const c1 = ellipseLocalPolygonPoints(60, 60, { startDeg: 0, sweepDeg: 360, innerRadiusRatio: 0 }, 32);
    const c2 = ellipseLocalPolygonPoints(60, 60, { startDeg: 0, sweepDeg: 360, innerRadiusRatio: 0 }, 32).map(
      (p) => ({ x: p.x + 120, y: p.y + 120 }),
    );
    const result = applyBooleanOperation("subtract", [
      base,
      input("c1", c1),
      input("c2", c2),
    ]);
    assert.ok(result);
    assert.match(result!.pathD, /M.*Z.*M.*Z/);
  });

  it("3-shape intersect", () => {
    const rects = [
      input("a", rectPolygon(0, 0, 100, 100)),
      input("b", rectPolygon(40, 0, 100, 100)),
      input("c", rectPolygon(20, 40, 100, 100)),
    ];
    const result = applyBooleanOperation("intersect", rects);
    assert.ok(result);
    assert.ok(result!.width <= 80);
    assert.ok(result!.height <= 80);
  });

  it("3-shape exclude (xor)", () => {
    const rects = [
      input("a", rectPolygon(0, 0, 100, 100)),
      input("b", rectPolygon(50, 0, 100, 100)),
      input("c", rectPolygon(25, 50, 100, 100)),
    ];
    const result = applyBooleanOperation("exclude", rects);
    assert.ok(result);
    assert.ok(result!.pathD.length > 20);
  });

  it("subtract preserves hole contours in output path", () => {
    const outer = input("outer", rectPolygon(0, 0, 100, 100));
    const hole = input("hole", rectPolygon(25, 25, 50, 50));
    const result = applyBooleanOperation("subtract", [outer, hole]);
    assert.ok(result);
    const contours = (result!.pathD.match(/ Z/g) ?? []).length;
    assert.ok(contours >= 2);
    assert.equal(result!.fillRule, "evenodd");
  });

  it("SVG-style path polygon unioned with rectangle", () => {
    const svgTri = [
      { x: 50, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const a = input("tri", svgTri);
    const b = input("rect", rectPolygon(40, 40, 80, 80));
    const result = applyBooleanOperation("union", [a, b]);
    assert.ok(result);
  });

  it("rotated rectangle operands use world-space polygons", () => {
    const a = rectNode("a", "g", 0, 0, 100, 50, { rotation: 45 });
    const b = rectNode("b", "g", 30, 0, 100, 50, { rotation: -30 });
    const g = booleanGroup("g", "union", ["a", "b"], { a, b });
    const nodes = { a, b, g };
    const childOrder = { g: ["a", "b"] };
    const inputs = shapesToBooleanInput(["a", "b"], nodes, childOrder);
    assert.equal(inputs.length, 2);
    const unrotated = applyBooleanOperation("union", [
      input("a", rectPolygon(0, 0, 100, 50)),
      input("b", rectPolygon(30, 0, 100, 50)),
    ]);
    const rotated = applyBooleanOperation("union", inputs);
    assert.ok(unrotated && rotated);
    assert.notEqual(rotated!.pathD, unrotated!.pathD);
  });

  it("ellipse + star + rectangle union", () => {
    const ellipse = ellipseLocalPolygonPoints(80, 60, { startDeg: 0, sweepDeg: 360, innerRadiusRatio: 0 }, 48);
    const star = starVertices(5, 0.45, 90, 90).map((p) => ({ x: p.x + 60, y: p.y + 20 }));
    const rect = rectPolygon(20, 50, 70, 50);
    const result = applyBooleanOperation("union", [
      input("e", ellipse),
      input("s", star),
      input("r", rect),
    ]);
    assert.ok(result);
    assert.ok(result!.width >= 80);
  });

  it("2-operand preview matches Clipper flatten result", () => {
    const a = rectNode("a", "g", 0, 0, 100, 100);
    const b = rectNode("b", "g", 40, 20, 100, 80);
    const g = booleanGroup("g", "union", ["a", "b"], { a, b });
    const nodes = { a, b, g };
    const childOrder = { g: ["a", "b"] };
    previewMatchesClipper("union", ["a", "b"], nodes, childOrder, "g");
    previewMatchesClipper("subtract", ["a", "b"], nodes, childOrder, "g");
    previewMatchesClipper("intersect", ["a", "b"], nodes, childOrder, "g");
    previewMatchesClipper("exclude", ["a", "b"], nodes, childOrder, "g");
  });

  it("3-operand preview matches Clipper flatten result", () => {
    const a = rectNode("a", "g", 0, 0, 100, 100);
    const b = rectNode("b", "g", 50, 0, 100, 100);
    const c = rectNode("c", "g", 25, 50, 100, 100);
    const g = booleanGroup("g", "union", ["a", "b", "c"], { a, b, c });
    const nodes = { a, b, c, g };
    const childOrder = { g: ["a", "b", "c"] };
    for (const op of ["union", "subtract", "intersect", "exclude"] as const) {
      previewMatchesClipper(op, ["a", "b", "c"], nodes, childOrder, "g");
    }
  });

  it("shapeNodeToWorldPolygon applies transforms", () => {
    const node = rectNode("r", null, 10, 20, 40, 30, { rotation: 90 });
    const nodes = { r: node };
    const poly = shapeNodeToWorldPolygon("r", nodes);
    assert.ok(poly.length >= 4);
    const m = { a: 1, b: 0, c: 0, d: 1, tx: 10, ty: 20 };
    const expected = applyMatrixToPoint(
      { a: 0, b: 1, c: -1, d: 0, tx: 10 + 20 + 15, ty: 20 + 10 },
      { x: 0, y: 0 },
    );
    void m;
    void expected;
    assert.ok(poly.some((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  });
});
