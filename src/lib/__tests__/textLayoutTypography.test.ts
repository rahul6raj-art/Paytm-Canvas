import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTO_LINE_HEIGHT_MULTIPLIER,
  isAutoLineHeight,
  lineHeightUnitFromNode,
  resolveLineHeightPx,
} from "@/lib/text/lineHeight";
import {
  clampLetterSpacingPx,
  defaultLetterSpacingPatch,
  resolveLetterSpacingPx,
} from "@/lib/text/letterSpacing";
import { lineHeightFromNode, letterSpacingFromNode } from "@/lib/text/textStyleModel";
import {
  layoutText,
  layoutTextContentHeight,
  lineBaselineY,
  measureStringWidthForTypo,
  resolveLayoutLineHeightPx,
} from "@/lib/text/textMeasure";
import { hugContentHeightForLayout } from "@/lib/text/textBaseline";
import { computeTextBoxSize, withTextLayoutPatch } from "@/lib/text/textLayout";
import { resolveTextTypo } from "@/lib/textTypography";
import { nodeToReactStyle } from "@/lib/codeRoundTrip/reactStyle";
import type { EditorNode } from "@/stores/useEditorStore";

function baseTypo(overrides: Partial<ReturnType<typeof resolveTextTypo>> = {}) {
  return {
    color: "#000",
    fontFamily: "Inter, sans-serif",
    fontSize: 20,
    fontWeight: 400,
    lineHeight: 1.2,
    lineHeightUnit: "auto" as const,
    lineHeightPx: 24,
    letterSpacing: 0,
    ...overrides,
  };
}

function textNode(partial: Partial<EditorNode> = {}): EditorNode {
  return {
    id: "t1",
    type: "text",
    x: 0,
    y: 0,
    width: 200,
    height: 80,
    content: "Hello world",
    ...partial,
  } as EditorNode;
}

