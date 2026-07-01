import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveTextEditTargetOnDoubleClick } from "@/lib/text/textEditMode";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(
  id: string,
  parentId: string | null,
  cls: string,
  extra: Partial<EditorNode> = {},
): EditorNode {
  return {
    id,
    parentId,
    type: "frame",
    name: id,
    x: 0,
    y: 0,
    width: 344,
    height: 52,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    codeClassName: cls,
    ...extra,
  };
}

function text(
  id: string,
  parentId: string,
  content: string,
  cls: string,
): EditorNode {
  return {
    id,
    parentId,
    type: "text",
    name: "Value",
    x: 16,
    y: 16,
    width: 200,
    height: 20,
    rotation: 0,
    visible: true,
    locked: false,
    content,
    codeClassName: cls,
  };
}

describe("resolveTextEditTargetOnDoubleClick", () => {
  it("enters value text when double-clicking a captured textfield box", () => {
    const nodes: Record<string, EditorNode> = {
      box: frame("box", "root", "textfield__box"),
      label: text("label", "box", "Mobile number", "textfield__label textfield__label--float"),
      value: text("value", "box", "", "textfield__input body-medium"),
    };
    const childOrder = { box: ["label", "value"], label: [], value: [] };

    assert.equal(
      resolveTextEditTargetOnDoubleClick("box", 50, 50, nodes, childOrder),
      "value",
    );
  });

  it("prefers text under the cursor over the textfield host", () => {
    const nodes: Record<string, EditorNode> = {
      box: frame("box", "root", "textfield__box"),
      value: text("value", "box", "9876543210", "textfield__input body-medium"),
    };
    const childOrder = { box: ["value"], value: [] };

    assert.equal(
      resolveTextEditTargetOnDoubleClick("value", 20, 20, nodes, childOrder),
      "value",
    );
  });
});
