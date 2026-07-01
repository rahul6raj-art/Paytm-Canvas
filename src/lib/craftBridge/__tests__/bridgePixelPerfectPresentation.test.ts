import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  applyBridgeLivePresentation,
  applyBridgePixelPerfectPresentation,
  sliceHasVisibleImportReference,
} from "@/lib/craftBridge/bridgePixelPerfectPresentation";

function frame(id: string, extra: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: id,
    x: 0,
    y: 0,
    width: 376,
    height: 844,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...extra,
  };
}

describe("applyBridgePixelPerfectPresentation", () => {
  it("shows screenshot reference and hides DOM structure layers", () => {
    const nodes: Record<string, EditorNode> = {
      screen: frame("screen", { parentId: null }),
      ref: {
        ...frame("ref", { parentId: "screen", type: "image", height: 844 }),
        isImportReference: true,
        imageSrc: "data:image/png;base64,abc",
      },
      body: frame("body", { parentId: "screen", y: 100, height: 700 }),
      label: {
        id: "label",
        parentId: "body",
        type: "text",
        name: "Title",
        x: 16,
        y: 120,
        width: 200,
        height: 32,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        content: "Hello",
      },
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["screen"],
      screen: ["ref", "body"],
      body: ["label"],
    };

    applyBridgePixelPerfectPresentation(nodes, childOrder);

    assert.equal(nodes.ref?.visible, true);
    assert.equal(nodes.ref?.locked, true);
    assert.equal(nodes.body?.visible, false);
    assert.equal(nodes.label?.visible, false);
    assert.equal(sliceHasVisibleImportReference(nodes), true);
  });

  it("applyBridgeLivePresentation defaults to pixel-perfect", () => {
    const nodes: Record<string, EditorNode> = {
      screen: frame("screen", { parentId: null }),
      ref: {
        ...frame("ref", { parentId: "screen", type: "image", height: 844 }),
        isImportReference: true,
        imageSrc: "data:image/png;base64,abc",
      },
      body: frame("body", { parentId: "screen" }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["screen"],
      screen: ["ref", "body"],
    };

    assert.equal(applyBridgeLivePresentation(nodes, childOrder), true);
    assert.equal(nodes.ref?.visible, true);
    assert.equal(nodes.body?.visible, false);
  });
});
