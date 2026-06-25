import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import {
  fitOpentypePathDToCanvasInk,
  measureCanvasGlyphInkBox,
} from "@/lib/text/textOutlinePlacement";

const interBold = path.join(process.cwd(), "packages/craft-engine/assets/Inter-Bold.ttf");

function createMockMeasureContext(font: opentype.Font) {
  let textBaseline = "alphabetic";
  return {
    font: "",
    get textBaseline() {
      return textBaseline;
    },
    set textBaseline(value: string) {
      textBaseline = value;
    },
    measureText(text: string) {
      const ch = text[0] ?? " ";
      const advance = font.getAdvanceWidth(ch, 14);
      const bb = font.charToGlyph(ch).getPath(0, 0, 14).getBoundingBox();
      const ascent = Math.max(0.001, -bb.y1);
      const descent = Math.max(0.001, bb.y2);
      return {
        width: advance,
        fontBoundingBoxAscent: ascent,
        fontBoundingBoxDescent: descent,
        actualBoundingBoxAscent: ascent,
        actualBoundingBoxDescent: descent,
        actualBoundingBoxLeft: bb.x1,
        actualBoundingBoxRight: bb.x2,
      };
    },
    fillText() {},
  };
}

describe("textOutlinePlacement", () => {
  it("maps canvas ink box from textBaseline top metrics", () => {
    const buffer = fs.readFileSync(interBold);
    const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    globalThis.document = {
      createElement: () => ({ getContext: () => createMockMeasureContext(font) }),
    };

    const typo = {
      color: "#fff",
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 1.25,
      letterSpacing: 0,
    };
    const ink = measureCanvasGlyphInkBox("R", 4, 2, typo);
    assert.ok(ink.top <= 2.5);
    assert.ok(ink.top + ink.height >= 2);
    assert.ok(ink.width > 4);
  });

  it("fits opentype path bbox to canvas ink box", () => {
    const buffer = fs.readFileSync(interBold);
    const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    globalThis.document = {
      createElement: () => ({ getContext: () => createMockMeasureContext(font) }),
    };

    const typo = {
      color: "#fff",
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 1.25,
      letterSpacing: 0,
    };
    const otPath = font.charToGlyph("R").getPath(0, 0, 14);
    const otBbox = otPath.getBoundingBox();
    const ink = measureCanvasGlyphInkBox("R", 4, 2, typo);
    const fitted = fitOpentypePathDToCanvasInk(otPath.toPathData(2), ink, otBbox);
    assert.ok(fitted);
    assert.match(fitted!, /^M/);
  });
});