describe("text layout typography", () => {
  describe("line height", () => {
    it("auto fallback uses rounded fontSize × 1.2 when metrics unavailable", () => {
      assert.equal(resolveLineHeightPx(20, undefined, "auto"), Math.round(20 * AUTO_LINE_HEIGHT_MULTIPLIER));
    });

    it("px line height sets exact baseline gap", () => {
      const typo = baseTypo({
        fontSize: 20,
        lineHeightUnit: "px",
        lineHeightPx: 24,
        lineHeight: 1.2,
      });
      assert.equal(resolveLayoutLineHeightPx(typo), 24);
      const layout = layoutText("Line one\nLine two", 200, typo);
      assert.equal(layout.lineHeightPx, 24);
      const gap = lineBaselineY(layout, 1) - lineBaselineY(layout, 0);
      assert.equal(gap, 24);
    });

    it("percent line height resolves to fontSize × percent", () => {
      const typo = baseTypo({
        fontSize: 20,
        lineHeightUnit: "percent",
        lineHeightPx: 30,
        lineHeight: 1.5,
      });
      assert.equal(resolveLayoutLineHeightPx(typo), 30);
      const layout = layoutText("A\nB", 200, typo);
      assert.equal(lineBaselineY(layout, 1) - lineBaselineY(layout, 0), 30);
    });

    it("auto-height text uses line box stepping between lines", () => {
      const typo = baseTypo({
        fontSize: 20,
        lineHeightUnit: "px",
        lineHeightPx: 30,
      });
      const layout = layoutText("Alpha\nBeta\nGamma", 200, typo);
      const expected = layout.lines.length * layout.lineHeightPx;
      assert.equal(layoutTextContentHeight(layout), expected);
      assert.equal(hugContentHeightForLayout(layout, typo), expected);
    });

    it("line height does not change word wrapping", () => {
      const text = "abcdefghij";
      const narrow = 55;
      const tight = baseTypo({ lineHeightUnit: "px", lineHeightPx: 16 });
      const loose = baseTypo({ lineHeightUnit: "px", lineHeightPx: 48 });
      const tightLayout = layoutText(text, narrow, tight);
      const looseLayout = layoutText(text, narrow, loose);
      assert.deepEqual(
        tightLayout.lines.map((l) => l.text),
        looseLayout.lines.map((l) => l.text),
      );
    });

    it("existing text layers default line height to auto", () => {
      assert.equal(isAutoLineHeight({}), true);
      assert.equal(lineHeightUnitFromNode({}), "auto");
      assert.deepEqual(lineHeightFromNode({}), { mode: "auto" });
      const typo = resolveTextTypo({ fontSize: 14 });
      assert.equal(typo.lineHeightUnit, "auto");
    });

    it("16px font, 24px lineHeight, 3 lines → height = 3×24", () => {
      const typo = resolveTextTypo({ fontSize: 16, lineHeight: 24, lineHeightUnit: "px" });
      assert.equal(typo.lineHeightPx, 24);
      const layout = layoutText("one\ntwo\nthree", 200, typo);
      assert.equal(layoutTextContentHeight(layout), 24 * 3);
    });

    it("20px font, 150% lineHeight → resolved 30px baseline gap", () => {
      assert.equal(resolveLineHeightPx(20, 150, "percent"), 30);
      const typo = resolveTextTypo({ fontSize: 20, lineHeight: 150, lineHeightUnit: "percent" });
      assert.equal(typo.lineHeightPx, 30);
    });

    it("single-line auto-width grows with explicit line height", () => {
      const node = textNode({
        textResizeMode: "auto-width",
        fontSize: 16,
        lineHeight: 24,
        lineHeightUnit: "px",
        content: "Hi",
      });
      const tight = withTextLayoutPatch(node, { lineHeight: 24, lineHeightUnit: "px" });
      const loose = withTextLayoutPatch(
        { ...node, ...tight },
        { lineHeight: 48, lineHeightUnit: "px" },
      );
      assert.ok((loose.height ?? 0) > (tight.height ?? 0));
      assert.ok((loose.height ?? 0) >= 48);
    });

    it("single-line layout respects explicit line height box", () => {
      const typo = resolveTextTypo({ fontSize: 16, lineHeight: 48, lineHeightUnit: "px" });
      const layout = layoutText("Hi", 200, typo);
      assert.equal(layoutTextContentHeight(layout), 48);
    });

    it("fixed text box does not resize when lineHeight changes", () => {
      const node = textNode({
        textResizeMode: "fixed",
        height: 80,
        content: "a\nb\nc",
        fontSize: 16,
      });
      const patch = withTextLayoutPatch(node, { lineHeight: 48, lineHeightUnit: "px" });
      assert.equal(patch.height, undefined);
    });

    it("auto-height resizes only by baseline gaps between lines", () => {
      const typo = resolveTextTypo({ fontSize: 16, lineHeight: 24, lineHeightUnit: "px" });
      const one = computeTextBoxSize("line", typo, "auto-height", 120, 40);
      const three = computeTextBoxSize("one\ntwo\nthree", typo, "auto-height", 120, one.height);
      assert.ok(three.height > one.height);
      assert.ok(three.height - one.height < 24 * 3);
    });

    it("24px input is not multiplied by fontSize", () => {
      const typo = resolveTextTypo({ fontSize: 16, lineHeight: 24, lineHeightUnit: "px" });
      assert.equal(typo.lineHeightPx, 24);
      assert.notEqual(typo.lineHeightPx, 16 * 24);
    });

    it("150% is not treated as 150px", () => {
      assert.equal(resolveLineHeightPx(20, 150, "percent"), 30);
      assert.notEqual(resolveLineHeightPx(20, 150, "percent"), 150);
    });

    it("first line baseline Y does not gain extra lineHeight above", () => {
      const typo = resolveTextTypo({ fontSize: 16, lineHeight: 24, lineHeightUnit: "px" });
      const layout = layoutText("A\nB", 200, typo);
      assert.equal(lineBaselineY(layout, 0), layout.verticalTrimTop + layout.firstLineAscent);
    });
  });

  describe("letter spacing", () => {
    it("px letter spacing adds width between graphemes", () => {
      const typo = baseTypo({ letterSpacing: 2 });
      const plain = measureStringWidthForTypo("abc", baseTypo());
      const spaced = measureStringWidthForTypo("abc", typo);
      assert.equal(spaced - plain, 4);
    });

    it("percent letter spacing resolves from font size", () => {
      assert.equal(resolveLetterSpacingPx(20, 5, "percent"), 1);
    });

    it("does not add spacing after the last glyph", () => {
      const plainTypo = baseTypo();
      const typo = baseTypo({ letterSpacing: 10 });
      const abPlain = measureStringWidthForTypo("ab", plainTypo);
      const abSpaced = measureStringWidthForTypo("ab", typo);
      assert.ok(Math.abs(abSpaced - abPlain - 10) < 0.01);
    });

    it("wrapping changes with letter spacing", () => {
      const text = "hello world wrap";
      const width = 80;
      const plain = layoutText(text, width, baseTypo()).lines.length;
      const spaced = layoutText(text, width, baseTypo({ letterSpacing: 8 })).lines.length;
      assert.ok(spaced >= plain);
    });

    it("negative letter spacing is clamped", () => {
      assert.equal(clampLetterSpacingPx(-100, 20), -5);
      assert.equal(clampLetterSpacingPx(-2, 20), -2);
    });

    it("auto-width grows with letter spacing", () => {
      const plain = layoutText("abc", Number.POSITIVE_INFINITY, baseTypo()).width;
      const spaced = layoutText("abc", Number.POSITIVE_INFINITY, baseTypo({ letterSpacing: 5 })).width;
      assert.ok(Math.abs(spaced - plain - 10) < 0.01);
    });

    it("caret positions account for letter spacing", () => {
      const typo = baseTypo({ letterSpacing: 10 });
      const wA = measureStringWidthForTypo("a", typo);
      const wAB = measureStringWidthForTypo("ab", typo);
      const wB = measureStringWidthForTypo("b", baseTypo());
      assert.ok(wAB - wA - wB >= 9);
    });

    it("existing text layers default letter spacing to 0px", () => {
      assert.deepEqual(letterSpacingFromNode({}), { mode: "px", value: 0 });
      assert.deepEqual(defaultLetterSpacingPatch(), {
        letterSpacing: 0,
        letterSpacingUnit: "px",
      });
      assert.equal(resolveTextTypo({ fontSize: 14 }).letterSpacing, 0);
    });

    it("export includes letter spacing and resolved line height", () => {
      const node = textNode({
        fontSize: 20,
        lineHeight: 24,
        lineHeightUnit: "px",
        letterSpacing: 2,
        letterSpacingUnit: "px",
      });
      const style = nodeToReactStyle(node, {});
      assert.equal(style.lineHeight, "24px");
      assert.equal(style.letterSpacing, "2px");
    });
  });
});
