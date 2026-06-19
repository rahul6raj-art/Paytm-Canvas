import { canvasFontFamilyStack } from "@/lib/fonts/fontCatalog";
import type { ResolvedTextTypo } from "@/lib/textTypography";
import {
  DEFAULT_TEXT_ADVANCED_STYLE,
  type TextLayoutStyleOptions,
  verticalTrimInsetPx,
} from "./textAdvancedStyle";
import type { TextAlign } from "./textNodeModel";

/** One visual line after wrapping; `startIndex` is the offset in the full string. */
export type TextLine = {
  text: string;
  startIndex: number;
  width: number;
  /** First line of a `\n`-separated paragraph. */
  paragraphStart: boolean;
};

export type TextCaretStop = {
  index: number;
  x: number;
  y: number;
};

export type TextGlyphBox = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  glyphId: number;
};

export type TextFontInfo = {
  requestedFamily: string;
  resolvedFamily: string;
  fallbackUsed: boolean;
  missing: boolean;
};

export type TextLayout = {
  lines: TextLine[];
  width: number;
  height: number;
  lineHeightPx: number;
  paragraphSpacing: number;
  verticalTrimTop: number;
  /** `wasm` when shaped by craft-engine; `fallback` before engine/fonts load. */
  source?: "wasm" | "fallback";
  caretStops?: TextCaretStop[];
  linePositions?: Array<{ x: number; y: number }>;
  glyphs?: TextGlyphBox[];
  font?: TextFontInfo;
};

let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

/** Shared offscreen canvas used for all text measurement (avoids layout thrash). */
export function getTextMeasureContext(): CanvasRenderingContext2D {
  if (typeof document === "undefined") {
    throw new Error("Text measurement requires a DOM environment");
  }
  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
    measureCtx = measureCanvas.getContext("2d");
  }
  if (!measureCtx) throw new Error("Could not create 2D canvas context");
  return measureCtx;
}

export function buildFontString(typo: ResolvedTextTypo): string {
  return `${typo.fontWeight} ${typo.fontSize}px ${canvasFontFamilyStack(typo.fontFamily)}`;
}

/** Measure a string width including per-character letter-spacing. */
export function measureStringWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
): number {
  if (!text) return 0;
  ctx.font = ctx.font || buildFontString({ fontSize: 13, fontWeight: 400, fontFamily: "sans-serif", lineHeight: 1.25, letterSpacing: 0, color: "#000" });
  if (!letterSpacing) return ctx.measureText(text).width;

  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += ctx.measureText(text[i]!).width;
    if (i < text.length - 1) w += letterSpacing;
  }
  return w;
}

function configureMeasureCtx(ctx: CanvasRenderingContext2D, typo: ResolvedTextTypo): void {
  ctx.font = buildFontString(typo);
  ctx.textBaseline = "alphabetic";
}

/** Wrap a single paragraph (no `\n`) into one or more lines. */
function wrapParagraph(
  paragraph: string,
  startIndex: number,
  maxWidth: number,
  typo: ResolvedTextTypo,
): TextLine[] {
  const ctx = getTextMeasureContext();
  configureMeasureCtx(ctx, typo);

  if (maxWidth <= 0 || !Number.isFinite(maxWidth)) {
    const width = measureStringWidth(ctx, paragraph, typo.letterSpacing);
    return [{ text: paragraph, startIndex, width, paragraphStart: true }];
  }

  if (!paragraph) {
    return [{ text: "", startIndex, width: 0, paragraphStart: true }];
  }

  const lines: TextLine[] = [];
  let lineStart = 0;
  let line = "";

  const flush = () => {
    lines.push({
      text: line,
      startIndex: startIndex + lineStart,
      width: measureStringWidth(ctx, line, typo.letterSpacing),
      paragraphStart: lineStart === 0,
    });
    lineStart += line.length;
    line = "";
  };

  const tokens = paragraph.split(/(\s+)/);
  for (const token of tokens) {
    if (!token) continue;
    const candidate = line + token;
    const candidateWidth = measureStringWidth(ctx, candidate, typo.letterSpacing);
    if (candidateWidth <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) flush();
    if (measureStringWidth(ctx, token, typo.letterSpacing) <= maxWidth) {
      line = token;
    } else {
      for (const ch of token) {
        const next = line + ch;
        if (measureStringWidth(ctx, next, typo.letterSpacing) <= maxWidth || !line) {
          line = next;
        } else {
          flush();
          line = ch;
        }
      }
    }
  }
  if (line.length > 0 || lines.length === 0) flush();
  return lines;
}

/**
 * Lay out multiline text with word wrapping.
 * `maxWidth` is the box width for wrapping; use Infinity for auto-width mode.
 */
