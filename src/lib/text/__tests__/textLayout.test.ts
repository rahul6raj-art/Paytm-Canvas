import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  patchAffectsTextLayout,
  textLayoutPatchForNode,
  withTextLayoutPatch,
} from "@/lib/text/textLayout";

function textNode(): EditorNode {
  return {
    id: "t1",
    parentId: "frame1",
    type: "text",
    name: "Label",
    x: 0,
    y: 0,
    width: 120,
    height: 20,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content: "Hello",
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.25,
    textResizeMode: "auto-height",
  };
}

describe("text layout patch helpers", () => {
  it("detects typography changes that affect layout", () => {
    assert.equal(patchAffectsTextLayout({ fontSize: 20 }), true);
    assert.equal(patchAffectsTextLayout({ textColor: "#fff" }), false);
  });

  it("does not change box for non-layout patches", () => {
    const node = textNode();
    const next = withTextLayoutPatch(node, { textColor: "#ff0000" });
    assert.deepEqual(next, { textColor: "#ff0000" });
  });

  it("switches auto-height to fixed when truncate is enabled", () => {
    const node = textNode();
    const next = withTextLayoutPatch(node, { textTruncate: "end" });
    assert.equal(next.textTruncate, "end");
    assert.equal(next.textResizeMode, "fixed");
    assert.equal(next.autoResize, "fixed");
  });

  it("does not auto-grow height when truncate is enabled", () => {
    const node = {
      ...textNode(),
      textTruncate: "end" as const,
      textResizeMode: "fixed" as const,
      height: 40,
      content: "Line one\nLine two\nLine three",
    };
    const patch = textLayoutPatchForNode(node, node.content ?? "");
    assert.equal(patch?.height, undefined);
  });
});
