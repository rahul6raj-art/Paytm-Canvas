import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultFillGradient } from "@/lib/fillGradient";
import { svgTextMarkup } from "@/lib/svgMarkupCore";
import { textLayoutForEditorNode } from "@/lib/text/canonicalTextLayout";
import { TEXT_BOX_PAD_X, TEXT_BOX_PAD_Y, SVG_TEXT_DOMINANT_BASELINE } from "@/lib/text/textNodeModel";
import { svgTextTspanY } from "@/lib/text/textBaseline";
import { lineOffsetX, lineTopY } from "@/lib/text/textMeasure";
import { strikethroughDecorationY } from "@/lib/text/textAdvancedStyle";
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
    const canvasY = lineTopY(layout, 0) + TEXT_BOX_PAD_Y + blockOffsetY;
    const y = svgTextTspanY(canvasY, typo);

    const svg = svgTextMarkup(node);
    assert.match(svg, new RegExp(`<tspan x="${x}" y="${y}"`));
    assert.match(svg, new RegExp(`dominant-baseline="${SVG_TEXT_DOMINANT_BASELINE}"`));
    assert.doesNotMatch(svg, new RegExp(`<tspan x="${x}" y="${canvasY}"`));
  });

  it("draws explicit strikethrough lines for each layout line", () => {
    const node = textNode({ textDecoration: "strikethrough" });
    const prepared = textLayoutForEditorNode(node);
    assert.ok(prepared);

    const svg = svgTextMarkup(node);
    assert.match(svg, /<line[^>]+stroke-width="/);
    assert.doesNotMatch(svg, /text-decoration="strikethrough"/);

    const sy = strikethroughDecorationY(
      lineTopY(prepared!.layout, 0) + TEXT_BOX_PAD_Y + prepared!.blockOffsetY,
      prepared!.typo.fontSize,
      prepared!.typo.lineHeight,
    );
    assert.match(svg, new RegExp(`<line[^>]+y1="${sy}"`));
  });

  it("renders linear gradient fills via defs", () => {
    const gradient = defaultFillGradient("#ff0000");
    const defs: string[] = [];
    const svg = svgTextMarkup(
      textNode({
        fill: "#ff0000",
        fillType: "gradient",
        fillGradient: gradient,
        fillOpacity: 1,
      }),
      {
        nodeId: "t-grad",
        registerGradient: (id, markup) => defs.push(markup),
      },
    );
    assert.match(svg, /fill="url\(#pc-grad-pc-text-t-grad\)"/);
    assert.ok(defs.some((d) => d.includes("linearGradient")));
  });

  it("renders layer stroke on text markup", () => {
    const node = textNode({ strokeWidth: 3, strokeColor: "#ff0000", strokeEnabled: true });
    const svg = svgTextMarkup(node);
    assert.match(svg, /stroke="rgba\(255,0,0,1\)"/);
    assert.match(svg, /stroke-width="3"/);
    assert.match(svg, /paint-order="stroke fill"/);
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
      const canvasY = lineTopY(prepared!.layout, i) + TEXT_BOX_PAD_Y + prepared!.blockOffsetY;
      const y = svgTextTspanY(canvasY, prepared!.typo);
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
