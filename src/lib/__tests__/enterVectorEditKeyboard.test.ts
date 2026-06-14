import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isVectorEditableShape } from "@/lib/shapes/shapeToPath";
import type { EditorNode } from "@/stores/useEditorStore";

function ellipse(id: string): EditorNode {
  return {
    id,
    parentId: null,
    type: "ellipse",
    name: id,
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
  };
}

describe("Enter → vector edit eligibility", () => {
  it("ellipse/circle is vector-editable on Enter", () => {
    assert.equal(isVectorEditableShape(ellipse("e1")), true);
  });

  it("locked ellipse is not vector-editable", () => {
    assert.equal(isVectorEditableShape({ ...ellipse("e2"), locked: true }), false);
  });
});
