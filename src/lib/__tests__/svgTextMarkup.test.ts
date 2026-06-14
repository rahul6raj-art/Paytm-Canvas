import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { svgTextMarkup } from "@/lib/svgMarkupCore";
import { textLayoutForEditorNode } from "@/lib/text/canonicalTextLayout";
import { TEXT_BOX_PAD_X, TEXT_BOX_PAD_Y } from "@/lib/text/textNodeModel";
import { lineOffsetX, lineTopY } from "@/lib/text/textMeasure";
import type { EditorNode } from "@/stores/useEditorStore";

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

function textNode(overrides: Partial<EditorNode> = {}): EditorNode {
  return {
    id: "t1",
    type: "text",
    x: 268,
    y: 261,
    width: 120,
    height: 22,
    content: "sdjhjdshajhdsahj",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.25,
    letterSpacing: 0,
    textColor: "#0f172a",
    textResizeMode: "fixed",
    ...overrides,
  } as EditorNode;
}

describe("svgTextMarkup", () => {
  before(() => {
    installTextMeasureDomStub();
  });

  it("matches canvas layout padding and line positions", () => {
    const node = textNode();
    const prepared = textLayoutForEditorNode(node);
    assert.ok(prepared);

    const { layout, typo, textAlign, innerW, blockOffsetY } = prepared!;
    const x =
      lineOffsetX(layout.lines[0]!.width, innerW, textAlign, {
        isLastLine: true,
        fullLineText: layout.lines[0]!.text,
        letterSpacing: typo.letterSpacing,
      }) + TEXT_BOX_PAD_X;
    const y = lineTopY(layout, 0) + TEXT_BOX_PAD_Y + blockOffsetY;

    const svg = svgTextMarkup(node);
    assert.match(svg, new RegExp(`<tspan x="${x}" y="${y}"`));
    assert.doesNotMatch(svg, /y="14"/);
  });

  it("applies strikethrough on each tspan", () => {
    const svg = svgTextMarkup(textNode({ textDecoration: "strikethrough" }));
    assert.match(svg, /text-decoration="strikethrough"/);
    assert.doesNotMatch(svg, /<text[^>]*text-decoration=/);
  });

  it("wraps multiline text with the same line offsets as canvas layout", () => {
    const node = textNode({
      width: 80,
      height: 60,
      content: "hello\nworld",
      textResizeMode: "fixed",
    });
    const prepared = textLayoutForEditorNode(node);
    assert.ok(prepared);

    const svg = svgTextMarkup(node);
    for (let i = 0; i < prepared!.layout.lines.length; i++) {
      const line = prepared!.layout.lines[i]!;
      const isLast = i === prepared!.layout.lines.length - 1;
      const y = lineTopY(prepared!.layout, i) + TEXT_BOX_PAD_Y + prepared!.blockOffsetY;
      const x =
        lineOffsetX(line.width, prepared!.innerW, prepared!.textAlign, {
          isLastLine: isLast,
          fullLineText: line.text,
          letterSpacing: prepared!.typo.letterSpacing,
        }) + TEXT_BOX_PAD_X;
      assert.match(svg, new RegExp(`<tspan x="${x}" y="${y}">${line.text}</tspan>`));
    }
  });
});
