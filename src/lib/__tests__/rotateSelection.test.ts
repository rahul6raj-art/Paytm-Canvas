import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applySingleRotate,
  createSingleRotateSession,
  formatRotationLabel,
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

  it("formatRotationLabel normalizes display", () => {
    assert.equal(formatRotationLabel(370), "10°");
  });
});
