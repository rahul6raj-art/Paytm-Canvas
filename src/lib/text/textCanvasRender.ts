import {
  createGradientPaintStyle,
  paintGradientFillInBox,
} from "@/lib/canvasGradientPaint";
import { screenPxToWorld, TEXT_CARET_SCREEN_PX } from "@/lib/canvasVisual";
import { effectiveFillType, type FillPaintNode } from "@/lib/fillGradient";
import type { ResolvedTextTypo } from "@/lib/textTypography";

/** Canvas caret color (must be a concrete color — CSS vars do not resolve on canvas). */
const TEXT_CARET_COLOR = "#18a0fb";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  DEFAULT_TEXT_ADVANCED_STYLE,
  prepareTextForDisplay,
  rawIndexToDisplayIndex,
  textAdvancedStyleFromNode,
  type TextLayoutStyleOptions,
} from "./textAdvancedStyle";
import {
  TEXT_BOX_PAD_X,
  TEXT_BOX_PAD_Y,
  textInnerHeight,
  textInnerWidth,
  textTypoFromModel,
  toTextNodeModel,
  wrapWidthForResizeMode,
  type TextAlign,
} from "./textNodeModel";
import { verticalContentOffsetY } from "./textVerticalAlign";
import {
  buildFontString,
  getTextMeasureContext,
  layoutText,
  lineOffsetX,
  lineTopY,
  measureStringWidth,
  type TextLayout,
} from "./textMeasure";
import { getCaretRect } from "./textMeasure";
import { normalizedRange } from "./textCursor";
import type { TextLayoutForRender } from "./canonicalTextLayout";

export type TextCanvasRenderOptions = {
  typo: ResolvedTextTypo;
  text: string;
  width: number;
  height: number;
  textAlign: TextAlign;
  verticalAlign?: EditorNode["verticalAlign"];
  opacity?: number;
  wrapWidth: number;
  selection?: { anchor: number; focus: number } | null;
  caretIndex?: number | null;
  caretVisible?: boolean;
  /** Viewport zoom — bitmap is scaled by CSS, so bake zoom into backing-store resolution. */
  zoom?: number;
  dpr?: number;
  style?: TextLayoutStyleOptions;
  /** When set and fillType is gradient, text glyphs are filled with fillGradient (all kinds). */
  gradientNode?: FillPaintNode;
  /** Precomputed canonical layout — avoids a second layout pass. */
  prepared?: TextLayoutForRender | null;
};

const MAX_TEXT_BITMAP_EDGE = 8192;

export type { TextLayoutForRender } from "./canonicalTextLayout";
export { textLayoutForEditorNode } from "./canonicalTextLayout";

/**
 * Backing-store scale so text stays sharp when the canvas scene is CSS-zoomed.
 * Caps total bitmap size to avoid huge allocations at extreme zoom.
 */
/** Clamp backing-store scale so text bitmaps stay within GPU-safe dimensions. */
export function capTextBitmapDpr(
  cssWidth: number,
  cssHeight: number,
  desired: number,
): number {
  const maxByW = MAX_TEXT_BITMAP_EDGE / Math.max(1, cssWidth);
  const maxByH = MAX_TEXT_BITMAP_EDGE / Math.max(1, cssHeight);
  return Math.max(1, Math.min(desired, maxByW, maxByH));
}

export function resolveTextCanvasDpr(
  cssWidth: number,
  cssHeight: number,
  zoom = 1,
): number {
  const base = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const desired = Math.max(1, base * Math.max(1, zoom));
  return capTextBitmapDpr(cssWidth, cssHeight, desired);
}

