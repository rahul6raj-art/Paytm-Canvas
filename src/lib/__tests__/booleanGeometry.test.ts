import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyBooleanOperation,
  flattenBooleanGroup,
  type BooleanInput,
} from "@/lib/booleanGeometry";
import type { EditorNode } from "@/stores/useEditorStore";

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

describe("applyBooleanOperation (Clipper2)", () => {
  it("union merges overlapping rectangles into one region", () => {
    const a = input("a", rectPolygon(0, 0, 100, 100));
    const b = input("b", rectPolygon(50, 0, 100, 100));
    const result = applyBooleanOperation("union", [a, b]);
    assert.ok(result);
    assert.ok(result!.pathD.includes("M"));
    assert.equal(result!.fill, "#3366ff");
    assert.ok(result!.width >= 140);
    assert.ok(result!.height >= 90);
  });

  it("subtract removes cutters from the first (base) operand", () => {
    const base = input("base", rectPolygon(0, 0, 100, 100));
    const hole = input("hole", rectPolygon(40, 40, 40, 40));
    const result = applyBooleanOperation("subtract", [base, hole]);
    assert.ok(result);
    assert.ok(result!.pathD.length > 0);
    assert.equal(result!.fillRule, "evenodd");
    assert.match(result!.pathD, /M.*Z.*M.*Z/);
  });

  it("subtract with three operands: base minus union of cutters", () => {
    const base = input("base", rectPolygon(0, 0, 100, 100));
    const c1 = input("c1", rectPolygon(20, 20, 20, 20));
    const c2 = input("c2", rectPolygon(60, 60, 20, 20));
    const result = applyBooleanOperation("subtract", [base, c1, c2]);
    assert.ok(result);
    assert.match(result!.pathD, /M.*Z.*M.*Z/);
    assert.ok(result!.width >= 95);
    assert.ok(result!.height >= 95);
  });

  it("intersect returns overlap only", () => {
    const a = input("a", rectPolygon(0, 0, 100, 100));
    const b = input("b", rectPolygon(50, 50, 50, 50));
    const result = applyBooleanOperation("intersect", [a, b]);
    assert.ok(result);
    assert.ok(result!.width <= 55);
    assert.ok(result!.height <= 55);
    assert.ok(result!.width >= 45);
    assert.ok(result!.height >= 45);
  });

  it("exclude (xor) produces symmetric difference", () => {
    const a = input("a", rectPolygon(0, 0, 100, 100));
    const b = input("b", rectPolygon(50, 0, 100, 100));
    const result = applyBooleanOperation("exclude", [a, b]);
    assert.ok(result);
    assert.ok(result!.pathD.length > 0);
  });

  it("intersect returns null when shapes do not overlap", () => {
    const a = input("a", rectPolygon(0, 0, 50, 50));
    const b = input("b", rectPolygon(200, 200, 50, 50));
    const result = applyBooleanOperation("intersect", [a, b]);
    assert.equal(result, null);
  });

  it("returns null with fewer than two inputs", () => {
    assert.equal(applyBooleanOperation("union", [input("a", rectPolygon(0, 0, 10, 10))]), null);
  });
});

describe("flattenBooleanGroup", () => {
  it("flattens a subtract boolean group", () => {
    const nodes: Record<string, EditorNode> = {
      g: {
        id: "g",
        parentId: null,
        type: "group",
        name: "Subtract",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        isBooleanGroup: true,
        booleanOperation: "subtract",
      },
      base: {
        id: "base",
        parentId: "g",
        type: "rectangle",
        name: "base",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        fill: "#ff0000",
        fillEnabled: true,
      },
      hole: {
        id: "hole",
        parentId: "g",
        type: "rectangle",
        name: "hole",
        x: 30,
        y: 30,
        width: 40,
        height: 40,
        rotation: 0,
        visible: true,
        locked: false,
        fill: "#00ff00",
        fillEnabled: true,
      },
    };
    const result = flattenBooleanGroup(nodes.g!, ["base", "hole"], nodes);
    assert.ok(result);
    assert.ok(result!.pathD.length > 10);
    assert.equal(result!.fill, "#ff0000");
  });
});
