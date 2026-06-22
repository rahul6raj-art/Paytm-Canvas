import type { EditorNode } from "@/stores/useEditorStore";
import type { TextLayoutForRender } from "../canonicalTextLayout";
import type { TextFontMetrics, TextPaintPlan, ShapedGlyphPaint, ShapedLinePaint } from "./types";

export function buildTextPaintPlan(
  prepared: TextLayoutForRender,
  metrics: TextFontMetrics,
  node: EditorNode,
): TextPaintPlan {
  const { layout, canonical } = prepared;
  const lines: ShapedLinePaint[] = layout.lines.map((line, i) => {
    const canonicalLine = canonical.lines[i];
    const x = canonicalLine?.x ?? 0;
    const y = canonicalLine?.y ?? 0;
    const height = metrics.lineHeightPx;
    const baseline = y + metrics.baselineOffset;

    const wasmGlyphs = canonical.glyphs.filter(
      (g) => g.index >= line.startIndex && g.index < line.startIndex + line.text.length,
    );

    let glyphs: ShapedGlyphPaint[];
    if (wasmGlyphs.length > 0) {
      glyphs = wasmGlyphs.map((g) => ({
        char: line.text[g.index - line.startIndex] ?? "",
        index: g.index,
        x: g.x,
        y: g.y,
        width: g.width,
        height: g.height,
        glyphId: g.glyphId,
      }));
    } else {
      glyphs = [];
    }

    return {
      text: line.text,
      startIndex: line.startIndex,
      x,
      y,
      width: line.width,
      height,
      baseline,
      glyphs,
    };
  });

  const overflow =
    (node.textResizeMode ?? "auto-width") === "fixed" &&
    layout.height > canonical.innerH + 0.5;

  return {
    lines,
    metrics,
    innerW: canonical.innerW,
    innerH: canonical.innerH,
    blockOffsetY: canonical.blockOffsetY,
    overflow,
  };
}

type CanvasPaintCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Paint shaped glyph positions — no layout work; positions come from the pipeline. */
export function paintShapedGlyphsToContext(
  ctx: CanvasPaintCtx,
  plan: TextPaintPlan,
  drawChar: (char: string, x: number, y: number) => void,
): void {
  for (const line of plan.lines) {
    if (line.glyphs.length > 0) {
      for (const glyph of line.glyphs) {
        if (!glyph.char) continue;
        drawChar(glyph.char, glyph.x, glyph.y);
      }
      continue;
    }
    drawChar(line.text, line.x, line.y);
  }
}

/** Build SVG tspans from shaped glyph positions (one tspan per glyph when shaped). */
export function svgTspansFromPaintPlan(
  plan: TextPaintPlan,
  esc: (s: string) => string,
  decorationAttr: string,
): string[] {
  const out: string[] = [];
  for (const line of plan.lines) {
    if (line.glyphs.length > 1) {
      for (const glyph of line.glyphs) {
        if (!glyph.char) continue;
        out.push(
          `<tspan x="${glyph.x}" y="${glyph.y}"${decorationAttr}>${esc(glyph.char)}</tspan>`,
        );
      }
    } else {
      out.push(
        `<tspan x="${line.x}" y="${line.y}"${decorationAttr}>${esc(line.text)}</tspan>`,
      );
    }
  }
  return out;
}
