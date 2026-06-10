import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAutoLayoutHandleFrameId } from "@/lib/autoLayout/resolveHandleFrame";
import type { EditorNode } from "@/stores/useEditorStore";

function alFrame(id: string): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: id,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    layoutMode: "vertical",
    layoutGap: 8,
  };
}

function rect(id: string, parentId: string): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: id,
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
  };
}

describe("resolveAutoLayoutHandleFrameId", () => {
  it("returns the frame when an auto-layout frame is selected", () => {
    const nodes = { f: alFrame("f"), a: rect("a", "f") };
    assert.equal(resolveAutoLayoutHandleFrameId(["f"], nodes), "f");
  });

  it("returns the parent frame when a flow child is selected", () => {
    const nodes = { f: alFrame("f"), a: rect("a", "f") };
    assert.equal(resolveAutoLayoutHandleFrameId(["a"], nodes), "f");
  });
});
