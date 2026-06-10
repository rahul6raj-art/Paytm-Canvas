import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  getRenderedWorldTopLeft,
  worldCenterToNodeXYFromChildOrder,
  worldOriginToNodeXYFromChildOrder,
} from "@/lib/editorGraph";
import { getNodeWorldCenterFromChildOrder } from "@/lib/rotation/rotateSelection";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(partial: Partial<EditorNode> & Pick<EditorNode, "id">): EditorNode {
  return {
    parentId: null,
    type: "rectangle",
    name: "Rect",
    x: 100,
    y: 80,
    width: 120,
    height: 60,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...partial,
  };
}

describe("worldOriginToNodeXYFromChildOrder", () => {
  it("preserves rendered origin for rotated root nodes", () => {
    const nodes = { a: rect({ id: "a", rotation: 45 }) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const origin = getRenderedWorldTopLeft("a", nodes, childOrder);
    const xy = worldOriginToNodeXYFromChildOrder("a", nodes, childOrder, origin);
    const nodes2 = { a: { ...nodes.a!, x: xy.x, y: xy.y } };
    const origin2 = getRenderedWorldTopLeft("a", nodes2, childOrder);
    assert.ok(Math.abs(origin2.x - origin.x) < 0.02);
    assert.ok(Math.abs(origin2.y - origin.y) < 0.02);

    const xyAgain = worldOriginToNodeXYFromChildOrder("a", nodes2, childOrder, origin2);
    assert.ok(Math.abs(xyAgain.x - xy.x) < 0.02);
    assert.ok(Math.abs(xyAgain.y - xy.y) < 0.02);
  });

  it("worldCenterToNodeXYFromChildOrder round-trips world center", () => {
    const nodes = {
      frame: rect({ id: "frame", type: "frame", rotation: 20, width: 300, height: 200 }),
      a: rect({ id: "a", parentId: "frame", rotation: 45, x: 50, y: 40 }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["frame"], frame: ["a"] };
    const center = getNodeWorldCenterFromChildOrder("a", nodes, childOrder);
    const xy = worldCenterToNodeXYFromChildOrder("a", nodes, childOrder, center);
    const nodes2 = { ...nodes, a: { ...nodes.a!, x: xy.x, y: xy.y } };
    const center2 = getNodeWorldCenterFromChildOrder("a", nodes2, childOrder);
    assert.ok(Math.abs(center2.x - center.x) < 0.02);
    assert.ok(Math.abs(center2.y - center.y) < 0.02);
  });

  it("preserves rendered origin for rotated child nodes", () => {
    const nodes = {
      frame: rect({ id: "frame", type: "frame", rotation: 15, width: 400, height: 300 }),
      a: rect({ id: "a", parentId: "frame", rotation: 30, x: 40, y: 50 }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["frame"], frame: ["a"] };
    const origin = getRenderedWorldTopLeft("a", nodes, childOrder);
    const xy = worldOriginToNodeXYFromChildOrder("a", nodes, childOrder, origin);
    const nodes2 = {
      ...nodes,
      a: { ...nodes.a!, x: xy.x, y: xy.y },
    };
    const origin2 = getRenderedWorldTopLeft("a", nodes2, childOrder);
    assert.ok(Math.abs(origin2.x - origin.x) < 0.02);
    assert.ok(Math.abs(origin2.y - origin.y) < 0.02);
  });
});
