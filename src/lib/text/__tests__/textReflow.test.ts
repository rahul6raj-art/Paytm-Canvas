import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { textLayoutForEditorNode } from "@/lib/text/canonicalTextLayout";
import { svgTextMarkup } from "@/lib/svgMarkupCore";
import { textLayoutPatchForNode } from "@/lib/text/textLayout";
import { countTspans } from "./textReflowTestUtils";

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

function figmaTextNode(width: number, mode: "auto-width" | "auto-height" | "fixed" = "auto-height"): EditorNode {
  return {
    id: "t-reflow",
    parentId: "frame1",
    type: "text",
    name: "Label",
    x: 0,
    y: 0,
    width,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content: "Hello World from Figma",
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.25,
    textResizeMode: mode,
  };
}

describe("Figma-like text reflow", () => {
  before(() => {
    installTextMeasureDomStub();
  });

  it("wraps at narrow widths and unwraps when width increases", () => {
    const wide = textLayoutForEditorNode(figmaTextNode(300));
    const medium = textLayoutForEditorNode(figmaTextNode(120));
    const narrow = textLayoutForEditorNode(figmaTextNode(60));
    const wideAgain = textLayoutForEditorNode(figmaTextNode(300));

    assert.ok(wide);
    assert.ok(medium);
    assert.ok(narrow);
    assert.ok(wideAgain);

    assert.equal(wide!.layout.lines.length, 1);
    assert.ok(medium!.layout.lines.length > 1);
    assert.ok(narrow!.layout.lines.length >= medium!.layout.lines.length);
    assert.equal(wideAgain!.layout.lines.length, 1);
  });

  it("HEIGHT mode updates height when wrapping", () => {
    const node = { ...figmaTextNode(120, "auto-height"), height: 24 };
    const patch = textLayoutPatchForNode(node, node.content ?? "");
    assert.ok(patch?.height);
    assert.ok((patch.height ?? 0) > node.height);
  });

  it("still wraps when autoResize disagrees with textResizeMode", () => {
    const node = {
      ...figmaTextNode(60, "auto-height"),
      autoResize: "width-height" as const,
    };
    const prepared = textLayoutForEditorNode(node);
    assert.ok(prepared);
    assert.ok(prepared!.layout.lines.length > 1);
  });

  it("NONE mode keeps fixed height", () => {
    const node = figmaTextNode(60, "fixed");
    const patch = textLayoutPatchForNode(node, node.content ?? "");
    assert.equal(patch, null);
  });

  it("WIDTH_AND_HEIGHT does not wrap except explicit newlines", () => {
    const node = figmaTextNode(60, "auto-width");
    const layout = textLayoutForEditorNode(node);
    assert.ok(layout);
    assert.equal(layout!.layout.lines.length, 1);
  });

  it("SVG display and layout share the same line count", () => {
    for (const width of [300, 120, 60]) {
      const node = figmaTextNode(width);
      const prepared = textLayoutForEditorNode(node);
      assert.ok(prepared);
      const svg = svgTextMarkup(node);
      assert.equal(countTspans(svg), prepared!.layout.lines.length);
    }
  });
});