/** Paint laid-out text in local box coordinates on an existing 2D context. */
export function paintTextLayoutToContext(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  opts: TextCanvasRenderOptions,
): TextLayout {
  const w = Math.max(1, opts.width);
  const h = Math.max(1, opts.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  const prevAlpha = ctx.globalAlpha;
  const prevFont = ctx.font;
  const prevBaseline = ctx.textBaseline;
  const prevFill = ctx.fillStyle;

  ctx.globalAlpha = Math.max(0, Math.min(1, (prevAlpha ?? 1) * (opts.opacity ?? 1)));
  ctx.font = buildFontString(opts.typo);
  ctx.textBaseline = "top";

  const boxInnerW = Math.max(1, w - TEXT_BOX_PAD_X * 2);
  const boxInnerH = Math.max(1, h - TEXT_BOX_PAD_Y * 2);
  const wrapWidth =
    opts.wrapWidth === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Math.min(opts.wrapWidth, boxInnerW));
  const style = opts.style ?? DEFAULT_TEXT_ADVANCED_STYLE;
  const displayText = prepareTextForDisplay(opts.text, style);
  let layout: TextLayout;
  let innerW: number;
  let blockOffsetY: number;
  if (opts.prepared) {
    layout = opts.prepared.layout;
    innerW = opts.prepared.innerW;
    blockOffsetY = opts.prepared.blockOffsetY;
  } else {
    innerW = boxInnerW;
    layout = layoutText(displayText, wrapWidth, opts.typo, style);
    layout = applyTruncate(layout, opts.typo, style, boxInnerH, innerW, wrapWidth);
    blockOffsetY = verticalContentOffsetY(layout.height, boxInnerH, opts.verticalAlign);
  }

  if (opts.selection && opts.selection.anchor !== opts.selection.focus) {
    const { start, end } = normalizedRange(opts.selection.anchor, opts.selection.focus);
    const displayStart = rawIndexToDisplayIndex(start, opts.text, style);
    const displayEnd = rawIndexToDisplayIndex(end, opts.text, style);
    drawSelection(
      ctx,
      layout,
      opts.typo,
      opts.textAlign,
      innerW,
      TEXT_BOX_PAD_X,
      TEXT_BOX_PAD_Y + blockOffsetY,
      displayStart,
      displayEnd,
    );
  }

  const useGradient =
    opts.gradientNode != null &&
    opts.gradientNode.fillEnabled !== false &&
    effectiveFillType(opts.gradientNode) === "gradient";

  if (useGradient) {
    paintGradientTextFill(ctx, opts, layout, innerW, blockOffsetY, style);
  } else {
    ctx.fillStyle = opts.typo.color;
    paintTextLinesAndDecorations(ctx, opts, layout, innerW, blockOffsetY, style);
  }

  if (opts.caretVisible && opts.caretIndex != null) {
    const displayCaret = rawIndexToDisplayIndex(opts.caretIndex, opts.text, style);
    const caret = getCaretRect(displayCaret, layout, opts.typo, innerW, opts.textAlign);
    const caretWidth = screenPxToWorld(TEXT_CARET_SCREEN_PX, opts.zoom ?? 1);
    ctx.fillStyle = TEXT_CARET_COLOR;
    ctx.fillRect(
      caret.x + TEXT_BOX_PAD_X,
      caret.y + TEXT_BOX_PAD_Y + blockOffsetY,
      Math.max(0.5, caretWidth),
      caret.height,
    );
  }

  ctx.globalAlpha = prevAlpha;
  ctx.font = prevFont;
  ctx.textBaseline = prevBaseline;
  ctx.fillStyle = prevFill;
  ctx.restore();

  return layout;
}

/** Draw text, selection highlight, and caret onto a canvas element (local box coords). */
export function renderTextToCanvas(
  canvas: HTMLCanvasElement,
  opts: TextCanvasRenderOptions,
): TextLayout {
  const w = Math.max(1, opts.width);
  const h = Math.max(1, opts.height);
  const dpr =
    opts.dpr ?? resolveTextCanvasDpr(w, h, opts.zoom ?? 1);
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return layoutText(opts.text, opts.wrapWidth, opts.typo);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return paintTextLayoutToContext(ctx, opts);
}

