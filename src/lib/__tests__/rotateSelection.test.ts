import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  applyMultiRotatePatches,
  applySingleRotate,
  createMultiRotateSession,
  createSingleRotateSession,
  formatRotationLabel,
  getNodeWorldCenterFromChildOrder,
} from "@/lib/rotation";
import {
  rotationDeltaDegrees,
  snapRotationDegrees,
  snapRotationDeltaDegrees,
} from "@/lib/rotation/rotateMath";
import type { EditorNode } from "@/stores/useEditorStore";

function node(partial: Partial<EditorNode> & Pick<EditorNode, "id">): EditorNode {
  return {
    parentId: null,
    type: "rectangle",
    name: "Rect",
    x: 100,
    y: 100,
    width: 100,
    height: 50,
    rotation: 30,
    visible: true,
    locked: false,
    expanded: true,
    ...partial,
  };
}

describe("rotateMath", () => {
  it("snapRotationDegrees snaps to 15° with Shift", () => {
    assert.equal(snapRotationDegrees(47, true), 45);
    assert.equal(snapRotationDegrees(8, true), 15);
  });

  it("snapRotationDeltaDegrees snaps delta to 15° steps", () => {
    assert.equal(snapRotationDeltaDegrees(47, true), 45);
  });
});

describe("rotateSelection single", () => {
  it("applySingleRotate adds pointer delta to start rotation", () => {
    const n = node({ id: "a" });
    const nodes = { a: n };
    const childOrder = { __root__: ["a"] };
    const center = { x: 150, y: 125 };
    const session = createSingleRotateSession(
      "a",
      n,
      nodes,
      childOrder,
      { x: center.x + 100, y: center.y },
    );
    const startAngle = session.startAngle;
    const pointer = {
      x: center.x + 100 * Math.cos(startAngle + Math.PI / 4),
      y: center.y + 100 * Math.sin(startAngle + Math.PI / 4),
    };
    const { rotation } = applySingleRotate(session, pointer, false, nodes, childOrder);
    assert.ok(Math.abs(rotation - 75) < 0.5);
  });

  it("applySingleRotate keeps x/y fixed and preserves world center", () => {
    const n = node({ id: "a", x: 40, y: 60, rotation: 10 });
    const nodes = { a: n };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const beforeCenter = getNodeWorldCenterFromChildOrder("a", nodes, childOrder);
    const session = createSingleRotateSession("a", n, nodes, childOrder, { x: 200, y: 60 });
    const { rotation, x, y } = applySingleRotate(
      session,
      { x: 200, y: 140 },
      false,
      nodes,
      childOrder,
    );
    assert.equal(x, 40);
    assert.equal(y, 60);
    assert.notEqual(rotation, 10);
    const afterNodes = { a: { ...n, rotation, x, y } };
    const afterCenter = getNodeWorldCenterFromChildOrder("a", afterNodes, childOrder);
    assert.ok(Math.abs(afterCenter.x - beforeCenter.x) < 0.02);
    assert.ok(Math.abs(afterCenter.y - beforeCenter.y) < 0.02);
  });

  it("applySingleRotate does not change width or height", () => {
    const n = node({ id: "a", x: 0, y: 0, width: 200, height: 100, rotation: 0 });
    const nodes = { a: n };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const session = createSingleRotateSession("a", n, nodes, childOrder, { x: 250, y: 50 });
    const { rotation, x, y } = applySingleRotate(
      session,
      { x: 300, y: 150 },
      false,
      nodes,
      childOrder,
    );
    const after = { ...n, rotation, x, y };
    assert.equal(after.width, 200);
    assert.equal(after.height, 100);
    assert.equal(x, 0);
    assert.equal(y, 0);
    assert.notEqual(rotation, 0);
  });

  it("applySingleRotate keeps frozen startGeom even if node x/y drift in store", () => {
    const n = node({ id: "a", x: 10, y: 20, width: 80, height: 40, rotation: 0 });
    const nodes = { a: n };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const session = createSingleRotateSession("a", n, nodes, childOrder, { x: 60, y: 40 });
    const corrupted = { a: { ...n, x: 99, y: 88, width: 200, height: 150 } };
    const { x, y } = applySingleRotate(session, { x: 80, y: 80 }, false, corrupted, childOrder);
    assert.equal(x, 10);
    assert.equal(y, 20);
  });

  it("applyMultiRotatePatches orbits children without changing size", () => {
    const a = node({ id: "a", x: 0, y: 0, width: 40, height: 40, rotation: 0 });
    const b = node({ id: "b", x: 80, y: 0, width: 40, height: 40, rotation: 0 });
    const nodes = { a, b };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b"] };
    const union = { x: 0, y: 0, width: 120, height: 40 };
    const session = createMultiRotateSession(["a", "b"], nodes, childOrder, union, {
      x: 60,
      y: -40,
    });
    const patches = applyMultiRotatePatches(
      session,
      { x: 120, y: 60 },
      false,
      nodes,
      childOrder,
    );
    assert.equal(nodes.a!.width, 40);
    assert.equal(nodes.b!.width, 40);
    assert.equal(patches.a!.rotation, patches.b!.rotation);
  });

  it("formatRotationLabel normalizes display", () => {
    assert.equal(formatRotationLabel(370), "10°");
  });
});
