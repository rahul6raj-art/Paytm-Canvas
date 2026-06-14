import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { nodeFillDisplayHex, nodeSupportsFillColor } from "@/lib/fillAdjust";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";

function rect(id: string, fill: string): EditorNode {
  return {
    id,
    parentId: null,
    type: "rectangle",
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill,
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center",
  };
}

describe("fillAdjust", () => {
  it("nodeSupportsFillColor includes shape layers", () => {
    assert.equal(nodeSupportsFillColor({ type: "rectangle", isBooleanGroup: false }), true);
    assert.equal(nodeSupportsFillColor({ type: "text", isBooleanGroup: false }), true);
    assert.equal(nodeSupportsFillColor({ type: "line", isBooleanGroup: false }), false);
  });

  it("nodeFillDisplayHex reads shape fill and text color", () => {
    assert.equal(nodeFillDisplayHex(rect("a", "#ff0000")), "#ff0000");
    assert.equal(
      nodeFillDisplayHex({
        ...rect("t", "#ccc"),
        type: "text",
        textColor: "#112233",
        content: "Hi",
      }),
      "#112233",
    );
  });
});

describe("setSelectionFillHex", () => {
  beforeEach(() => {
    useEditorStore.setState({
      nodes: {
        a: rect("a", "#111111"),
        b: rect("b", "#222222"),
      },
      childOrder: { [EDITOR_ROOT_KEY]: ["a", "b"] },
      selectedIds: ["a", "b"],
      editorMode: "design",
    });
  });

  it("applies fill color to all selected shapes", () => {
    useEditorStore.getState().setSelectionFillHex("#aabbcc");
    const { nodes } = useEditorStore.getState();
    assert.equal(nodes.a?.fill, "#aabbcc");
    assert.equal(nodes.b?.fill, "#aabbcc");
    assert.equal(nodes.a?.fillType, "solid");
    assert.equal(nodes.b?.fillEnabled, true);
  });
});
