import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveShapeStrokeLayerOrder,
  shouldUseFilledStrokeRing,
} from "@/components/editor/StrokedShapeLayers";
import {
  closedShapeStrokeViewport,
  strokeFillLayerBeforeStrokeLayer,
  strokeRingLayersBeforeFill,
} from "@/lib/strokeAlign";
import { outlineRoundedRectRingPath } from "@/lib/vector/roundedRectPath";
import type { EditorNode } from "@/stores/useEditorStore";

function baseNode(partial: Partial<EditorNode> & Pick<EditorNode, "type">): EditorNode {
  return {
    id: "n1",
    parentId: null,
    name: "Shape",
    x: 0,
    y: 0,
    width: 300,
    height: 300,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#9e9e9e",
    fillEnabled: true,
    strokeColor: "#ffffff",
    strokeWidth: 20,
    strokeEnabled: true,
    strokePosition: "center",
    strokeType: "solid",
    cornerRadius: 80,
    ...partial,
  };
}

describe("stroke layer order", () => {
  it("uses filled ring for outside solid rounded rectangles", () => {
    const node = baseNode({ type: "rectangle", strokePosition: "outside" });
    assert.equal(shouldUseFilledStrokeRing(node, { showStroke: true, closed: true }), true);
  });

  it("skips filled ring for center solid rounded rectangles", () => {
    const node = baseNode({ type: "rectangle" });
    assert.equal(shouldUseFilledStrokeRing(node, { showStroke: true, closed: true }), false);
  });

  it("orders fill below stroke for center and inside filled rings", () => {
    assert.equal(strokeRingLayersBeforeFill("center"), false);
    assert.equal(strokeRingLayersBeforeFill("inside"), false);
    assert.equal(strokeFillLayerBeforeStrokeLayer("center", true), true);
    assert.equal(strokeFillLayerBeforeStrokeLayer("inside", true), true);
    assert.equal(resolveShapeStrokeLayerOrder("center", true).fillBeforeStroke, true);
    assert.equal(resolveShapeStrokeLayerOrder("inside", true).fillBeforeStroke, true);
  });

  it("orders stroke below fill for outside filled rings", () => {
    assert.equal(strokeRingLayersBeforeFill("outside"), true);
    assert.equal(strokeFillLayerBeforeStrokeLayer("outside", true), false);
    assert.equal(resolveShapeStrokeLayerOrder("outside", true).fillBeforeStroke, false);
  });

  it("orders fill below native stroke for center and inside closed paths", () => {
    assert.equal(strokeFillLayerBeforeStrokeLayer("center", false), true);
    assert.equal(strokeFillLayerBeforeStrokeLayer("inside", false), true);
    assert.equal(strokeFillLayerBeforeStrokeLayer("outside", false), false);
  });

  it("builds a full-perimeter center ring for the regression shape", () => {
    const ring = outlineRoundedRectRingPath(300, 300, 80, 20, "center", 0);
    assert.ok(ring?.pathD);
    assert.equal(ring!.fillRule, "evenodd");
    assert.ok(ring!.pathD.endsWith(" Z"));
    const nums = ring!.pathD.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
    assert.ok(Math.min(...nums) <= -10);
    assert.ok(Math.max(...nums) >= 310);
  });

  it("expands viewport for center and outside strokes", () => {
    assert.ok(closedShapeStrokeViewport(300, 300, 20, "center"));
    assert.ok(closedShapeStrokeViewport(300, 300, 20, "outside"));
    assert.equal(closedShapeStrokeViewport(300, 300, 20, "inside"), null);
  });
});
