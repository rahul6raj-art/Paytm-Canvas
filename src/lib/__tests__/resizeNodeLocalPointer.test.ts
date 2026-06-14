import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  getNodeWorldInverseMatrixFromChildOrder,
  worldToNodeLocalFromChildOrder,
} from "@/lib/editorGraph";
import { centerProportionalScaleFromWorld, computeResizedBounds } from "@/lib/resize";
import { applyMatrixToPoint } from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(partial: Partial<EditorNode> & Pick<EditorNode, "id">): EditorNode {
  return {
    parentId: null,
    type: "rectangle",
    name: "Rect",
    x: 100,
    y: 80,
    width: 200,
    height: 100,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...partial,
  };
}

/** Mirrors resize drag: frozen start inverse + zero-origin local bounds. */
function resizeFromWorldPointer(
  startBounds: { x: number; y: number; width: number; height: number },
  handle: "e" | "s" | "n" | "w",
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  modifiers: { shiftKey: boolean; altKey: boolean } = { shiftKey: false, altKey: false },
) {
  const startInv = getNodeWorldInverseMatrixFromChildOrder("a", nodes, childOrder);
  assert.ok(startInv);
  const local = applyMatrixToPoint(startInv, { x: worldX, y: worldY });
  const localStart = { x: 0, y: 0, width: startBounds.width, height: startBounds.height };
  const next = computeResizedBounds(handle, localStart, local, modifiers, "rectangle");
  return {
    x: startBounds.x + next.x,
    y: startBounds.y + next.y,
    width: next.width,
    height: next.height,
  };
}

describe("resize with node-local pointer", () => {
  it("east handle follows world pointer on unrotated layer", () => {
    const nodes = { a: rect({ id: "a" }) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const start = { x: 100, y: 80, width: 200, height: 100 };
    const next = resizeFromWorldPointer(start, "e", 350, 130, nodes, childOrder);
    assert.equal(next.width, 250);
    assert.equal(next.x, 100);
    assert.equal(next.y, 80);
  });

  it("south handle follows world pointer on unrotated layer", () => {
    const nodes = { a: rect({ id: "a" }) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const start = { x: 100, y: 80, width: 200, height: 100 };
    const next = resizeFromWorldPointer(start, "s", 200, 210, nodes, childOrder);
    assert.equal(next.height, 130);
    assert.equal(next.y, 80);
  });

  it("west handle tracks pointer when origin would move each frame", () => {
    const nodes = { a: rect({ id: "a" }) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const start = { x: 100, y: 80, width: 200, height: 100 };
    const next = resizeFromWorldPointer(start, "w", 50, 130, nodes, childOrder);
    assert.equal(next.x, 50);
    assert.equal(next.width, 250);
    assert.equal(next.y, 80);
  });

  it("live node-local conversion drifts for west resize (regression guard)", () => {
    const startNodes = { a: rect({ id: "a" }) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const midNodes = { a: rect({ id: "a", x: 50, width: 250 }) };
    const live = worldToNodeLocalFromChildOrder(50, 130, "a", midNodes, childOrder);
    assert.equal(live.x, 0);
    const startInv = getNodeWorldInverseMatrixFromChildOrder("a", startNodes, childOrder)!;
    const frozen = applyMatrixToPoint(startInv, { x: 50, y: 130 });
    assert.equal(frozen.x, -50);
  });

  it("corner Shift+Option scales proportionally from center", () => {
    const nodes = { a: rect({ id: "a" }) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const start = { x: 100, y: 80, width: 200, height: 100 };
    const cx = start.x + start.width / 2;
    const cy = start.y + start.height / 2;
    const next = computeResizedBounds(
      "se",
      { x: 0, y: 0, width: start.width, height: start.height },
      { x: 250, y: 130 },
      { shiftKey: true, altKey: true },
      "rectangle",
    );
    const ar = start.width / start.height;
    assert.ok(Math.abs(next.width / next.height - ar) < 0.01);
    assert.equal(start.x + next.x + next.width / 2, cx);
    assert.equal(start.y + next.y + next.height / 2, cy);

    const centerWorld = { x: cx, y: cy };
    const scaled = centerProportionalScaleFromWorld(
      start,
      centerWorld,
      { x: 300, y: 180 },
      { x: 360, y: 210 },
    );
    assert.ok(Math.abs(scaled.width / scaled.height - ar) < 0.01);
    assert.equal(scaled.x + scaled.width / 2, cx);
    assert.equal(scaled.y + scaled.height / 2, cy);
    assert.ok(scaled.width > start.width);
    assert.ok(scaled.height > start.height);
  });

  it("Option + east handle keeps center fixed while tracking pointer", () => {
    const nodes = { a: rect({ id: "a" }) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const start = { x: 100, y: 80, width: 200, height: 100 };
    const cx = start.x + start.width / 2;
    const next = resizeFromWorldPointer(
      start,
      "e",
      100 + 280,
      80 + 50,
      nodes,
      childOrder,
      { shiftKey: false, altKey: true },
    );
    assert.equal(next.width, 360);
    assert.equal(next.x + next.width / 2, cx);
  });
});
