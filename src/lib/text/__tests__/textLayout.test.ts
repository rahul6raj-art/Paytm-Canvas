import { before, describe, it } from "node:test";
import assert from "node:assert/strict";

function installTextMeasureDomStub(): void {
  if (typeof globalThis.document !== "undefined") return;

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
import type { EditorNode } from "@/stores/useEditorStore";
import { resolveTextTypo } from "@/lib/textTypography";
import {
  computeTextBoxSize,
  patchAffectsTextLayout,
  textLayoutPatchForNode,
  withTextLayoutPatch,
} from "@/lib/text/textLayout";
import { TEXT_BOX_PAD_X, TEXT_BOX_PAD_Y } from "@/lib/text/textNodeModel";

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
  before(() => {
    installTextMeasureDomStub();
  });

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

  it("auto-width grows height when content has line breaks", () => {
    const typo = resolveTextTypo({ fontSize: 14, lineHeight: 1.25 });
    const oneLine = computeTextBoxSize("hello", typo, "auto-width", 0, 0);
    const twoLines = computeTextBoxSize("hello\nworld", typo, "auto-width", oneLine.width, oneLine.height);
    assert.ok(twoLines.height > oneLine.height);
  });

  it("switches narrowed auto-width text to wrapped auto-height on width resize", () => {
    const node = {
      ...textNode(),
      textResizeMode: "auto-width" as const,
      autoResize: "width-height" as const,
      content: "hello world",
      width: 120,
      height: 20,
    };
    const patch = withTextLayoutPatch(node, { width: 48 });
    assert.equal(patch.textResizeMode, "auto-height");
    assert.equal(patch.autoResize, "height");
    assert.equal(patch.width, 48);
    assert.ok((patch.height ?? 0) > 20);
  });

  it("keeps auto-width when typing widens the text box", () => {
    const node = {
      ...textNode(),
      textResizeMode: "auto-width" as const,
      autoResize: "width-height" as const,
      content: "",
      width: 10,
      height: 22,
    };
    const patch = withTextLayoutPatch(node, {
      content: "Hello",
      width: 45,
      height: 22,
    });
    assert.notEqual(patch.textResizeMode, "auto-height");
    assert.ok((patch.width ?? 0) > 10);
  });

  it("grows width from layout sync without switching to auto-height", () => {
    const node = {
      ...textNode(),
      textResizeMode: "auto-width" as const,
      content: "Hi",
      width: 10,
      height: 22,
    };
    const patch = withTextLayoutPatch(node, { width: 30 });
    assert.notEqual(patch.textResizeMode, "auto-height");
    assert.ok((patch.width ?? 0) > node.width);
  });

  it("expands auto-width frame when typing into caret-only point text", () => {
    const node = {
      ...textNode(),
      textResizeMode: "auto-width" as const,
      content: "",
      width: 10,
      height: 22,
    };
    const patch = textLayoutPatchForNode(node, "S");
    assert.ok((patch?.width ?? 0) > 10);
    assert.notEqual(patch?.textResizeMode, "auto-height");
  });

  it("auto-height keeps user width so text wraps when the frame is narrowed", () => {
    const typo = resolveTextTypo({ fontSize: 14, lineHeight: 1.25 });
    const wide = computeTextBoxSize("sdfdsgfdsg dsg", typo, "auto-width", 0, 0);
    const narrow = computeTextBoxSize("sdfdsgfdsg dsg", typo, "auto-height", 40, wide.height);
    assert.equal(narrow.width, 40);
    assert.ok(narrow.height > wide.height);
  });

  it("uses caret-only size for empty auto-width point text", () => {
    const typo = resolveTextTypo({ fontSize: 14, lineHeight: 1.25 });
    const empty = computeTextBoxSize("", typo, "auto-width", 0, 0);
    const withChar = computeTextBoxSize("R", typo, "auto-width", empty.width, empty.height);
    const cleared = computeTextBoxSize("", typo, "auto-width", withChar.width, withChar.height);
    assert.ok(empty.width < withChar.width);
    assert.equal(cleared.width, empty.width);
    assert.equal(cleared.height, empty.height);
    assert.equal(empty.width, TEXT_BOX_PAD_X * 2 + 2);
    assert.ok(empty.height >= typo.fontSize * typo.lineHeight + TEXT_BOX_PAD_Y * 2);
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
