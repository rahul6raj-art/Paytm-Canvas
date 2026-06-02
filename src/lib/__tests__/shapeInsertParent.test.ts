import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { resolveFrameParentForShapeInsert } from "@/lib/tree";
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

  it("falls back to parent frame of selected shape", () => {
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
    assert.equal(pid, "f1");
  });
});
