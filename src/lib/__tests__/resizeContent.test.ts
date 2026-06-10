import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { buildResizeContentPatches, scaleSubtreeContentPatches } from "@/lib/resizeContent";

function rectNode(overrides: Partial<EditorNode> = {}): EditorNode {
  return {
    id: "r1",
    parentId: null,
    type: "rectangle",
    name: "Rect",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    cornerRadius: 16,
    ...overrides,
  };
}

describe("resizeContent corner radius", () => {
  it("preserves corner radius on proportional resize", () => {
    const node = rectNode();
    const patch = buildResizeContentPatches(
      node,
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 200, height: 200 },
      "se",
      { shiftKey: true, altKey: true },
    );
    assert.equal(patch.cornerRadius, undefined);
    assert.equal(patch.cornerRadii, undefined);
  });

  it("preserves child corner radius when frame scales proportionally", () => {
    const parent = rectNode({ id: "frame", type: "frame", cornerRadius: 0 });
    const child = rectNode({ id: "child", parentId: "frame", cornerRadius: 12 });
    const nodes = { frame: parent, child };
    const patches = scaleSubtreeContentPatches("frame", nodes, { frame: ["child"] }, 2, 2, 2);
    assert.equal(patches.child?.cornerRadius, undefined);
    assert.equal(patches.child?.cornerRadii, undefined);
  });
});
