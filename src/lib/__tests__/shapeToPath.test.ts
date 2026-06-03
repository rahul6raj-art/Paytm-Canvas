import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  convertNodeToPath,
  isRoundedRectPath,
  isVectorEditableShape,
  pathOutlineD,
  shapeToPathPoints,
} from "@/lib/shapes/shapeToPath";
import type { EditorNode } from "@/stores/useEditorStore";

function baseNode(overrides: Partial<EditorNode>): EditorNode {
  return {
    id: "n1",
    parentId: null,
    type: "rectangle",
    name: "Rect",
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    ...overrides,
  };
}

describe("shapeToPath", () => {
  it("detects vector-editable shapes", () => {
    assert.equal(isVectorEditableShape(baseNode({ type: "rectangle" })), true);
    assert.equal(isVectorEditableShape(baseNode({ type: "text" })), false);
    assert.equal(isVectorEditableShape(baseNode({ locked: true })), false);
  });

  it("converts rectangle to four corner anchors", () => {
    const built = shapeToPathPoints(baseNode({ type: "rectangle", cornerRadius: 8 }));
    assert.equal(built?.pathClosed, true);
    assert.equal(built?.pathPoints.length, 4);
  });

  it("renders rounded rect path from corner radii", () => {
    const pathNode = convertNodeToPath(baseNode({ type: "rectangle", cornerRadius: 12 }));
    assert.ok(pathNode);
    assert.equal(isRoundedRectPath(pathNode!), true);
    const d = pathOutlineD(pathNode!);
    assert.ok(d.includes("A "), "outline uses arc commands for radius");
  });

  it("converts line to open two-point path", () => {
    const built = shapeToPathPoints(baseNode({ type: "line", height: 4 }));
    assert.equal(built?.pathClosed, false);
    assert.equal(built?.pathPoints.length, 2);
  });

  it("convertNodeToPath changes type to path", () => {
    const next = convertNodeToPath(baseNode({ type: "ellipse" }));
    assert.equal(next?.type, "path");
    assert.ok((next?.pathPoints?.length ?? 0) > 3);
  });
});