function paintTextLinesAndDecorations(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  opts: TextCanvasRenderOptions,
  layout: TextLayout,
  innerW: number,
  blockOffsetY: number,
  style: TextLayoutStyleOptions,
): void {
  const canonical = opts.prepared?.canonical;
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i]!;
    const isLast = i === layout.lines.length - 1;
    const canonicalLine = canonical?.lines[i];
    const y = canonicalLine?.y ?? lineTopY(layout, i) + TEXT_BOX_PAD_Y + blockOffsetY;

    if (canonicalLine && canonicalLine.segments.length > 1) {
      for (const segment of canonicalLine.segments) {
        drawLineWithSpacing(ctx, segment.text, segment.x, segment.y, opts.typo, style.textCase === "small-caps");
        drawLineDecorations(ctx, segment.text, segment.x, segment.y, opts.typo, style.textDecoration);
      }
      continue;
    }

    const x =
      canonicalLine?.x ??
      lineOffsetX(line.width, innerW, opts.textAlign, {
        isLastLine: isLast,
        fullLineText: line.text,
        letterSpacing: opts.typo.letterSpacing,
      }) + TEXT_BOX_PAD_X;

    if (opts.textAlign === "justify" && !isLast && !canonicalLine) {
      drawJustifiedLine(ctx, line.text, x, y, innerW, opts.typo);
    } else {
      drawLineWithSpacing(ctx, line.text, x, y, opts.typo, style.textCase === "small-caps");
    }
    drawLineDecorations(ctx, line.text, x, y, opts.typo, style.textDecoration);
  }
}

/** Paint gradient into text glyph shapes via destination-in compositing. */
function paintGradientTextFill(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  opts: TextCanvasRenderOptions,
  layout: TextLayout,
  innerW: number,
  blockOffsetY: number,
  style: TextLayoutStyleOptions,
): void {
  const node = opts.gradientNode!;
  const w = Math.max(1, opts.width);
  const h = Math.max(1, opts.height);

  ctx.save();
  if (!paintGradientFillInBox(ctx, node, w, h)) {
    const grad = createGradientPaintStyle(ctx, node, w, h);
    if (grad) {
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = opts.typo.color;
      ctx.fillRect(0, 0, w, h);
    }
  }

  const prevAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = "destination-in";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000000";
  paintTextLinesAndDecorations(ctx, opts, layout, innerW, blockOffsetY, style);
  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function drawJustifiedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  boxWidth: number,
  typo: ResolvedTextTypo,
): void {
  const words = text.split(/(\s+)/);
  const gaps = words.filter((w) => /^\s+$/.test(w)).length;
  const wordCount = words.filter((w) => w && !/^\s+$/.test(w)).length;
  if (wordCount < 2) {
    drawLineWithSpacing(ctx, text, x, y, typo);
    return;
  }
  let total = 0;
  for (const w of words) {
    if (!/^\s+$/.test(w)) total += measureStringWidth(getTextMeasureContext(), w, typo.letterSpacing);
  }
  const spaceCount = Math.max(1, wordCount - 1);
  const extra = Math.max(0, boxWidth - total) / spaceCount;
  let cx = x;
  for (const token of words) {
    if (/^\s+$/.test(token)) {
      cx += extra;
      continue;
    }
    drawLineWithSpacing(ctx, token, cx, y, typo);
    cx += measureStringWidth(getTextMeasureContext(), token, typo.letterSpacing);
  }
}

function drawLineWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  typo: ResolvedTextTypo,
  smallCaps = false,
): void {
  const prev = ctx.font;
  if (smallCaps) {
    ctx.font = buildFontString({ ...typo, fontSize: Math.max(1, typo.fontSize * 0.82) });
  }
  if (!typo.letterSpacing) {
    ctx.fillText(text, x, y);
    if (smallCaps) ctx.font = prev;
    return;
  }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + typo.letterSpacing;
  }
  if (smallCaps) ctx.font = prev;
}

