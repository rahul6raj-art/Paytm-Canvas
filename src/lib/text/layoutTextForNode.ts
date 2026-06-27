import type { EditorNode } from "@/stores/useEditorStore";
import {
  buildFontString,
  getTextMeasureContext,
  measureStringWidth,
  type TextLayout,
} from "./textMeasure";
import {
  textLayoutForEditorNode,
  type CanonicalTextLayout,
} from "./canonicalTextLayout";
import { TEXT_BOX_PAD_X, TEXT_BOX_PAD_Y, MIN_TEXT_BOX } from "./textNodeModel";
import type { ResolvedTextTypo } from "@/lib/textTypography";

export type LayoutTextGlyph = {
  char: string;
  index: number;
  x: number;
  y: number;
  width: number;
};

export type LayoutTextLine = {
  text: string;
  startIndex: number;
  endIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
  glyphs: LayoutTextGlyph[];
};

export type LayoutTextResult = {
  lines: LayoutTextLine[];
  width: number;
  height: number;
  overflow: boolean;
};

/** Measure a single run of characters (used by wrapping). */
export function measureTextRun(
  text: string,
  typo: ResolvedTextTypo,
): number {
  const ctx = getTextMeasureContext();
  ctx.font = buildFontString(typo);
  return measureStringWidth(ctx, text, typo.letterSpacing);
}

/** Word/character wrap for a node at the given inner content width. */
export function wrapTextIntoLines(
  node: EditorNode,
  availableWidth: number,
): LayoutTextLine[] {
  const patchedNode = {
    ...node,
    width: Math.max(MIN_TEXT_BOX, availableWidth + TEXT_BOX_PAD_X * 2),
  };
  const result = layoutTextForNode(patchedNode);
  return result?.lines ?? [];
}

function glyphsForLine(
  lineText: string,
  startIndex: number,
  x: number,
  y: number,
  typo: ResolvedTextTypo,
  canonical?: CanonicalTextLayout,
  lineIndex?: number,
): LayoutTextGlyph[] {
  const wasmGlyphs = canonical?.glyphs.filter(
    (g) => g.index >= startIndex && g.index < startIndex + lineText.length,
  );
  if (wasmGlyphs && wasmGlyphs.length > 0) {
    return wasmGlyphs.map((g) => ({
      char: lineText[g.index - startIndex] ?? "",
      index: g.index,
      x: g.x,
      y: g.y,
      width: g.width,
    }));
  }

  const ctx = getTextMeasureContext();
  ctx.font = buildFontString(typo);
  const glyphs: LayoutTextGlyph[] = [];
  let cx = x;
  for (let i = 0; i < lineText.length; i++) {
    const ch = lineText[i]!;
    const w = measureStringWidth(ctx, ch, typo.letterSpacing);
    glyphs.push({ char: ch, index: startIndex + i, x: cx, y, width: w });
    cx += w;
  }
  return glyphs;
}

function buildLinesFromLayout(
  layout: TextLayout,
  canonical: CanonicalTextLayout,
  typo: ResolvedTextTypo,
): LayoutTextLine[] {
  return layout.lines.map((line, i) => {
    const canonicalLine = canonical.lines[i];
    const x = canonicalLine?.x ?? 0;
    const y = canonicalLine?.y ?? 0;
    const height = layout.lineHeightPx;
    const baseline = y + height * 0.8;
    return {
      text: line.text,
      startIndex: line.startIndex,
      endIndex: line.startIndex + line.text.length,
      x,
      y,
      width: line.width,
      height,
      baseline,
      glyphs: glyphsForLine(line.text, line.startIndex, x, y, typo, canonical, i),
    };
  });
}

/** Full text layout for a node — single source for display, edit overlay, caret, and hit tests. */
export function layoutTextForNode(node: EditorNode): LayoutTextResult | null {
  const prepared = textLayoutForEditorNode(node);
  if (!prepared) return null;

  const { layout, canonical, typo } = prepared;
  const lines = buildLinesFromLayout(layout, canonical, typo);
  const contentOverflow =
    (node.textResizeMode ?? "auto-width") === "fixed" &&
    layout.height > canonical.innerH + 0.5;

  return {
    lines,
    width: layout.width,
    height: layout.height,
    overflow: contentOverflow,
  };
}

export function computeTextBounds(layout: LayoutTextResult): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (layout.lines.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const line of layout.lines) {
    minX = Math.min(minX, line.x);
    minY = Math.min(minY, line.y);
    maxX = Math.max(maxX, line.x + line.width);
    maxY = Math.max(maxY, line.y + line.height);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Apply auto-resize height patch after layout (HEIGHT mode only). */
export function updateTextAutoResize(
  node: EditorNode,
  layout: LayoutTextResult,
): Partial<EditorNode> | null {
  const mode = node.textResizeMode ?? "auto-width";
  if (mode !== "auto-height") return null;
  const nextHeight = Math.max(MIN_TEXT_BOX, layout.height);
  if (nextHeight === node.height) return null;
  return { height: nextHeight };
}
