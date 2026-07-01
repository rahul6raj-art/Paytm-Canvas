import { canvasFontFamilyStack } from "@/lib/fonts/fontCatalog";
import type { ResolvedTextTypo } from "@/lib/textTypography";
import {
  DEFAULT_TEXT_ADVANCED_STYLE,
  type TextLayoutStyleOptions,
  verticalTrimInsetPx,
} from "./textAdvancedStyle";
import type { TextAlign } from "./textNodeModel";
import { segmentGraphemes } from "./graphemeClusters";

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
  firstLineAscent: number;
  firstLineDescent: number;
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

/** Approximate alphabetic ascent — fallback only when WASM layout is unavailable. */
export function measureTypoAscent(typo: ResolvedTextTypo): number {
  if (typeof document === "undefined") return typo.fontSize * 0.82;
  const ctx = getTextMeasureContext();
  ctx.font = buildFontString(typo);
  const metrics = ctx.measureText("Hg");
  return (
    metrics.fontBoundingBoxAscent ??
    metrics.actualBoundingBoxAscent ??
    typo.fontSize * 0.82
  );
}

/** Approximate alphabetic descent — fallback only when WASM layout is unavailable. */
export function measureTypoDescent(typo: ResolvedTextTypo): number {
  if (typeof document === "undefined") return typo.fontSize * 0.22;
  const ctx = getTextMeasureContext();
  ctx.font = buildFontString(typo);
  const metrics = ctx.measureText("Hg");
  return (
    metrics.fontBoundingBoxDescent ??
    metrics.actualBoundingBoxDescent ??
    typo.fontSize * 0.22
  );
}

/** Alphabetic baseline Y inside a line box — browser metrics + CSS half-leading (Figma). */
export function canvasAlphabeticBaselineY(
  lineTop: number,
  lineHeight: number,
  typo: ResolvedTextTypo,
): number {
  const ascent = measureTypoAscent(typo);
  const descent = measureTypoDescent(typo);
  const halfLeading = (lineHeight - (ascent + descent)) / 2;
  return lineTop + halfLeading + ascent;
}

/** Resolved line height in px for layout — always from typography, never glyph bbox metrics. */
export function resolveLayoutLineHeightPx(typo: ResolvedTextTypo): number {
  return typo.lineHeightPx;
}

/** Measure a string width including per-grapheme letter-spacing. */
export function measureStringWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
): number {
  if (!text) return 0;
  const clusters = segmentGraphemes(text);
  if (clusters.length === 0) return 0;
  if (!letterSpacing || clusters.length === 1) {
    return ctx.measureText(clusters.join("")).width;
  }

  let w = 0;
  for (let i = 0; i < clusters.length; i++) {
    w += ctx.measureText(clusters[i]!).width;
    if (i < clusters.length - 1) w += letterSpacing;
  }
  return w;
}

/** Average glyph width heuristic when canvas measurement is unavailable (SSR / bridge import). */
export function estimateGlyphWidthPx(typo: ResolvedTextTypo): number {
  return typo.fontSize * 0.58;
}

/** Canvas width when DOM is available; heuristic on server. */
export function measureStringWidthForTypo(text: string, typo: ResolvedTextTypo): number {
  if (typeof document !== "undefined") {
    const ctx = getTextMeasureContext();
    ctx.font = buildFontString(typo);
    return measureStringWidth(ctx, text, typo.letterSpacing);
  }
  const glyph = estimateGlyphWidthPx(typo);
  const ls = typo.letterSpacing;
  const clusters = segmentGraphemes(text);
  if (clusters.length === 0) return 0;
  if (!ls) return clusters.length * glyph;
  let w = 0;
  for (let i = 0; i < clusters.length; i++) {
    w += glyph;
    if (i < clusters.length - 1) w += ls;
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
  if (maxWidth <= 0 || !Number.isFinite(maxWidth)) {
    const width = measureStringWidthForTypo(paragraph, typo);
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
      width: measureStringWidthForTypo(line, typo),
      paragraphStart: lineStart === 0,
    });
    lineStart += line.length;
    line = "";
  };

  const tokens = paragraph.split(/(\s+)/);
  for (const token of tokens) {
    if (!token) continue;
    const candidate = line + token;
    const candidateWidth = measureStringWidthForTypo(candidate, typo);
    if (candidateWidth <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) flush();
    if (measureStringWidthForTypo(token, typo) <= maxWidth) {
      line = token;
    } else {
      for (const cluster of segmentGraphemes(token)) {
        const next = line + cluster;
        if (measureStringWidthForTypo(next, typo) <= maxWidth || !line) {
          line = next;
        } else {
          flush();
          line = cluster;
        }
      }
    }
  }
  if (line.length > 0 || lines.length === 0) flush();
  return lines;
}

