import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGeometryDocumentOp,
  patchTouchesGeometry,
} from "@/engine/craftEngineAuthorityGeometry";
import type { EditorNode } from "@/stores/useEditorStore";

function rectNode(overrides: Partial<EditorNode> = {}): EditorNode {
  return {
    id: "r1",
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
    ...overrides,
  } as EditorNode;
}

describe("craftEngineAuthorityGeometry", () => {
  it("detects geometry patches", () => {
    assert.equal(patchTouchesGeometry({ x: 1 }), true);
    assert.equal(patchTouchesGeometry({ fill: "#fff" }), false);
  });

  it("builds moveNode for position-only patches", () => {
    const node = rectNode({ x: 40, y: 50 });
    const op = buildGeometryDocumentOp("r1", { x: 40, y: 50 }, node);
    assert.equal(op?.op, "moveNode");
    assert.equal(op?.fields.x, 40);
    assert.equal(op?.fields.y, 50);
  });

  it("builds updateNode with explicit geometry fields (not full node replace)", () => {
    const node = rectNode({ x: 18548, y: 12032, width: 580, height: 598, rotation: 14 });
    const op = buildGeometryDocumentOp("r1", { rotation: 14 }, node);
    assert.equal(op?.op, "updateNode");
    assert.equal(op?.fields.node, undefined);
    assert.equal(op?.fields.x, 18548);
    assert.equal(op?.fields.y, 12032);
    assert.equal(op?.fields.width, 580);
    assert.equal(op?.fields.height, 598);
    assert.equal(op?.fields.rotation, 14);
  });
});
