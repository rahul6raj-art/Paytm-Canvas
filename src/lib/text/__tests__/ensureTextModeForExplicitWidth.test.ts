import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { figTextResizeMode } from "@/lib/figImport/figNodeGeometry";
import {
  layoutTextCanonical,
  textLayoutForEditorNode,
} from "@/lib/text/canonicalTextLayout";
import { ensureTextModeForExplicitWidth } from "@/lib/text/ensureTextModeForExplicitWidth";
import { createPointTextAt } from "@/lib/text/textCreation";
import { svgTextMarkup } from "@/lib/svgMarkupCore";
import { withTextLayoutPatch } from "@/lib/text/textLayout";
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

function longTextNode(
  width: number,
  mode: "auto-width" | "auto-height" | "fixed" = "auto-width",
): EditorNode {
  return {
    id: "t-mode",
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
    autoResize: mode === "auto-width" ? "width-height" : mode === "auto-height" ? "height" : "none",
  };
}

describe("ensureTextModeForExplicitWidth", () => {
  before(() => {
    installTextMeasureDomStub();
  });

  it("1. point text starts as auto-width", () => {
    const { node } = createPointTextAt(10, 10, 40, 20);
    assert.equal(node.textResizeMode, "auto-width");
    assert.equal(node.autoResize, "width-height");
  });

  it("2. direct resize 300 → 100 converts to auto-height and wraps", () => {
    const node = longTextNode(300);
    const patch = ensureTextModeForExplicitWidth(
      { ...node, width: 100 },
      "resize",
      { previousWidth: 300 },
    );
    assert.equal(patch.textResizeMode, "auto-height");
    assert.equal(patch.autoResize, "height");
    const merged = { ...node, ...patch, width: 100 };
    const layout = textLayoutForEditorNode(merged);
    assert.ok(layout);
    assert.ok(layout!.layout.lines.length > 1);
  });

  it("3. inspector width 300 → 100 converts to auto-height and wraps", () => {
    const node = longTextNode(300);
    const patch = withTextLayoutPatch(node, { width: 100 });
    assert.equal(patch.textResizeMode, "auto-height");
    assert.equal(patch.width, 100);
    assert.ok((patch.height ?? 0) > 0);
    const merged = { ...node, ...patch };
    const layout = textLayoutForEditorNode(merged);
    assert.ok(layout);
    assert.ok(layout!.layout.lines.length > 1);
  });

  it("4. auto-layout parent width constraint converts auto-width child and wraps", () => {
    const node = longTextNode(300);
    const patch = ensureTextModeForExplicitWidth(
      { ...node, width: 100 },
      "auto-layout",
      { previousWidth: 300 },
    );
    assert.equal(patch.textResizeMode, "auto-height");
    const merged = { ...node, ...patch, width: 100 };
    const layout = textLayoutForEditorNode(merged);
    assert.ok(layout);
    assert.ok(layout!.layout.lines.length > 1);
  });

  it("5. auto-height text continues wrapping normally", () => {
    const wide = textLayoutForEditorNode(longTextNode(300, "auto-height"));
    const narrow = textLayoutForEditorNode(longTextNode(100, "auto-height"));
    assert.ok(wide);
    assert.ok(narrow);
    assert.equal(wide!.layout.lines.length, 1);
    assert.ok(narrow!.layout.lines.length > 1);
  });

  it("6. fixed text wraps but height remains fixed", () => {
    const node = longTextNode(60, "fixed");
    const layout = textLayoutForEditorNode(node);
    assert.ok(layout);
    assert.ok(layout!.layout.lines.length > 1);
    const patch = ensureTextModeForExplicitWidth(
      { ...node, width: 40 },
      "inspector",
      { previousWidth: 60 },
    );
    assert.equal(patch.height, undefined);
    assert.equal(patch.textResizeMode, undefined);
  });

  it("7. auto-width text with no explicit width still does not wrap", () => {
    const node = longTextNode(60, "auto-width");
    const layout = textLayoutForEditorNode(node);
    assert.ok(layout);
    assert.equal(layout!.layout.lines.length, 1);
    const patch = ensureTextModeForExplicitWidth(node, "inspector", { previousWidth: 60 });
    assert.deepEqual(patch, {});
  });

  it("8. SVG display and TextCanvasView layout share the same line count", () => {
    for (const width of [300, 120, 60]) {
      const node = longTextNode(width, "auto-height");
      const prepared = textLayoutForEditorNode(node);
      assert.ok(prepared);
      const svg = svgTextMarkup(node);
      assert.equal(countTspans(svg), prepared!.layout.lines.length);
    }
  });

  it("9. cache invalidates after mode conversion", () => {
    const node = longTextNode(300);
    const before = layoutTextCanonical(node);
    assert.ok(before);
    assert.equal(before!.lines.length, 1);
    const patch = ensureTextModeForExplicitWidth(
      { ...node, width: 100 },
      "resize",
      { previousWidth: 300 },
    );
    const merged = { ...node, ...patch, width: 100 };
    const after = layoutTextCanonical(merged);
    assert.ok(after);
    assert.ok(after!.lines.length > 1);
  });

  it("10. imported Figma WIDTH_AND_HEIGHT stays auto-width until constrained", () => {
    const mode = figTextResizeMode({ textAutoResize: "WIDTH_AND_HEIGHT" } as never);
    assert.equal(mode, "auto-width");
    const node = longTextNode(300, "auto-width");
    assert.deepEqual(
      ensureTextModeForExplicitWidth(node, "inspector", { previousWidth: 300 }),
      {},
    );
    const patch = ensureTextModeForExplicitWidth(
      { ...node, width: 100 },
      "resize",
      { previousWidth: 300 },
    );
    assert.equal(patch.textResizeMode, "auto-height");
  });

  it("does not convert auto-width when inspector widens the box", () => {
    const node = { ...longTextNode(10), content: "Hi" };
    const patch = withTextLayoutPatch(node, { width: 30 });
    assert.notEqual(patch.textResizeMode, "auto-height");
  });
});