/** Frame/content height from line boxes only (Figma auto-height model). */
export function layoutTextFrameContentHeight(
  layout: Pick<
    TextLayout,
    "lines" | "lineHeightPx" | "paragraphSpacing" | "verticalTrimTop"
  >,
): number {
  const lineCount = Math.max(1, layout.lines.length);
  let height = layout.lineHeightPx * lineCount;
  for (let i = 1; i < layout.lines.length; i++) {
    if (layout.lines[i]?.paragraphStart) {
      height += layout.paragraphSpacing;
    }
  }
  const trimmed = height - layout.verticalTrimTop * 2;
  return Math.max(layout.lineHeightPx, trimmed);
}

export function layoutTextContentHeight(
  layout: Pick<
    TextLayout,
    "lines" | "lineHeightPx" | "paragraphSpacing" | "verticalTrimTop"
  >,
): number {
  return layoutTextFrameContentHeight(layout);
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
  const lineHeightPx = resolveLayoutLineHeightPx(typo);
  const firstLineAscent = measureTypoAscent(typo);
  const firstLineDescent = measureTypoDescent(typo);
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

  const layoutCore = {
    lines,
    lineHeightPx,
    firstLineAscent,
    firstLineDescent,
    paragraphSpacing,
    verticalTrimTop,
  };

  return {
    ...layoutCore,
    width,
    height: layoutTextContentHeight(layoutCore),
  };
}

/** Baseline Y for a line index: firstBaseline + lineIndex × resolvedLineHeight (+ paragraph gaps). */
export function lineBaselineY(layout: TextLayout, lineIndex: number): number {
  // Browsers and Figma render text in a line-height box that centers the glyph's em box
  // (ascent + descent) vertically, distributing the leftover "leading" half above and half
  // below (CSS half-leading). Without this offset, glyphs hug the TOP of every line box and
  // leave the leading as a gap *below* the text — the "text sits at the top of the frame"
  // mismatch vs Figma. Skip it only when cap-height trim is active (verticalTrimTop > 0),
  // which intentionally removes that leading.
  const emHeight = layout.firstLineAscent + layout.firstLineDescent;
  const halfLeading =
    layout.verticalTrimTop === 0 ? (layout.lineHeightPx - emHeight) / 2 : 0;
  let y = layout.verticalTrimTop + halfLeading + layout.firstLineAscent;
  for (let i = 1; i <= lineIndex; i++) {
    y += layout.lineHeightPx;
    if (layout.lines[i]?.paragraphStart) y += layout.paragraphSpacing;
  }
  return y;
}

/** Y offset for a line box top when canvas uses `textBaseline: top`. */
export function lineTopY(layout: TextLayout, lineIndex: number): number {
  return lineBaselineY(layout, lineIndex) - layout.firstLineAscent;
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

/** Caret box spans the full line height (Figma-style), anchored at line top. */
export function measureTypoCaretBox(
  _typo: ResolvedTextTypo,
  lineHeightPx: number,
): { offsetY: number; height: number } {
  return { offsetY: 0, height: lineHeightPx };
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
  layoutScale = 1,
): { x: number; y: number; height: number } {
  const caret = getCaretRect(index, layout, typo, innerW, align);
  const rect = layout.caretStops?.length
    ? { x: caret.x, y: caret.y, height: layout.lineHeightPx }
    : {
        x: caret.x + padX,
        y: caret.y + padY + blockOffsetY,
        height: layout.lineHeightPx,
      };
  if (layoutScale === 1) return rect;
  return {
    x: rect.x * layoutScale,
    y: rect.y * layoutScale,
    height: rect.height * layoutScale,
  };
}
