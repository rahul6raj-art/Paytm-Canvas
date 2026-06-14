import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compositeEditModeForDrag,
  compositeSelectionBoundsId,
  isCompositeHiddenOperand,
} from "@/lib/compositeSelection";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(id: string, parentId: string, x: number, y: number, w: number, h: number): EditorNode {
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
  } as EditorNode;
}

describe("compositeSelection", () => {
  it("treats boolean operands as hidden outside object edit mode", () => {
    const g = "bool-g";
    const a = "rect-a";
    const nodes = {
      [g]: {
        id: g,
        parentId: null,
        type: "group",
        name: "Union",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        isBooleanGroup: true,
        booleanOperation: "union",
      } as EditorNode,
      [a]: rect(a, g, 0, 0, 100, 100),
    };
    assert.equal(isCompositeHiddenOperand(a, nodes), true);
    assert.equal(compositeSelectionBoundsId(a, nodes), g);
    assert.equal(compositeEditModeForDrag([a], nodes, null), g);
    assert.equal(isCompositeHiddenOperand(a, nodes, { objectEditModeNodeId: g }), false);
  });

  it("treats mask layer as hidden unless maskVisible or selected", () => {
    const g = "mg";
    const mask = "mask";
    const nodes = {
      [g]: {
        id: g,
        parentId: null,
        type: "group",
        name: "Mask",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        maskId: mask,
        maskVisible: false,
      } as EditorNode,
      [mask]: {
        ...rect(mask, g, 10, 10, 80, 80),
        type: "ellipse",
      } as EditorNode,
    };
    assert.equal(isCompositeHiddenOperand(mask, nodes), true);
    assert.equal(compositeSelectionBoundsId(mask, nodes), g);
    assert.equal(
      isCompositeHiddenOperand(mask, nodes, { selectedIds: [mask] }),
      false,
    );
    assert.equal(
      isCompositeHiddenOperand(mask, nodes, { objectEditModeNodeId: g }),
      false,
    );
  });
});
