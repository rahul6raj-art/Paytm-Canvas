import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  applyAutoLayoutToContainer,
  applyAutoLayoutToSelection,
} from "@/lib/autoLayoutSelection";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(id: string, extra: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: extra.name ?? `Frame ${id}`,
    x: 0,
    y: 0,
    width: 200,
    height: 120,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    layoutMode: "none",
    ...extra,
  };
}

function rect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<EditorNode> = {},
): EditorNode {
  return {
    id,
    parentId: null,
    type: "rectangle",
    name: extra.name ?? `Rectangle ${id}`,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fillEnabled: true,
    fill: "#cccccc",
    ...extra,
  };
}

describe("applyAutoLayoutToSelection — frame naming", () => {
  it("names wrapped multi-select frames Frame 1, Frame 2, …", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 40, 20),
      b: rect("b", 50, 0, 40, 20),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b"] };

    const first = applyAutoLayoutToSelection(nodes, childOrder, ["a", "b"]);
    assert.ok(first);
    const frame1 = first!.nodes[first!.selectedIds[0]!]!;
    assert.equal(frame1.name, "Frame 1");

    const nodes2 = {
      ...first!.nodes,
      c: rect("c", 200, 0, 30, 30, { name: "Ellipse 1" }),
    };
    const childOrder2 = {
      ...first!.childOrder,
      [EDITOR_ROOT_KEY]: [...(first!.childOrder[EDITOR_ROOT_KEY] ?? []), "c"],
    };

    const second = applyAutoLayoutToSelection(nodes2, childOrder2, ["c"]);
    assert.ok(second);
    const frame2 = second!.nodes[second!.selectedIds[0]!]!;
    assert.equal(frame2.name, "Frame 2");
    assert.notEqual(frame2.name, "Auto layout");
  });
});

describe("applyAutoLayoutToContainer — existing frame", () => {
  it("enables auto layout on a selected frame and lays out children", () => {
    const nodes: Record<string, EditorNode> = {
      f: frame("f"),
      a: rect("a", 10, 10, 40, 20, { parentId: "f" }),
      b: rect("b", 60, 10, 40, 20, { parentId: "f", name: "Rectangle b" }),
    };
    const childOrder = { f: ["a", "b"] };

    const result = applyAutoLayoutToContainer(nodes, childOrder, "f");
    assert.ok(result);
    assert.equal(result!.nodes.f.layoutMode, "horizontal");
    assert.equal(result!.nodes.f.layoutSizingHorizontal, "hug");
    assert.equal(result!.nodes.f.layoutSizingVertical, "hug");
    assert.ok(result!.nodes.b.x > result!.nodes.a.x);
  });

  it("finds children via parentId when childOrder is missing on the frame", () => {
    const nodes: Record<string, EditorNode> = {
      f: frame("f"),
      a: rect("a", 10, 10, 40, 20, { parentId: "f" }),
      b: rect("b", 60, 10, 40, 20, { parentId: "f", name: "Rectangle b" }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f"] };

    const result = applyAutoLayoutToContainer(nodes, childOrder, "f");
    assert.ok(result);
    assert.equal(result!.childOrder.f?.length, 2);
    assert.notEqual(result!.nodes.f.layoutMode, "none");
  });

  it("reconciles childOrder when children were still listed at the page root", () => {
    const nodes: Record<string, EditorNode> = {
      f: frame("f"),
      a: rect("a", 10, 10, 40, 20, { parentId: "f" }),
      b: rect("b", 60, 10, 40, 20, { parentId: "f", name: "Rectangle b" }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["f", "a", "b"],
      f: [],
    };

    const result = applyAutoLayoutToContainer(nodes, childOrder, "f");
    assert.ok(result);
    assert.deepEqual(result!.childOrder[EDITOR_ROOT_KEY], ["f"]);
    assert.equal(result!.childOrder.f?.length, 2);
    assert.equal(result!.nodes.f.expanded, true);
  });
});

describe("applyAutoLayoutToSelection — children inside frame", () => {
  it("wraps selected children in a nested auto layout frame (Figma ⇧A)", () => {
    const nodes: Record<string, EditorNode> = {
      f: frame("f"),
      a: rect("a", 10, 10, 40, 20, { parentId: "f" }),
      b: rect("b", 60, 10, 40, 20, { parentId: "f", name: "Rectangle b" }),
    };
    const childOrder = { f: ["a", "b"] };

    const result = applyAutoLayoutToSelection(nodes, childOrder, ["a", "b"]);
    assert.ok(result);
    const alFrameId = result!.selectedIds[0]!;
    assert.ok(alFrameId.startsWith("frame-al-"));
    assert.equal(result!.nodes.f.layoutMode, "none");
    assert.equal(result!.nodes[alFrameId].parentId, "f");
    assert.equal(result!.nodes[alFrameId].layoutMode, "horizontal");
    assert.equal(result!.nodes.a.parentId, alFrameId);
    assert.equal(result!.nodes.b.parentId, alFrameId);
    assert.deepEqual(result!.childOrder.f, [alFrameId]);
    assert.deepEqual(result!.childOrder[alFrameId], ["a", "b"]);
  });

  it("wraps siblings when childOrder lists operands only via parentId", () => {
    const nodes: Record<string, EditorNode> = {
      f: frame("f"),
      a: rect("a", 10, 10, 40, 20, { parentId: "f" }),
      b: rect("b", 60, 10, 40, 20, { parentId: "f" }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f"], f: [] };

    const result = applyAutoLayoutToSelection(nodes, childOrder, ["a", "b"]);
    assert.ok(result);
    const alFrameId = result!.selectedIds[0]!;
    assert.ok(alFrameId.startsWith("frame-al-"));
    assert.equal(result!.nodes.f.layoutMode, "none");
    assert.equal(result!.nodes[alFrameId].parentId, "f");
    assert.deepEqual(result!.childOrder.f, [alFrameId]);
    assert.deepEqual(result!.childOrder[alFrameId], ["a", "b"]);
  });

  it("preserves visual gap when selection order differs from spatial order", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", 0, 0, 40, 20),
      b: rect("b", 50, 0, 40, 20),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b"] };

    const result = applyAutoLayoutToSelection(nodes, childOrder, ["b", "a"]);
    assert.ok(result);
    const frame = result!.nodes[result!.selectedIds[0]!]!;
    assert.equal(frame.layoutGap, 10);
    assert.equal(result!.nodes.b.x, 50);
  });

  it("preserves gap when enabling auto layout on an existing frame", () => {
    const nodes: Record<string, EditorNode> = {
      f: frame("f"),
      a: rect("a", 10, 10, 40, 20, { parentId: "f" }),
      b: rect("b", 60, 10, 40, 20, { parentId: "f" }),
    };
    const childOrder = { f: ["b", "a"] };

    const result = applyAutoLayoutToContainer(nodes, childOrder, "f");
    assert.ok(result);
    assert.equal(result!.nodes.f.layoutGap, 10);
  });
});
