import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  resolveLineHeightPx,
  measureFontMetricsFromCanvas,
  opticalVerticalCenterOffset,
} from "@/lib/text/pipeline/fontMetrics";
import { wrapWidthFits, TEXT_WRAP_EPSILON } from "@/lib/text/pipeline/textLineLayout";
import { buildTextPaintPlan } from "@/lib/text/pipeline/textPaintFromLayout";
import { canonicalToTextLayout } from "@/lib/text/canonicalTextLayout";
import type { CanonicalTextLayout } from "@/lib/text/canonicalTextLayout";

function installTextMeasureDomStub(): void {
  const ctx = {
    font: "",
    textBaseline: "alphabetic",
    measureText(text: string) {
      return {
        width: text.length * 7,
        fontBoundingBoxAscent: 12,
        fontBoundingBoxDescent: 3,
        actualBoundingBoxAscent: 11,
        actualBoundingBoxDescent: 3,
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

function sampleCanonical(): CanonicalTextLayout {
  return {
    source: "wasm",
    lines: [
      {
        text: "Hi",
        startIndex: 0,
        width: 20,
        paragraphStart: true,
        x: 4,
        y: 2,
        segments: [{ text: "Hi", x: 4, y: 2 }],
      },
    ],
    width: 20,
    height: 18,
    lineHeightPx: 18,
    paragraphSpacing: 0,
    verticalTrimTop: 0,
    innerW: 40,
    innerH: 16,
    blockOffsetY: 0,
    caretStops: [
      { index: 0, x: 4, y: 2 },
      { index: 1, x: 11, y: 2 },
      { index: 2, x: 18, y: 2 },
    ],
    glyphs: [
      { index: 0, x: 4, y: 2, width: 7, height: 14, glyphId: 1 },
      { index: 1, x: 11, y: 2, width: 7, height: 14, glyphId: 2 },
    ],
    font: {
      requestedFamily: "Inter",
      resolvedFamily: "Inter",
      fallbackUsed: false,
      missing: false,
    },
    rtl: false,
    fontMetrics: {
      ascender: 12,
      descender: 3,
      capHeight: 9,
      xHeight: 7,
      lineGap: 3,
      baselineOffset: 12,
      lineHeightPx: 18,
    },
  };
}

describe("text pipeline", () => {
  before(() => {
    installTextMeasureDomStub();
  });

  it("resolves line height units", () => {
    assert.equal(resolveLineHeightPx(16, 1.25, "percent"), 20);
    assert.equal(resolveLineHeightPx(16, 24, "px"), 24);
    assert.equal(resolveLineHeightPx(16, undefined, "auto"), 16 * 1.2);
  });

  it("uses wrap epsilon for stable line breaks", () => {
    assert.equal(wrapWidthFits(100, 100 + TEXT_WRAP_EPSILON * 0.5), true);
    assert.equal(wrapWidthFits(100 + TEXT_WRAP_EPSILON * 2, 100), false);
  });

  it("measures font metrics from canvas", () => {
    const metrics = measureFontMetricsFromCanvas(
      {
        color: "#000",
        fontFamily: "Inter",
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.25,
        letterSpacing: 0,
      },
      17.5,
    );
    assert.equal(metrics.ascender, 12);
    assert.equal(metrics.baselineOffset, 12);
    assert.ok(opticalVerticalCenterOffset(metrics) !== 0);
  });

  it("builds paint plan from shaped glyphs", () => {
    const canonical = sampleCanonical();
    const layout = canonicalToTextLayout(canonical);
    const node: EditorNode = {
      id: "t1",
      type: "text",
      parentId: null,
      name: "T",
      x: 0,
      y: 0,
      width: 48,
      height: 24,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      content: "Hi",
      textResizeMode: "auto-width",
    };
    const plan = buildTextPaintPlan(
      {
        layout,
        canonical,
        typo: {
          color: "#000",
          fontFamily: "Inter",
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.25,
          letterSpacing: 0,
        },
        textAlign: "left",
        innerW: canonical.innerW,
        innerH: canonical.innerH,
        blockOffsetY: 0,
        style: {
          paragraphSpacing: 0,
          textCase: "original",
          verticalTrim: "none",
          textTruncate: "none",
          textDecoration: "none",
          listStyle: "none",
        },
        debug: {
          cacheKey: "k",
          wrapEnabled: false,
          availableWidth: 40,
          lineWidths: [20],
        },
      },
      canonical.fontMetrics!,
      node,
    );
    assert.equal(plan.lines[0]?.glyphs.length, 2);
    assert.equal(plan.lines[0]?.baseline, 2 + 12);
  });
});