function drawLineDecorations(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  typo: ResolvedTextTypo,
  decoration: TextLayoutStyleOptions["textDecoration"],
): void {
  if (!text || decoration === "none") return;
  const width = measureStringWidth(getTextMeasureContext(), text, typo.letterSpacing);
  ctx.strokeStyle = typo.color;
  ctx.lineWidth = Math.max(1, typo.fontSize / 12);
  const lineHeightPx = typo.fontSize * typo.lineHeight;
  if (decoration === "underline") {
    const uy = y + lineHeightPx - Math.max(1, typo.fontSize * 0.12);
    ctx.beginPath();
    ctx.moveTo(x, uy);
    ctx.lineTo(x + width, uy);
    ctx.stroke();
  }
  if (decoration === "strikethrough") {
    const sy = y + lineHeightPx * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, sy);
    ctx.lineTo(x + width, sy);
    ctx.stroke();
  }
}

function maxLinesThatFit(layout: TextLayout, maxHeight: number): number {
  let count = 0;
  for (let i = 0; i < layout.lines.length; i++) {
    const bottom = lineTopY(layout, i) + layout.lineHeightPx;
    if (bottom > maxHeight + 0.01) break;
    count = i + 1;
  }
  return Math.max(1, count);
}

function applyTruncate(
  layout: TextLayout,
  typo: ResolvedTextTypo,
  style: TextLayoutStyleOptions,
  maxHeight: number,
  boxInnerWidth: number,
  wrapWidth: number,
): TextLayout {
  if (style.textTruncate !== "end" || !Number.isFinite(maxHeight)) return layout;
  const maxLines = maxLinesThatFit(layout, maxHeight);
  const lineLimitWidth = Number.isFinite(wrapWidth)
    ? Math.min(boxInnerWidth, wrapWidth)
    : boxInnerWidth;

  const needsLineClamp = layout.lines.length > maxLines;
  const lastVisible = layout.lines[Math.min(maxLines, layout.lines.length) - 1];
  const needsEllipsis =
    needsLineClamp ||
    (lastVisible != null &&
      measureStringWidth(getTextMeasureContext(), lastVisible.text, typo.letterSpacing) >
        lineLimitWidth + 0.01);

  if (!needsLineClamp && !needsEllipsis) return layout;

  const lines = layout.lines.slice(0, maxLines);
  const last = lines[maxLines - 1]!;
  let truncated = last.text;
  const ellipsis = "…";
  const ctx = getTextMeasureContext();
  ctx.font = buildFontString(typo);
  while (
    truncated.length > 0 &&
    measureStringWidth(ctx, truncated + ellipsis, typo.letterSpacing) > lineLimitWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  lines[maxLines - 1] = {
    ...last,
    text: truncated + ellipsis,
    width: measureStringWidth(ctx, truncated + ellipsis, typo.letterSpacing),
  };

  let paragraphGaps = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.paragraphStart) paragraphGaps++;
  }
  const contentHeight =
    lines.length * layout.lineHeightPx +
    paragraphGaps * layout.paragraphSpacing -
    layout.verticalTrimTop * 2;

  return {
    ...layout,
    lines,
    height: Math.max(layout.lineHeightPx, contentHeight),
    width: Math.max(...lines.map((ln) => ln.width), 0),
  };
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  typo: ResolvedTextTypo,
  align: TextAlign,
  innerWidth: number,
  padX: number,
  padY: number,
  start: number,
  end: number,
): void {
  ctx.fillStyle = "rgba(24, 160, 251, 0.35)";

  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i]!;
    const lineStart = line.startIndex;
    const lineEnd = line.startIndex + line.text.length;
    if (end <= lineStart || start >= lineEnd) continue;

    const selStart = Math.max(start, lineStart) - lineStart;
    const selEnd = Math.min(end, lineEnd) - lineStart;
    const before = line.text.slice(0, selStart);
    const selected = line.text.slice(selStart, selEnd);
    const x0 =
      lineOffsetX(line.width, innerWidth, align) +
      measureStringWidth(getTextMeasureContext(), before, typo.letterSpacing) +
      padX;
    const selW = measureStringWidth(getTextMeasureContext(), selected, typo.letterSpacing);
    const y = lineTopY(layout, i) + padY;
    ctx.fillRect(x0, y, Math.max(1, selW), layout.lineHeightPx);
  }
}
