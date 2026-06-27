import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveCaretDrawRect, type TextLayout } from "@/lib/text/textMeasure";
import type { ResolvedTextTypo } from "@/lib/textTypography";
import { TEXT_BOX_PAD_X, TEXT_BOX_PAD_Y } from "@/lib/text/textNodeModel";

const typo: ResolvedTextTypo = {
  fontFamily: "Inter, sans-serif",
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.2,
  lineHeightUnit: "auto",
  lineHeightPx: 19.2,
  letterSpacing: 0,
  color: "#000",
};

describe("resolveCaretDrawRect", () => {
  it("does not double-apply padding when canonical caret stops are present", () => {
    const layout: TextLayout = {
      lines: [{ text: "Hi", startIndex: 0, width: 20, paragraphStart: true }],
      width: 20,
      height: 20,
      lineHeightPx: 20,
      firstLineAscent: 13,
      firstLineDescent: 4,
      paragraphSpacing: 0,
      verticalTrimTop: 0,
      caretStops: [
        { index: 0, x: TEXT_BOX_PAD_X, y: TEXT_BOX_PAD_Y },
        { index: 2, x: TEXT_BOX_PAD_X + 20, y: TEXT_BOX_PAD_Y },
      ],
    };

    const atStart = resolveCaretDrawRect(0, layout, typo, 100, "left", TEXT_BOX_PAD_X, TEXT_BOX_PAD_Y, 0);
    assert.equal(atStart.x, TEXT_BOX_PAD_X);
    assert.notEqual(atStart.x, TEXT_BOX_PAD_X * 2);
    assert.equal(atStart.y, TEXT_BOX_PAD_Y);
    assert.equal(atStart.height, layout.lineHeightPx);
  });

  it("uses full line box height for auto line height text", () => {
    const layout: TextLayout = {
      lines: [{ text: "Rahul", startIndex: 0, width: 45, paragraphStart: true }],
      width: 45,
      height: 17,
      lineHeightPx: 17,
      firstLineAscent: 11,
      firstLineDescent: 4,
      paragraphSpacing: 0,
      verticalTrimTop: 0,
      caretStops: [{ index: 5, x: 45, y: 0 }],
    };
    const interTypo: ResolvedTextTypo = {
      ...typo,
      fontSize: 14,
      lineHeightPx: 17,
    };
    const caret = resolveCaretDrawRect(5, layout, interTypo, 45, "left", 0, 0, 0);
    assert.equal(caret.height, 17);
    assert.equal(caret.y, 0);
  });
});
