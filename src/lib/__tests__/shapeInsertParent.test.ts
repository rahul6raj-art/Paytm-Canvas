import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { getRenderedWorldTopLeft, repairNodeHierarchy } from "@/lib/editorGraph";
import { insertNodeWithFrameParenting, resolveFrameParentForShapeInsert } from "@/lib/tree";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(id: string, x: number, y: number, w: number, h: number): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#fff",
    fillEnabled: true,
  };
}

describe("resolveFrameParentForShapeInsert", () => {
  it("parents to frame under shape center", () => {
    const nodes = { f1: frame("f1", 100, 100, 400, 400) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: [] };
    const pid = resolveFrameParentForShapeInsert(
      { x: 150, y: 150, width: 80, height: 60 },
      nodes,
      childOrder,
      [],
    );
    assert.equal(pid, "f1");
  });

  it("does not parent to selected frame when shape bounds are fully outside it", () => {
    const nodes = {
      f1: frame("f1", 100, 100, 400, 400),
      r1: {
        ...frame("r1", 0, 0, 50, 50),
        id: "r1",
        parentId: "f1",
        type: "rectangle" as const,
        x: 20,
        y: 30,
      },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: ["r1"] };
    const pid = resolveFrameParentForShapeInsert(
      { x: 520, y: 520, width: 40, height: 40 },
      nodes,
      childOrder,
      ["r1"],
    );
    assert.equal(pid, null);
  });

  it("parents a new frame beside the selected frame at canvas root", () => {
    const nodes = { f1: frame("f1", 80, 80, 376, 812) };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: [] };
    const pid = resolveFrameParentForShapeInsert(
      { x: 520, y: 80, width: 228, height: 289 },
      nodes,
      childOrder,
      ["f1"],
    );
    assert.equal(pid, null);
    const id = "f2";
    const inserted = insertNodeWithFrameParenting(
      { ...frame("f2", 0, 0, 228, 289), id, clipChildren: true },
      { x: 520, y: 80, width: 228, height: 289 },
      nodes,
      childOrder,
      ["f1"],
    );
    assert.equal(inserted.nodes[id]!.parentId, null);
    assert.deepEqual(inserted.childOrder[EDITOR_ROOT_KEY], ["f1", id]);
    assert.deepEqual(getRenderedWorldTopLeft(id, inserted.nodes, inserted.childOrder), {
      x: 520,
      y: 80,
    });
    assert.equal(inserted.nodes[id]!.x, 520);
    assert.equal(inserted.nodes[id]!.y, 80);
  });

  it("repair lifts a frame drawn outside its wrongly assigned parent", () => {
    const f1 = frame("f1", 80, 80, 376, 812);
    const f2 = { ...frame("f2", 440, 0, 228, 289), parentId: "f1" };
    const nodes = { f1, f2 };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: ["f2"], f2: [] };
    const before = getRenderedWorldTopLeft("f2", nodes, childOrder);
    assert.equal(before.x, 520);
    assert.equal(before.y, 80);
    const fixed = repairNodeHierarchy(nodes, childOrder);
    assert.equal(fixed.nodes.f2!.parentId, null);
    assert.deepEqual(fixed.childOrder[EDITOR_ROOT_KEY], ["f1", "f2"]);
    assert.deepEqual(getRenderedWorldTopLeft("f2", fixed.nodes, fixed.childOrder), before);
    assert.equal(fixed.nodes.f2!.x, 520);
    assert.equal(fixed.nodes.f2!.y, 80);
  });
});

describe("insertNodeWithFrameParenting", () => {
  it("places new shapes inside the frame under the click with correct world position", () => {
    const nodes = {
      f2: frame("f2", 0, 400, 500, 500),
      f1: { ...frame("f1", 0, 0, 400, 400), parentId: "f2" },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f2"], f2: ["f1"], f1: [] };
    const id = "r1";
    const node = {
      ...frame("r1", 0, 0, 80, 40),
      id,
      parentId: null,
      type: "rectangle" as const,
      fill: "#000",
      strokeWidth: 0,
      strokePosition: "center" as const,
      fillOpacity: 1,
      opacity: 1,
    };
    const inserted = insertNodeWithFrameParenting(
      node,
      { x: 150, y: 460, width: 80, height: 40 },
      nodes,
      childOrder,
      [],
    );
    assert.equal(inserted.nodes[id]!.parentId, "f1");
    assert.deepEqual(getRenderedWorldTopLeft(id, inserted.nodes, inserted.childOrder), {
      x: 150,
      y: 460,
    });
    assert.equal(inserted.nodes[id]!.x, 150);
    assert.equal(inserted.nodes[id]!.y, 60);
  });

  it("nests a new frame inside the frame under the drag bounds", () => {
    const nodes = {
      f2: frame("f2", 0, 400, 600, 600),
      f1: { ...frame("f1", 0, 0, 400, 400), parentId: "f2" },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f2"], f2: ["f1"], f1: [] };
    const id = "f3";
    const node = {
      ...frame("f3", 0, 0, 200, 150),
      id,
      clipChildren: true,
    };
    const inserted = insertNodeWithFrameParenting(
      node,
      { x: 50, y: 450, width: 200, height: 150 },
      nodes,
      childOrder,
      [],
    );
    assert.equal(inserted.nodes[id]!.parentId, "f1");
    assert.deepEqual(getRenderedWorldTopLeft(id, inserted.nodes, inserted.childOrder), {
      x: 50,
      y: 450,
    });
    assert.equal(inserted.nodes[id]!.x, 50);
    assert.equal(inserted.nodes[id]!.y, 50);
    assert.deepEqual(inserted.childOrder.f1, ["f3"]);
  });
});
