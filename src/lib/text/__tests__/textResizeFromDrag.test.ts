import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDGE_RESIZE_HANDLES } from "@/lib/resize";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  buildTextResizeGeometryPatch,
  isTextResizeHandleAllowed,
  textResizeHandlesForMode,
} from "../textResizeFromDrag";

function installTextMeasureDomStub(): void {
  const ctx = {
    font: "",
    measureText(text: string) {
      return { width: text.length * 7 };
    },
    fillText() {},
  };

  globalThis.document = {
    createElement(tag: string) {
      if (tag !== "canvas") return {} as HTMLElement;
      return {
        getContext() {
          return ctx;
        },
      } as HTMLCanvasElement;
    },
  } as Document;
}

function baseTextNode(overrides: Partial<EditorNode> = {}): EditorNode {
  return {
    id: "t1",
    parentId: null,
    type: "text",
    name: "T",
    x: 0,
    y: 0,
    width: 200,
    height: 24,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content: "Hello World from Figma",
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.25,
    textResizeMode: "auto-width",
    autoResize: "width-height",
    ...overrides,
  };
}

describe("textResizeFromDrag", () => {
  it("exposes Figma-style handles per resize mode", () => {
    assert.deepEqual(textResizeHandlesForMode("auto-width"), ["e", "w"]);
    assert.deepEqual(textResizeHandlesForMode("auto-height"), EDGE_RESIZE_HANDLES);
    assert.deepEqual(textResizeHandlesForMode("fixed"), EDGE_RESIZE_HANDLES);
    assert.equal(isTextResizeHandleAllowed(baseTextNode(), "e"), true);
    assert.equal(isTextResizeHandleAllowed(baseTextNode(), "n"), false);
  });

  it("converts auto-width to auto-height and grows height when narrowing width", () => {
    installTextMeasureDomStub();
    const node = baseTextNode();
    const start = { x: 0, y: 0, width: 200, height: 24 };
    const patch = buildTextResizeGeometryPatch(node, start, {
      x: 0,
      y: 0,
      width: 80,
      height: 24,
    });
    assert.equal(patch.textResizeMode, "auto-height");
    assert.equal(patch.autoResize, "height");
    assert.ok((patch.height ?? 0) > start.height);
  });

  it("converts auto-height to fixed when dragging south handle", () => {
    const node = baseTextNode({
      width: 120,
      height: 48,
      textResizeMode: "auto-height",
      autoResize: "height",
    });
    const start = { x: 0, y: 0, width: 120, height: 48 };
    const patch = buildTextResizeGeometryPatch(node, start, {
      x: 0,
      y: 0,
      width: 120,
      height: 30,
    });
    assert.equal(patch.textResizeMode, "fixed");
    assert.equal(patch.height, 30);
  });
});