export function layoutText(
  text: string,
  maxWidth: number,
  typo: ResolvedTextTypo,
  style: TextLayoutStyleOptions = DEFAULT_TEXT_ADVANCED_STYLE,
): TextLayout {
  const ctx = getTextMeasureContext();
  configureMeasureCtx(ctx, typo);
  const lineHeightPx = typo.fontSize * typo.lineHeight;
  const paragraphSpacing = Math.max(0, style.paragraphSpacing ?? 0);
  const verticalTrimTop = verticalTrimInsetPx(typo.fontSize, style.verticalTrim);

  const paragraphs = text.split("\n");
  const lines: TextLine[] = [];
  let index = 0;

  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p] ?? "";
    const wrapped = wrapParagraph(para, index, maxWidth, typo);
    if (wrapped.length > 0) wrapped[0]!.paragraphStart = true;
    lines.push(...wrapped);
    index += para.length + (p < paragraphs.length - 1 ? 1 : 0);
  }

  if (lines.length === 0) {
    lines.push({ text: "", startIndex: 0, width: 0, paragraphStart: true });
  }

  let width = 0;
  for (const ln of lines) width = Math.max(width, ln.width);

  let paragraphGaps = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.paragraphStart) paragraphGaps++;
  }

  const contentHeight =
    lines.length * lineHeightPx + paragraphGaps * paragraphSpacing - verticalTrimTop * 2;

  return {
    lines,
    width,
    height: Math.max(lineHeightPx, contentHeight),
    lineHeightPx,
    paragraphSpacing,
    verticalTrimTop,
  };
}

/** Y offset for a line index including paragraph spacing and vertical trim. */
export function lineTopY(layout: TextLayout, lineIndex: number): number {
  let y = layout.verticalTrimTop;
  for (let i = 1; i <= lineIndex; i++) {
    y += layout.lineHeightPx;
    if (layout.lines[i]?.paragraphStart) y += layout.paragraphSpacing;
  }
  return y;
}

/** Extra space distributed between words for justified lines. */
export function justifyWordSpacing(
  line: string,
  lineWidth: number,
  boxWidth: number,
  letterSpacing: number,
): number {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return 0;
  const ctx = getTextMeasureContext();
  let wordsWidth = 0;
  for (let i = 0; i < words.length; i++) {
    wordsWidth += measureStringWidth(ctx, words[i]!, letterSpacing);
    if (i < words.length - 1) wordsWidth += letterSpacing;
  }
  const gaps = words.length - 1;
  return Math.max(0, (boxWidth - wordsWidth) / gaps);
}

/** X offset for a line inside a box with horizontal alignment. */
export function lineOffsetX(
  lineWidth: number,
  boxWidth: number,
  align: TextAlign,
  opts?: { isLastLine?: boolean; fullLineText?: string; letterSpacing?: number },
): number {
  if (align === "justify" && opts?.fullLineText && !opts.isLastLine) {
    return 0;
  }
  if (align === "center") return Math.max(0, (boxWidth - lineWidth) / 2);
  if (align === "right") return Math.max(0, boxWidth - lineWidth);
  return 0;
}

/** Caret rectangle in local text-box coordinates for a character index. */
export function getCaretRect(
  index: number,
  layout: TextLayout,
  typo: ResolvedTextTypo,
  boxWidth: number,
  align: TextAlign,
): { x: number; y: number; height: number } {
  if (layout.caretStops && layout.caretStops.length > 0) {
    let best = layout.caretStops[0]!;
    let bestDist = Math.abs(best.index - index);
    for (const stop of layout.caretStops) {
      const dist = Math.abs(stop.index - index);
      if (dist <= bestDist) {
        best = stop;
        bestDist = dist;
      }
      if (stop.index > index) break;
    }
    return { x: best.x, y: best.y, height: layout.lineHeightPx };
  }

  const ctx = getTextMeasureContext();
  configureMeasureCtx(ctx, typo);

  if (layout.lines.length === 0) {
    return { x: 0, y: 0, height: layout.lineHeightPx };
  }

  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i]!;
    const lineEnd = line.startIndex + line.text.length;
    const isLast = i === layout.lines.length - 1;
    if (index <= lineEnd || isLast) {
      const localChar = Math.max(0, Math.min(index - line.startIndex, line.text.length));
      const before = line.text.slice(0, localChar);
      const caretX =
        lineOffsetX(line.width, boxWidth, align) +
        measureStringWidth(ctx, before, typo.letterSpacing);
      return {
        x: caretX,
        y: lineTopY(layout, i),
        height: layout.lineHeightPx,
      };
    }
  }

  return { x: 0, y: 0, height: layout.lineHeightPx };
}

/** Caret height centered on glyph metrics within a line box. */
export function measureTypoCaretBox(
  typo: ResolvedTextTypo,
  lineHeightPx: number,
): { offsetY: number; height: number } {
  if (typeof document === "undefined") {
    const height = Math.min(lineHeightPx, typo.fontSize);
    return { offsetY: (lineHeightPx - height) / 2, height };
  }
  const ctx = getTextMeasureContext();
  ctx.font = buildFontString(typo);
  const m = ctx.measureText("Hg");
  const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? typo.fontSize * 0.82;
  const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? typo.fontSize * 0.18;
  const height = Math.min(lineHeightPx, Math.max(1, ascent + descent));
  return { offsetY: Math.max(0, (lineHeightPx - height) / 2), height };
}

/** Map a caret index to canvas draw coordinates (handles canonical caret stops). */
export function resolveCaretDrawRect(
  index: number,
  layout: TextLayout,
  typo: ResolvedTextTypo,
  innerW: number,
  align: TextAlign,
  padX: number,
  padY: number,
  blockOffsetY: number,
): { x: number; y: number; height: number } {
  const caret = getCaretRect(index, layout, typo, innerW, align);
  const { offsetY, height } = measureTypoCaretBox(typo, layout.lineHeightPx);
  if (layout.caretStops?.length) {
    return { x: caret.x, y: caret.y + offsetY, height };
  }
  return {
    x: caret.x + padX,
    y: caret.y + padY + blockOffsetY + offsetY,
    height,
  };
}
