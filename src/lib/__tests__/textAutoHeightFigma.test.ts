import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import type { EditorNode } from "@/stores/useEditorStore";
import { resolveAutoLineHeightPx } from "@/lib/text/lineHeight";
import { computeTextBoxSize, withTextLayoutPatch } from "@/lib/text/textLayout";
import {
  layoutText,
  layoutTextFrameContentHeight,
  resolveLayoutLineHeightPx,
} from "@/lib/text/textMeasure";
import { hugContentHeightForLayout } from "@/lib/text/textBaseline";
import { resolveTextTypo } from "@/lib/textTypography";
import type { TextResizeMode } from "@/lib/text/textNodeModel";
import { TEXT_BOX_PAD_Y } from "@/lib/text/textNodeModel";

function installTextMeasureDomStub(): void {
  const ctx = {
    font: "",
    textBaseline: "alphabetic",
    measureText(_text: string) {
      return {
        width: 7,
        actualBoundingBoxAscent: 11,
        actualBoundingBoxDescent: 10,
        fontBoundingBoxAscent: 11,
        fontBoundingBoxDescent: 10,
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

function textNode(partial: Partial<EditorNode> = {}): EditorNode {
  return {
    id: "t1",
    type: "text",
    x: 0,
    y: 0,
    width: 120,
    height: 80,
    content: "Hello",
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: 400,
    lineHeightUnit: "auto",
    textResizeMode: "auto-width",
    ...partial,
  } as EditorNode;
}

describe("Figma auto-height text frame sizing", () => {
  before(() => {
    installTextMeasureDomStub();
  });

  it("auto line height rounds fontSize × 1.2 like Figma", () => {
    assert.equal(resolveAutoLineHeightPx(14), 17);
    assert.equal(resolveAutoLineHeightPx(16), 19);
    assert.equal(resolveAutoLineHeightPx(24), 29);
  });

  it("resolveLayoutLineHeightPx uses typography, not glyph bbox metrics", () => {
    const typo = resolveTextTypo({ fontSize: 14, lineHeightUnit: "auto" });
    assert.equal(typo.lineHeightPx, 17);
    assert.equal(resolveLayoutLineHeightPx(typo), 17);
  });

  it("single-line frame height equals resolved line height, not bbox sum", () => {
    const typo = resolveTextTypo({
      fontSize: 14,
      fontFamily: "Inter",
      fontWeight: 400,
      lineHeightUnit: "auto",
    });
    const layout = layoutText("Rahul", Number.POSITIVE_INFINITY, typo);
    assert.equal(layoutTextFrameContentHeight(layout), 17);
    assert.equal(hugContentHeightForLayout(layout, typo), 17);

    const autoWidth = computeTextBoxSize("Rahul", typo, "auto-width", 0, 0);
    assert.equal(autoWidth.height, 17);

    const autoHeight = computeTextBoxSize("Rahul", typo, "auto-height", 80, 40);
    assert.equal(autoHeight.height, 17);
  });

  it("multi-line auto-height grows by line boxes only", () => {
    const typo = resolveTextTypo({ fontSize: 14, lineHeightUnit: "auto" });
    const one = computeTextBoxSize("line", typo, "auto-height", 120, 40);
    const three = computeTextBoxSize("one\ntwo\nthree", typo, "auto-height", 120, one.height);
    assert.equal(one.height, 17);
    assert.equal(three.height, 17 * 3);
  });

  it("explicit px line height sets frame height for single line", () => {
    const typo = resolveTextTypo({ fontSize: 16, lineHeight: 48, lineHeightUnit: "px" });
    const layout = layoutText("Hi", 200, typo);
    assert.equal(layoutTextFrameContentHeight(layout), 48);
    const size = computeTextBoxSize("Hi", typo, "auto-width", 0, 0);
    assert.equal(size.height, 48);
  });

  it("fixed-size text keeps user height when typography changes", () => {
    const node = textNode({
      textResizeMode: "fixed",
      height: 80,
      content: "a\nb\nc",
      fontSize: 16,
    });
    const patch = withTextLayoutPatch(node, { lineHeight: 48, lineHeightUnit: "px" });
    assert.equal(patch.height, undefined);
  });

  for (const mode of ["auto-width", "auto-height", "fixed"] as TextResizeMode[]) {
    it(`resize mode ${mode}: auto line height frame uses line box, not bbox`, () => {
      const typo = resolveTextTypo({ fontSize: 14, lineHeightUnit: "auto" });
      const layout = layoutText("wdfd", 200, typo);
      const frameFromLines = layoutTextFrameContentHeight(layout);
      assert.equal(frameFromLines, 17);
      if (mode === "fixed") {
        const size = computeTextBoxSize("wdfd", typo, mode, 120, 80);
        assert.equal(size.height, 80);
      } else {
        const size = computeTextBoxSize("wdfd", typo, mode, 120, 40);
        assert.equal(size.height, 17);
      }
    });
  }

  it("fixed mode keeps vertical inset padding on frame inner layout", () => {
    const typo = resolveTextTypo({ fontSize: 14, lineHeightUnit: "auto" });
    const layout = layoutText("Hi", 100, typo);
    const content = layoutTextFrameContentHeight(layout);
    const fixed = computeTextBoxSize("Hi", typo, "fixed", 100, content + TEXT_BOX_PAD_Y * 2);
    assert.equal(fixed.height, content + TEXT_BOX_PAD_Y * 2);
  });
});
