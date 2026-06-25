import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  convertNodeToPath,
  isVectorEditableShape,
  needsVectorPathConversion,
} from "@/lib/shapes/shapeToPath";
import { newPathPointId } from "@/lib/pathGeometry";
import type { EditorNode } from "@/stores/useEditorStore";

function baseNode(overrides: Partial<EditorNode>): EditorNode {
  return {
    id: "n1",
    parentId: null,
    type: "ellipse",
    name: "Shape",
    x: 0,
    y: 0,
    width: 80,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#000",
    fillEnabled: true,
    ...overrides,
  };
}

describe("Enter → vector edit eligibility", () => {
  it("ellipse/circle is vector-editable on Enter", () => {
    assert.equal(isVectorEditableShape(baseNode({ type: "ellipse" })), true);
  });

  it("locked ellipse is not vector-editable", () => {
    assert.equal(isVectorEditableShape({ ...baseNode({ type: "ellipse" }), locked: true }), false);
  });

  it("star, polygon, and triangle require path conversion before vector edit", () => {
    assert.equal(isVectorEditableShape(baseNode({ type: "polygon", polygonSides: 6 })), true);
    assert.equal(isVectorEditableShape(baseNode({ type: "polygon", polygonSides: 3 })), true);
    assert.equal(
      isVectorEditableShape(
        baseNode({ type: "path", starPoints: 5, pathPoints: [{ id: newPathPointId(), x: 0, y: 0 }] }),
      ),
      true,
    );

    assert.equal(needsVectorPathConversion(baseNode({ type: "polygon", polygonSides: 6 })), true);
    assert.equal(needsVectorPathConversion(baseNode({ type: "polygon", polygonSides: 3 })), true);
    assert.equal(
      needsVectorPathConversion(
        baseNode({ type: "path", starPoints: 5, pathPoints: [{ id: newPathPointId(), x: 0, y: 0 }] }),
      ),
      true,
    );

    const starPath = convertNodeToPath(
      baseNode({
        type: "path",
        starPoints: 5,
        starInnerRadius: 0.4,
        pathClosed: true,
        pathPoints: [{ id: newPathPointId(), x: 0, y: 0 }],
      }),
    );
    assert.equal(starPath?.type, "path");
    assert.equal(starPath?.starPoints, undefined);
    assert.ok((starPath?.pathPoints?.length ?? 0) >= 6);
  });
});
