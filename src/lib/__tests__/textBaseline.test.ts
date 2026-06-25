import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { svgTextTspanY, textBaselineLocalY } from "@/lib/text/textBaseline";
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
      letterSpacing: 0,
      color: "#000",
    };
    assert.equal(svgTextTspanY(2, typo), 2 + 11);
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
});
