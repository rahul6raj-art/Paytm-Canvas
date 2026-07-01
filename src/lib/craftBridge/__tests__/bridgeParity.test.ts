import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { canonicalFromBrowserCapture } from "@/lib/craftBridge/browserCaptureTextLayout";
import { diffRgbaBuffers, pixelReportToScore } from "@/lib/craftBridge/bridgeParityDiff";
import { textAdvancedStyleFromNode } from "@/lib/text/textAdvancedStyle";
import { textTypoFromModel, toTextNodeModel } from "@/lib/text/textNodeModel";

describe("browserCaptureTextLayout", () => {
  it("builds browserPaint canonical from captured lines and glyphs", () => {
    const node = {
      id: "t1",
      type: "text",
      name: "Stocks",
      x: 0,
      y: 0,
      width: 48,
      height: 14,
      content: "Stocks",
      fontSize: 12,
      fontFamily: "Inter",
      fontWeight: 500,
      textResizeMode: "fixed",
    } as EditorNode;

    const capture = {
      content: "Stocks",
      lines: [
        {
          text: "Stocks",
          startIndex: 0,
          x: 4,
          y: 2,
          width: 40,
          height: 12,
          baselineY: 13,
        },
      ],
      glyphs: [
        { index: 0, x: 4, y: 2, width: 7, height: 12 },
        { index: 1, x: 11, y: 2, width: 6, height: 12 },
        { index: 2, x: 17, y: 2, width: 6, height: 12 },
        { index: 3, x: 23, y: 2, width: 6, height: 12 },
        { index: 4, x: 29, y: 2, width: 6, height: 12 },
        { index: 5, x: 35, y: 2, width: 6, height: 12 },
      ],
    };

    const model = toTextNodeModel(node, false)!;
    const typo = textTypoFromModel(model);
    const style = textAdvancedStyleFromNode(node);
    const canonical = canonicalFromBrowserCapture(node, capture, typo, style);

    assert.ok(canonical);
    assert.equal(canonical!.browserPaint, true);
    assert.equal(canonical!.lines.length, 1);
    assert.equal(canonical!.lines[0]!.segments.length, 6);
    assert.equal(canonical!.glyphs.length, 6);
    assert.equal(canonical!.lineBoxes[0]!.baseline, 13);
  });
});

describe("bridgeParityDiff", () => {
  it("reports zero diff for identical buffers", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
    const report = diffRgbaBuffers(
      { width: 2, height: 1, data },
      { width: 2, height: 1, data: data.slice() },
    );
    assert.equal(report.diffPixels, 0);
    assert.equal(report.diffPercent, 0);
    assert.equal(pixelReportToScore(report), 100);
  });

  it("counts differing pixels", () => {
    const a = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    const b = new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]);
    const report = diffRgbaBuffers(
      { width: 2, height: 1, data: a },
      { width: 2, height: 1, data: b },
    );
    assert.equal(report.diffPixels, 1);
    assert.equal(report.totalPixels, 2);
  });
});
