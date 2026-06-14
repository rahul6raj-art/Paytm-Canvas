import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import { defaultNodeEffect } from "@/lib/nodeEffects";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(
  id: string,
  parentId: string,
  x: number,
  y: number,
  w: number,
  h: number,
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
    fill: "#3366ff",
    fillEnabled: true,
    visible: true,
    locked: false,
  } as EditorNode;
}

describe("buildSvgScene boolean groups", () => {
  it("renders union composite paths instead of stacked operand rectangles", () => {
    const a = "rect-a";
    const b = "rect-b";
    const g = "bool-g";
    const nodes: Record<string, EditorNode> = {
      [g]: {
        id: g,
        parentId: null,
        type: "group",
        name: "Union",
        x: 0,
        y: 0,
        width: 140,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        isBooleanGroup: true,
        booleanOperation: "union",
        fill: "#3366ff",
        fillEnabled: true,
      } as EditorNode,
      [a]: rect(a, g, 0, 0, 100, 100),
      [b]: rect(b, g, 40, 20, 100, 80),
    };
    const childOrder = { [g]: [a, b] };
    const scene = buildSvgScene({ rootIds: [g], nodes, childOrder });

    assert.match(scene.body, /<path d="/);
    assert.equal((scene.body.match(/<rect /g) ?? []).length, 0);
  });

  it("renders subtract with Clipper2 composite path", () => {
    const base = "rect-base";
    const hole = "rect-hole";
    const g = "bool-sub";
    const nodes: Record<string, EditorNode> = {
      [g]: {
        id: g,
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
        expanded: true,
        isBooleanGroup: true,
        booleanOperation: "subtract",
        fill: "#ff0000",
        fillEnabled: true,
      } as EditorNode,
      [base]: rect(base, g, 0, 0, 100, 100),
      [hole]: rect(hole, g, 30, 30, 40, 40),
    };
    const childOrder = { [g]: [base, hole] };
    const scene = buildSvgScene({ rootIds: [g], nodes, childOrder });

    assert.match(scene.body, /<path d="/);
    assert.match(scene.body, /fill-rule="evenodd"/);
    assert.doesNotMatch(scene.body, /mask=/);
    assert.equal((scene.body.match(/<rect /g) ?? []).length, 0);
  });

  it("shows operand children while the boolean group is in object edit mode", () => {
    const a = "rect-a";
    const b = "rect-b";
    const g = "bool-g";
    const nodes: Record<string, EditorNode> = {
      [g]: {
        id: g,
        parentId: null,
        type: "group",
        name: "Union",
        x: 0,
        y: 0,
        width: 140,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        isBooleanGroup: true,
        booleanOperation: "union",
        fill: "#3366ff",
        fillEnabled: true,
      } as EditorNode,
      [a]: rect(a, g, 0, 0, 100, 100),
      [b]: rect(b, g, 40, 20, 100, 80),
    };
    const childOrder = { [g]: [a, b] };
    const scene = buildSvgScene({
      rootIds: [g],
      nodes,
      childOrder,
      objectEditModeNodeId: g,
    });

    assert.equal((scene.body.match(/<rect /g) ?? []).length, 2);
  });

  it("applies layer effects to the boolean composite path", () => {
    const a = "rect-a";
    const b = "rect-b";
    const g = "bool-g";
    const nodes: Record<string, EditorNode> = {
      [g]: {
        id: g,
        parentId: null,
        type: "group",
        name: "Union",
        x: 0,
        y: 0,
        width: 140,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        isBooleanGroup: true,
        booleanOperation: "union",
        fill: "#3366ff",
        fillEnabled: true,
        effects: [{ ...defaultNodeEffect("drop-shadow"), visible: true }],
      } as EditorNode,
      [a]: rect(a, g, 0, 0, 100, 100),
      [b]: rect(b, g, 40, 20, 100, 80),
    };
    const childOrder = { [g]: [a, b] };
    const scene = buildSvgScene({ rootIds: [g], nodes, childOrder });

    assert.match(scene.body, /filter="url\(#pc-filter-bool-g\)"/);
    assert.match(scene.defs, /<filter id="pc-filter-bool-g"/);
  });

  it("renders operand children during drag preview instead of a static composite", () => {
    const a = "rect-a";
    const b = "rect-b";
    const g = "bool-g";
    const nodes: Record<string, EditorNode> = {
      [g]: {
        id: g,
        parentId: null,
        type: "group",
        name: "Union",
        x: 0,
        y: 0,
        width: 140,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        isBooleanGroup: true,
        booleanOperation: "union",
        fill: "#3366ff",
        fillEnabled: true,
      } as EditorNode,
      [a]: rect(a, g, 0, 0, 100, 100),
      [b]: rect(b, g, 40, 20, 100, 80),
    };
    const childOrder = { [g]: [a, b] };
    const scene = buildSvgScene({
      rootIds: [g],
      nodes,
      childOrder,
      dragPreview: { dx: 12, dy: 8, movingIds: [a] },
    });

    assert.equal((scene.body.match(/<rect /g) ?? []).length, 2);
    assert.equal((scene.body.match(/<path d="/g) ?? []).length, 0);
    assert.match(scene.body, /data-drag-preview/);
  });
});
