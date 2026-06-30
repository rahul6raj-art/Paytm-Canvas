import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  bridgeCaptureRootIds,
  filterBridgeCaptureRelayoutParents,
  freezeBridgeCaptureSubtree,
  isUnderBridgeCaptureScreen,
} from "../bridgeCaptureLayout";

function frame(
  id: string,
  parentId: string | null,
  extra?: Partial<EditorNode>,
): EditorNode {
  return {
    id,
    parentId,
    type: "frame",
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    rotation: 0,
    visible: true,
    locked: false,
    ...extra,
  };
}

describe("bridgeCaptureLayout", () => {
  it("freezes auto-layout on inner frames under a pushed screen", () => {
    const nodes: Record<string, EditorNode> = {
      screen: frame("screen", null, {
        name: "PML- More",
        manualScreenLayout: true,
        width: 376,
        height: 844,
      }),
      row: frame("row", "screen", {
        layoutMode: "horizontal",
        layoutGap: 8,
        y: 120,
        width: 344,
        height: 72,
      }),
      label: {
        id: "label",
        parentId: "row",
        type: "text",
        name: "Label",
        x: 0,
        y: 0,
        width: 80,
        height: 20,
        content: "Stocks",
        textResizeMode: "auto-width",
      } as EditorNode,
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["screen"],
      screen: ["row"],
      row: ["label"],
    };

    freezeBridgeCaptureSubtree(nodes, childOrder);
    assert.equal(nodes.row?.layoutMode, "none");
    assert.equal(nodes.label?.textResizeMode, "auto-width");
  });

  it("detects nodes under a bridge capture root", () => {
    const nodes: Record<string, EditorNode> = {
      screen: frame("screen", null, { bridgeSourcePath: "src/screens/PMLMorePage" }),
      card: frame("card", "screen"),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["screen"], screen: ["card"] };
    assert.equal(isUnderBridgeCaptureScreen(nodes, "card", childOrder), true);
    assert.equal(bridgeCaptureRootIds(nodes, childOrder).has("screen"), true);
  });

  it("filters auto-layout relayout inside bridge captures", () => {
    const nodes: Record<string, EditorNode> = {
      screen: frame("screen", null, { manualScreenLayout: true }),
      stack: frame("stack", "screen", { layoutMode: "vertical" }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["screen"], screen: ["stack"] };
    const filtered = filterBridgeCaptureRelayoutParents(nodes, childOrder, ["stack"]);
    assert.deepEqual(filtered, []);
  });
});
