import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { worldToNodeLocalFromChildOrder } from "@/lib/editorGraph";
import type { EditorNode } from "@/stores/useEditorStore";

function rect(partial: Partial<EditorNode> & Pick<EditorNode, "id">): EditorNode {
  return {
    parentId: null,
    type: "rectangle",
    name: "Rect",
    x: 100,
    y: 50,
    width: 120,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...partial,
  };
}

describe("worldToNodeLocalFromChildOrder", () => {
  it("maps world origin to local 0,0 for unrotated root node", () => {
    const nodes = { a: rect({ id: "a" }) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const local = worldToNodeLocalFromChildOrder(100, 50, "a", nodes, childOrder);
    assert.ok(Math.abs(local.x) < 0.02);
    assert.ok(Math.abs(local.y) < 0.02);
  });

  it("maps world center to local center for rotated root node", () => {
    const nodes = { a: rect({ id: "a", rotation: 45 }) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a"] };
    const local = worldToNodeLocalFromChildOrder(160, 90, "a", nodes, childOrder);
    assert.ok(Math.abs(local.x - 60) < 0.5);
    assert.ok(Math.abs(local.y - 40) < 0.5);
  });
});
