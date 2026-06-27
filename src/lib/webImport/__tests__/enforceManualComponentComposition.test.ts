import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { enforceManualComponentComposition } from "@/lib/webImport/enforceManualComponentComposition";

function frame(
  id: string,
  patch: Partial<EditorNode> = {},
): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: id,
    x: 0,
    y: 0,
    width: 120,
    height: 48,
    rotation: 0,
    visible: true,
    locked: false,
    ...patch,
  };
}

describe("enforceManualComponentComposition", () => {
  it("disables flex auto layout and pins children to fixed absolute positions", () => {
    const nodes: Record<string, EditorNode> = {
      btn: frame("btn", {
        codeClassName: "btn btn--filled",
        layoutMode: "horizontal",
        layoutGap: 8,
      }),
      icon: frame("icon", {
        parentId: "btn",
        x: 16,
        y: 12,
        width: 24,
        height: 24,
        layoutPositioning: "auto",
        layoutSizingHorizontal: "fill",
      }),
      label: {
        ...frame("label", {
          parentId: "btn",
          x: 48,
          y: 14,
          width: 56,
          height: 20,
          layoutPositioning: "auto",
          layoutSizingHorizontal: "fill",
          layoutGrow: 1,
        }),
        type: "text",
        content: "Continue",
      },
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["btn"],
      btn: ["icon", "label"],
    };

    enforceManualComponentComposition(nodes, childOrder);

    assert.equal(nodes.btn?.layoutMode, "none");
    assert.equal(nodes.icon?.layoutPositioning, "absolute");
    assert.equal(nodes.icon?.layoutSizingHorizontal, "fixed");
    assert.equal(nodes.label?.layoutSizingHorizontal, "fixed");
    assert.equal(nodes.label?.layoutGrow, undefined);
  });
});
