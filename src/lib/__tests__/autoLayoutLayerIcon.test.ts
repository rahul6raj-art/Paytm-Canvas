import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAutoLayoutContainer } from "@/lib/layoutEngine/types";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(layoutMode: EditorNode["layoutMode"] = "none"): EditorNode {
  return {
    id: "f1",
    type: "frame",
    name: "Frame",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    visible: true,
    locked: false,
    layoutMode,
  } as EditorNode;
}

describe("auto layout layer icon detection", () => {
  it("treats horizontal auto-layout frames as containers", () => {
    assert.equal(isAutoLayoutContainer(frame("horizontal")), true);
  });

  it("treats vertical auto-layout frames as containers", () => {
    assert.equal(isAutoLayoutContainer(frame("vertical")), true);
  });

  it("does not treat manual frames as auto-layout containers", () => {
    assert.equal(isAutoLayoutContainer(frame("none")), false);
    assert.equal(isAutoLayoutContainer(frame(undefined)), false);
  });
});
