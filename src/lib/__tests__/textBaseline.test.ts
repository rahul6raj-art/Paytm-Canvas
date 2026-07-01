import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { svgTextTspanY, textBaselineLocalY } from "@/lib/text/textBaseline";
import { canvasAlphabeticBaselineY } from "@/lib/text/textMeasure";
import type { EditorNode } from "@/stores/useEditorStore";

function installTextMeasureDomStub(): void {
  if (typeof globalThis.document !== "undefined") return;

  const ctx = {
    font: "",
    measureText(text: string) {
      return {
        width: text.length * 7,
        fontBoundingBoxAscent: 11,
        actualBoundingBoxAscent: 11,
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

describe("textBaseline", () => {
  it("maps canvas line-top y to svg alphabetic y", () => {
    installTextMeasureDomStub();
    const typo = {
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 1.25,
      lineHeightPx: 17.5,
      letterSpacing: 0,
      color: "#000",
    };
    assert.equal(svgTextTspanY(2, typo), canvasAlphabeticBaselineY(2, 17.5, typo));
  });

  it("returns a baseline below the top padding", () => {
    installTextMeasureDomStub();
    const node = {
      id: "t1",
      type: "text",
      x: 0,
      y: 0,
      width: 200,
      height: 80,
      content: "Rahul Raj",
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 1.25,
      textResizeMode: "fixed",
      verticalAlign: "top",
    } as EditorNode;

    const y = textBaselineLocalY(node);
    assert.ok(y != null);
    assert.ok(y! > 2);
    assert.ok(y! < 40);
  });

  it("baseline follows vertical alignment using the same layout as rendering", () => {
    installTextMeasureDomStub();
    const base = {
      id: "t1",
      type: "text",
      x: 0,
      y: 0,
      width: 200,
      height: 80,
      content: "Rahul",
      fontSize: 20,
      fontWeight: 500,
      lineHeightUnit: "auto",
      textResizeMode: "fixed",
    } as EditorNode;

    const topY = textBaselineLocalY({ ...base, verticalAlign: "top" });
    const middleY = textBaselineLocalY({ ...base, verticalAlign: "middle" });
    const bottomY = textBaselineLocalY({ ...base, verticalAlign: "bottom" });

    assert.ok(topY != null && middleY != null && bottomY != null);
    assert.ok(middleY! > topY!);
    assert.ok(bottomY! > middleY!);
    assert.ok(Math.abs(middleY! - topY! - (bottomY! - middleY!)) < 0.05);
  });

  it("baseline tracks vertical align in auto-width frames without vertical inset", () => {
    installTextMeasureDomStub();
    const frameHeight = 34;
    const base = {
      id: "t1",
      type: "text",
      x: 0,
      y: 0,
      width: 47,
      height: frameHeight,
      content: "Rahul",
      fontSize: 14,
      fontWeight: 500,
      lineHeightUnit: "auto",
      textResizeMode: "auto-width",
    } as EditorNode;

    const lineHeight = 17;
    const expectedBottomOffset = frameHeight - lineHeight;

    const topBaseline = textBaselineLocalY({ ...base, verticalAlign: "top" });
    const bottomBaseline = textBaselineLocalY({ ...base, verticalAlign: "bottom" });
    assert.ok(topBaseline != null && bottomBaseline != null);
    assert.ok(bottomBaseline! - topBaseline! > expectedBottomOffset - 1);
    assert.equal(bottomBaseline! - topBaseline!, expectedBottomOffset);
  });
});
