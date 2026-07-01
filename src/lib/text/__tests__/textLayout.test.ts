import { before, describe, it } from "node:test";
import assert from "node:assert/strict";

function installTextMeasureDomStub(): void {
  const ctx = {
    font: "",
    textBaseline: "alphabetic",
    measureText(text: string) {
      return {
        width: text.length * 7,
        actualBoundingBoxAscent: 11,
        actualBoundingBoxDescent: 3,
        fontBoundingBoxAscent: 11,
        fontBoundingBoxDescent: 3,
      };
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
import { layoutText, lineBaselineY, lineTopY } from "@/lib/text/textMeasure";
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
    assert.equal(next.autoResize, "none");
  });

  it("auto-width grows height when content has line breaks", () => {
    const typo = resolveTextTypo({ fontSize: 14, lineHeight: 1.25 });
    const oneLine = computeTextBoxSize("hello", typo, "auto-width", 0, 0);
    const twoLines = computeTextBoxSize("hello\nworld", typo, "auto-width", oneLine.width, oneLine.height);
    assert.ok(twoLines.height > oneLine.height);
  });

  it("auto-width frame height matches resolved line height box", () => {
    const typo = resolveTextTypo({ fontSize: 14, lineHeightUnit: "auto", fontWeight: 500 });
    const size = computeTextBoxSize("Rahul", typo, "auto-width", 0, 0);
    assert.equal(size.height, typo.lineHeightPx);
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
    // Empty caret-only shell width (Figma-style zero padding → just the caret inner width).
    const shell = computeTextBoxSize("", resolveTextTypo(textNode()), "auto-width", 0, 0).width;
    const node = {
      ...textNode(),
      textResizeMode: "auto-width" as const,
      content: "",
      width: shell,
      height: 22,
    };
    const patch = textLayoutPatchForNode(node, "S");
    assert.ok((patch?.width ?? 0) > shell);
    assert.notEqual(patch?.textResizeMode, "auto-height");
  });

  it("auto-height keeps user width so text wraps when the frame is narrowed", () => {
    const typo = resolveTextTypo({ fontSize: 14, lineHeight: 1.25 });
    const wide = computeTextBoxSize("sdfdsgfdsg dsg", typo, "auto-width", 0, 0);
    const narrow = computeTextBoxSize("sdfdsgfdsg dsg", typo, "auto-height", 40, wide.height);
    assert.equal(narrow.width, 40);
    assert.ok(narrow.height > wide.height);
  });

  it("computeTextBoxSize works without DOM during bridge import", () => {
    const prev = globalThis.document;
    // @ts-expect-error SSR has no document
    delete globalThis.document;
    try {
      const typo = resolveTextTypo({ fontSize: 14, lineHeight: 1.25, fontWeight: 500 });
      const size = computeTextBoxSize("More", typo, "auto-width", 0, 0);
      assert.ok(size.width > TEXT_BOX_PAD_X * 2);
      assert.ok(size.height >= typo.lineHeightPx);
    } finally {
      globalThis.document = prev;
    }
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
    assert.equal(empty.height, Math.ceil(typo.lineHeightPx));
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
    assert.equal(patch, null);
  });

  it("fixed mode keeps height when width changes", () => {
    const node = {
      ...textNode(),
      textResizeMode: "fixed" as const,
      autoResize: "none" as const,
      content: "hello world wrap test",
      width: 120,
      height: 48,
    };
    const patch = withTextLayoutPatch(node, { width: 48 });
    assert.equal(patch.width, 48);
    assert.equal(patch.height, undefined);
    assert.notEqual(patch.textResizeMode, "auto-height");
  });

  it("auto-height unwraps and shrinks height when width widens", () => {
    const typo = resolveTextTypo({ fontSize: 14, lineHeight: 1.25 });
    const narrow = computeTextBoxSize("hello world test", typo, "auto-height", 40, 40);
    const wide = computeTextBoxSize("hello world test", typo, "auto-height", 200, narrow.height);
    assert.ok(wide.height <= narrow.height);
    assert.equal(wide.width, 200);
  });

  it("wraps long words at character boundaries", () => {
    const typo = resolveTextTypo({ fontSize: 14, lineHeight: 1.25 });
    const layout = layoutText("superlongword", 22, typo);
    assert.ok(layout.lines.length > 1);
  });
});

describe("half-leading line positioning (Figma/browser vertical centering)", () => {
  before(() => {
    installTextMeasureDomStub();
  });

  it("centers the glyph em box within the line box (half-leading above and below)", () => {
    // Stub metrics: ascent 11 + descent 3 = 14 em height. With a 20px line box the leftover
    // 6px of leading must split 3px above / 3px below — like a browser line box / Figma.
    const layout = layoutText("Hello", Number.POSITIVE_INFINITY, resolveTextTypo({ fontSize: 13 }));
    const withBox = { ...layout, lineHeightPx: 20, firstLineAscent: 11, firstLineDescent: 3 };
    // em box top = half-leading (not 0 — that was the "text hugs the top" bug).
    assert.equal(lineTopY(withBox, 0), 3);
    // baseline = em box top + ascent.
    assert.equal(lineBaselineY(withBox, 0), 3 + 11);
  });

  it("stacks subsequent lines by exactly one line height", () => {
    const layout = layoutText("a\nb", Number.POSITIVE_INFINITY, resolveTextTypo({ fontSize: 13 }));
    const withBox = { ...layout, lineHeightPx: 20, firstLineAscent: 11, firstLineDescent: 3 };
    assert.equal(lineTopY(withBox, 1) - lineTopY(withBox, 0), 20);
  });

  it("does not add half-leading when cap-height trim is active", () => {
    const layout = layoutText("Hello", Number.POSITIVE_INFINITY, resolveTextTypo({ fontSize: 13 }));
    const trimmed = {
      ...layout,
      lineHeightPx: 20,
      firstLineAscent: 11,
      firstLineDescent: 3,
      verticalTrimTop: 2,
    };
    // Trim keeps the existing tight top-anchored behavior (verticalTrimTop only).
    assert.equal(lineTopY(trimmed, 0), 2);
  });
});
