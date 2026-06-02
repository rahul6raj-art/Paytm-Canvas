import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyMatrixToPoint,
  buildLayerCssTransform,
  getNodeLocalMatrix,
  layerFlipScale,
} from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";

function node(partial: Partial<EditorNode> & Pick<EditorNode, "id">): EditorNode {
  return {
    parentId: null,
    type: "rectangle",
    name: "Rect",
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...partial,
  };
}

describe("layer flip and rotate", () => {
  it("buildLayerCssTransform combines rotate and flip", () => {
    assert.equal(
      buildLayerCssTransform({ rotation: 90, flipHorizontal: true }),
      "rotate(90deg) scaleX(-1)",
    );
  });

  it("layerFlipScale defaults to identity", () => {
    assert.deepEqual(layerFlipScale({}), { sx: 1, sy: 1 });
  });

  it("getNodeLocalMatrix mirrors horizontal corner", () => {
    const n = node({ id: "a", flipHorizontal: true });
    const m = getNodeLocalMatrix(n);
    const corner = applyMatrixToPoint(m, { x: 100, y: 0 });
    assert.ok(corner.x < n.x + n.width);
  });
});
