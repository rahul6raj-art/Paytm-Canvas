import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  getSelectionSpacingHandles,
  idsMovedBySelectionGapDrag,
} from "@/lib/selectionSpacingHandles";
import { moveNodesByWorldDelta } from "@/lib/alignSelection";
import { getRenderedWorldBounds } from "@/lib/editorGraph";

const childOrderRoot = (ids: string[]) => ({ [EDITOR_ROOT_KEY]: ids });

function rect(id: string, x: number, y: number, w: number, h: number): EditorNode {
  return {
    id,
    parentId: null,
    type: "rectangle",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
  };
}

describe("getSelectionSpacingHandles", () => {
  it("returns a horizontal gap handle between side-by-side rects", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 40, 30),
      b: rect("b", 60, 0, 40, 30),
    };
    const childOrder = childOrderRoot(["a", "b"]);
    const handles = getSelectionSpacingHandles(["a", "b"], nodes, childOrder);
    const h = handles.find((x) => x.axis === "horizontal");
    assert.ok(h);
    assert.equal(h.beforeId, "a");
    assert.equal(h.afterId, "b");
    assert.equal(h.gap, 20);
  });

  it("returns a vertical gap handle between stacked rects", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 40, 30),
      b: rect("b", 0, 50, 40, 30),
    };
    const childOrder = childOrderRoot(["a", "b"]);
    const handles = getSelectionSpacingHandles(["a", "b"], nodes, childOrder);
    const v = handles.find((x) => x.axis === "vertical");
    assert.ok(v);
    assert.equal(v.beforeId, "a");
    assert.equal(v.afterId, "b");
    assert.equal(v.gap, 20);
  });

  it("skips gaps when layers do not overlap on the cross axis", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 40, 30),
      b: rect("b", 60, 100, 40, 30),
    };
    const childOrder = childOrderRoot(["a", "b"]);
    const handles = getSelectionSpacingHandles(["a", "b"], nodes, childOrder);
    assert.equal(handles.length, 0);
  });

  it("returns multiple handles for three horizontally spaced layers", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 30, 30),
      b: rect("b", 50, 0, 30, 30),
      c: rect("c", 100, 0, 30, 30),
    };
    const childOrder = childOrderRoot(["a", "b", "c"]);
    const handles = getSelectionSpacingHandles(["a", "b", "c"], nodes, childOrder).filter(
      (h) => h.axis === "horizontal",
    );
    assert.equal(handles.length, 2);
    assert.deepEqual(
      handles.map((h) => [h.beforeId, h.afterId]),
      [
        ["a", "b"],
        ["b", "c"],
      ],
    );
  });
});

describe("idsMovedBySelectionGapDrag", () => {
  it("moves trailing layers on the sorted axis", () => {
    const sorted = ["a", "b", "c"];
    assert.deepEqual(idsMovedBySelectionGapDrag({ sortedIds: sorted, index: 0 }), ["b", "c"]);
    assert.deepEqual(idsMovedBySelectionGapDrag({ sortedIds: sorted, index: 1 }), ["c"]);
  });
});

describe("moveNodesByWorldDelta", () => {
  it("increases horizontal gap when trailing layers move right", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 40, 30),
      b: rect("b", 60, 0, 40, 30),
    };
    const childOrder = childOrderRoot(["a", "b"]);
    const out = moveNodesByWorldDelta(nodes, childOrder, ["b"], 10, 0);
    const ba = getRenderedWorldBounds("a", out, childOrder);
    const bb = getRenderedWorldBounds("b", out, childOrder);
    assert.equal(bb.x - (ba.x + ba.width), 30);
  });
});
