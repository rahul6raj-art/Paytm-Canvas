import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  computeTextResizeModePatch,
  setTextResizeModeForNode,
  textResizeLayoutSnapshot,
} from "@/lib/text/setTextResizeModeForNode";
import { setTextResizeMode } from "@/lib/text/setTextResizeMode";
import { withTextLayoutPatch } from "@/lib/text/textLayout";
import { availableWrapWidthForNode, nodeForTextLayout } from "@/lib/text/textNodeModel";

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

const CONTENT = "Hello World from Figma";

function textNode(
  width: number,
  height: number,
  mode: "auto-width" | "auto-height" | "fixed" = "auto-width",
): EditorNode {
  return {
    id: "t-resize",
    parentId: "frame1",
    type: "text",
    name: "Label",
    x: 0,
    y: 0,
    width,
    height,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content: CONTENT,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.25,
    textResizeMode: mode,
  };
}

function applyPatch(node: EditorNode, patch: Partial<EditorNode>): EditorNode {
  return { ...node, ...patch };
}

function setTextResizeModeForNodeHelper(
  node: EditorNode,
  mode: "auto-width" | "auto-height" | "fixed",
) {
  const patch = setTextResizeModeForNode(node, mode);
  const next = applyPatch(node, patch);
  return { patch, next };
}

describe("setTextResizeModeForNode acceptance", () => {
  before(() => {
    installTextMeasureDomStub();
  });

  it("auto-width uses infinite wrap and single line at width 100", () => {
    let node = textNode(100, 40);
    const { patch, next } = setTextResizeModeForNodeHelper(node, "auto-width");
    node = next;

    assert.equal(patch.textResizeMode, "auto-width");
    assert.equal(patch.autoResize, "width-height");
    const wrap = availableWrapWidthForNode(nodeForTextLayout(node));
    assert.equal(wrap, Number.POSITIVE_INFINITY);
    assert.equal(textResizeLayoutSnapshot(node).lineCount, 1);
  });

  it("auto-height at width 100 wraps and grows height", () => {
    let node = textNode(100, 20, "auto-height");
    const heightBefore = node.height;
    const { patch, next } = setTextResizeModeForNodeHelper(node, "auto-height");
    node = next;

    assert.equal(patch.textResizeMode, "auto-height");
    assert.equal(patch.autoResize, "height");
    const wrap = availableWrapWidthForNode(nodeForTextLayout(node));
    assert.notEqual(wrap, Number.POSITIVE_INFINITY);
    const layout = textResizeLayoutSnapshot(node);
    assert.ok(layout.lineCount > 1);
    assert.ok((patch.height ?? node.height) > heightBefore);
  });

  it("fixed at width 100 wraps without changing height", () => {
    let node = textNode(100, 80, "auto-height");
    const heightBefore = node.height;
    const { patch, next } = setTextResizeModeForNodeHelper(node, "fixed");
    node = next;

    assert.equal(patch.textResizeMode, "fixed");
    assert.equal(patch.autoResize, "none");
    assert.equal(patch.height, undefined);
    assert.equal(node.height, heightBefore);
    const wrap = availableWrapWidthForNode(nodeForTextLayout(node));
    assert.notEqual(wrap, Number.POSITIVE_INFINITY);
    assert.ok(textResizeLayoutSnapshot(node).lineCount > 1);
  });

  it("full mode sequence keeps store fields in sync via withTextLayoutPatch", () => {
    let node = textNode(100, 40);

    let patch = withTextLayoutPatch(node, { textResizeMode: "auto-width" });
    node = applyPatch(node, patch);
    assert.equal(availableWrapWidthForNode(nodeForTextLayout(node)), Number.POSITIVE_INFINITY);

    node = applyPatch(node, { width: 100 });
    patch = withTextLayoutPatch(node, { textResizeMode: "auto-height" });
    node = applyPatch(node, patch);
    assert.equal(node.textResizeMode, "auto-height");
    assert.equal(node.autoResize, "height");
    assert.notEqual(availableWrapWidthForNode(nodeForTextLayout(node)), Number.POSITIVE_INFINITY);
    assert.ok(textResizeLayoutSnapshot(node).lineCount > 1);

    const heightBeforeFixed = node.height;
    patch = withTextLayoutPatch(node, { textResizeMode: "fixed" });
    node = applyPatch(node, patch);
    assert.equal(node.textResizeMode, "fixed");
    assert.equal(node.autoResize, "none");
    assert.equal(node.height, heightBeforeFixed);
    assert.notEqual(availableWrapWidthForNode(nodeForTextLayout(node)), Number.POSITIVE_INFINITY);
  });
});

describe("setTextResizeMode", () => {
  before(() => {
    installTextMeasureDomStub();
  });

  it("auto-width shrinks box to single-line content", () => {
    const shortNode = {
      ...textNode(120, 80),
      content: "short",
      textResizeMode: "auto-height" as const,
    };
    const patch = setTextResizeMode(shortNode, "auto-width");
    assert.equal(patch.textResizeMode, "auto-width");
    assert.equal(patch.autoResize, "width-height");
    assert.ok((patch.width ?? 0) < 120);
  });

  it("withTextLayoutPatch mode change via textResizeMode uses setTextResizeMode", () => {
    const node = { ...textNode(60, 24), content: "hello world wrap test" };
    const patch = withTextLayoutPatch(node, { textResizeMode: "auto-height" });
    assert.equal(patch.textResizeMode, "auto-height");
    assert.ok((patch.height ?? 0) > node.height);
  });

  it("canonical full resize patch does not re-trigger explicit-height mode conversion", () => {
    const node = textNode(100, 20, "auto-width");
    const canonical = setTextResizeModeForNode(node, "auto-height");
    const patch = withTextLayoutPatch(node, canonical);
    assert.equal(patch.textResizeMode, "auto-height");
    assert.equal(patch.autoResize, "height");
    assert.notEqual(availableWrapWidthForNode(applyPatch(node, patch)), Number.POSITIVE_INFINITY);
  });
});
