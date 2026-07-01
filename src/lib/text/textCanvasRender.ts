import {
  createGradientPaintStyle,
  paintNodeFillInBox,
} from "@/lib/canvasGradientPaint";
import { textCaretLayoutWidth } from "@/lib/canvasVisual";
import { effectiveFillType } from "@/lib/fillGradient";
import { textNodeAsFillPaint } from "@/lib/text/textFillPaint";
import { applyCanvasTextLayerStroke, resolveTextLayerStroke } from "@/lib/text/textLayerStroke";
import type { ResolvedTextTypo } from "@/lib/textTypography";

/** Canvas caret color (must be a concrete color — CSS vars do not resolve on canvas). */
const TEXT_CARET_COLOR = "#18a0fb";
type TextCanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
import type { EditorNode } from "@/stores/useEditorStore";
import {
  DEFAULT_TEXT_ADVANCED_STYLE,
  prepareTextForDisplay,
  rawIndexToDisplayIndex,
  strikethroughDecorationY,
  textAdvancedStyleFromNode,
  textDecorationStrokeWidth,
  underlineDecorationY,
  type TextLayoutStyleOptions,
} from "./textAdvancedStyle";
import {
  TEXT_BOX_PAD_X,
  textInnerHeight,
  textInnerWidth,
  textTypoFromModel,
  textVerticalPad,
  toTextNodeModel,
  wrapWidthForResizeMode,
  type TextAlign,
  type TextResizeMode,
} from "./textNodeModel";
import { verticalContentOffsetY } from "./textVerticalAlign";
import { hugContentHeightForLayout } from "./textBaseline";
import {
  buildFontString,
  getTextMeasureContext,
  layoutText,
  layoutTextContentHeight,
  canvasAlphabeticBaselineY,
  lineOffsetX,
  lineTopY,
  measureStringWidth,
  resolveCaretDrawRect,
  type TextLayout,
} from "./textMeasure";
import { normalizedRange } from "./textCursor";
import type { TextLayoutForRender, CanonicalTextLayout } from "./canonicalTextLayout";
import { caretXAtIndex } from "./canonicalTextLayout";

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
  /** When set, non-solid fills (gradient, image, video) are painted into glyph shapes. */
  gradientNode?: EditorNode;
  /** Preloaded bitmap/video frame for media text fills during canvas edit. */
  mediaFill?: { source: CanvasImageSource; width: number; height: number } | null;
  /** Precomputed canonical layout — avoids a second layout pass. */
  prepared?: TextLayoutForRender | null;
  /** Multiplier for box padding when the canvas is rendered in screen pixels. */
  layoutScale?: number;
  /** Controls vertical frame inset — auto hug modes use zero vertical pad. */
  textResizeMode?: TextResizeMode;
};

const MAX_TEXT_BITMAP_EDGE = 8192;

function scaleLayoutCoord(value: number, layoutScale: number): number {
  return value * layoutScale;
}

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
  const layoutScale = opts.layoutScale ?? 1;
  const padX = TEXT_BOX_PAD_X * layoutScale;
  const padY = textVerticalPad(opts.textResizeMode, opts.gradientNode) * layoutScale;
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

  const boxInnerW = Math.max(1, w - padX * 2);
  const boxInnerH = Math.max(1, h - padY * 2);
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
    const contentHeight =
      opts.textResizeMode === "auto-width" || opts.textResizeMode === "auto-height"
        ? hugContentHeightForLayout(layout, opts.typo)
        : layout.height;
    blockOffsetY = verticalContentOffsetY(contentHeight, boxInnerH, opts.verticalAlign);
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
      padX,
      padY + blockOffsetY * layoutScale,
      displayStart,
      displayEnd,
      opts.prepared?.canonical,
      opts.prepared?.canonical.lines,
      layoutScale,
    );
  }

  const fillPaint = opts.gradientNode ? textNodeAsFillPaint(opts.gradientNode) : null;
  const fillKind = fillPaint ? effectiveFillType(fillPaint) : "solid";
  const useMaskedFill =
    fillPaint != null && fillPaint.fillEnabled !== false && fillKind !== "solid";
  const layerStroke = opts.gradientNode ? resolveTextLayerStroke(opts.gradientNode) : null;
  const paintFill = opts.gradientNode?.fillEnabled !== false;

  const paintStrokeGlyphs = () => {
    if (!layerStroke) return;
    applyCanvasTextLayerStroke(ctx, layerStroke);
    paintTextGlyphs(ctx, opts, layout, innerW, blockOffsetY, padX, padY, style, "stroke");
    ctx.setLineDash([]);
  };

  if (useMaskedFill) {
    paintStrokeGlyphs();
    paintMaskedTextFill(ctx, opts, layout, innerW, blockOffsetY, padX, padY, style, fillPaint, paintFill);
  } else {
    paintStrokeGlyphs();
    if (paintFill) {
      ctx.fillStyle = opts.typo.color;
      paintTextLinesAndDecorations(ctx, opts, layout, innerW, blockOffsetY, padX, padY, style);
    } else {
      paintTextDecorations(ctx, opts, layout, innerW, blockOffsetY, padX, padY, style);
    }
  }

  if (opts.caretVisible && opts.caretIndex != null) {
    const displayCaret = rawIndexToDisplayIndex(opts.caretIndex, opts.text, style);
    const caret = resolveCaretDrawRect(
      displayCaret,
      layout,
      opts.typo,
      innerW,
      opts.textAlign,
      TEXT_BOX_PAD_X,
      textVerticalPad(opts.textResizeMode, opts.gradientNode),
      blockOffsetY,
      layoutScale,
    );
    const caretWidth = textCaretLayoutWidth({
      zoom: opts.zoom,
      layoutScale: opts.layoutScale,
    });
    const minCaretWidth = 1 / Math.max(1, opts.dpr ?? resolveTextCanvasDpr(w, h, opts.zoom ?? 1));
    ctx.fillStyle = TEXT_CARET_COLOR;
    ctx.fillRect(caret.x, caret.y, Math.max(caretWidth, minCaretWidth), caret.height);
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

function paintTextGlyphs(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  opts: TextCanvasRenderOptions,
  layout: TextLayout,
  innerW: number,
  blockOffsetY: number,
  padX: number,
  padY: number,
  style: TextLayoutStyleOptions,
  mode: "fill" | "stroke" = "fill",
): void {
  const canonical = opts.prepared?.canonical;
  const smallCaps = style.textCase === "small-caps";
  const layoutScale = opts.layoutScale ?? 1;

  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i]!;
    const canonicalLine = canonical?.lines[i];

    if (canonicalLine) {
      const lineBox = canonical?.lineBoxes?.[i];
      const lineTopDoc = lineBox?.top ?? canonicalLine.y;
      const lineHeightDoc = lineBox?.height ?? layout.lineHeightPx;
      // Layout is in document px; renderTypo is already scaled when layoutScale > 1 —
      // scale the line box to match so half-leading math stays in one coordinate space.
      const lineTop = scaleLayoutCoord(lineTopDoc, layoutScale);
      const lineHeight = scaleLayoutCoord(lineHeightDoc, layoutScale);
      const prevBaseline = ctx.textBaseline;
      const useBrowserPaint = canonical?.browserPaint === true;
      ctx.textBaseline = useBrowserPaint ? "top" : "alphabetic";
      const baselineY = useBrowserPaint
        ? 0
        : lineBox && Number.isFinite(lineBox.baseline)
          ? scaleLayoutCoord(lineBox.baseline, layoutScale)
          : canvasAlphabeticBaselineY(lineTop, lineHeight, opts.typo);
      for (const segment of canonicalLine.segments) {
        drawTextAt(
          ctx,
          segment.text,
          scaleLayoutCoord(segment.x, layoutScale),
          useBrowserPaint
            ? scaleLayoutCoord(segment.y, layoutScale)
            : baselineY,
          opts.typo,
          smallCaps,
          mode,
        );
      }
      ctx.textBaseline = prevBaseline;
      continue;
    }

    const isLast = i === layout.lines.length - 1;
    const y =
      scaleLayoutCoord(lineTopY(layout, i) + blockOffsetY, layoutScale) + padY;
    const x =
      lineOffsetX(line.width, innerW, opts.textAlign, {
        isLastLine: isLast,
        fullLineText: line.text,
        letterSpacing: opts.typo.letterSpacing,
      }) + padX;

    if (opts.textAlign === "justify" && !isLast) {
      drawJustifiedLineFallback(ctx, line.text, x, y, innerW, opts.typo, mode);
    } else {
      drawTextAt(ctx, line.text, x, y, opts.typo, smallCaps, mode);
    }
  }
}

function paintTextDecorations(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  opts: TextCanvasRenderOptions,
  layout: TextLayout,
  innerW: number,
  blockOffsetY: number,
  padX: number,
  padY: number,
  style: TextLayoutStyleOptions,
): void {
  if (style.textDecoration === "none") return;
  const canonical = opts.prepared?.canonical;
  const layoutScale = opts.layoutScale ?? 1;
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i]!;
    if (!line.text) continue;
    const canonicalLine = canonical?.lines[i];
    const lineBox = canonical?.lineBoxes?.[i];
    const lineTopDoc = canonicalLine?.y ?? lineTopY(layout, i) + blockOffsetY;
    const lineHeightDoc = lineBox?.height ?? layout.lineHeightPx;
    const y = canvasAlphabeticBaselineY(
      scaleLayoutCoord(lineTopDoc, layoutScale),
      scaleLayoutCoord(lineHeightDoc, layoutScale),
      opts.typo,
    );
    const x =
      (canonicalLine?.x != null
        ? scaleLayoutCoord(canonicalLine.x, layoutScale)
        : lineOffsetX(line.width, innerW * layoutScale, opts.textAlign, {
            isLastLine: i === layout.lines.length - 1,
            fullLineText: line.text,
            letterSpacing: opts.typo.letterSpacing,
          }) + padX);
    const width = scaleLayoutCoord(canonicalLine?.width ?? line.width, layoutScale);
    drawLineDecorations(ctx, x, y, width, opts.typo, style.textDecoration);
  }
}

function paintTextLinesAndDecorations(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  opts: TextCanvasRenderOptions,
  layout: TextLayout,
  innerW: number,
  blockOffsetY: number,
  padX: number,
  padY: number,
  style: TextLayoutStyleOptions,
): void {
  paintTextGlyphs(ctx, opts, layout, innerW, blockOffsetY, padX, padY, style);
  paintTextDecorations(ctx, opts, layout, innerW, blockOffsetY, padX, padY, style);
}

/** Paint fill (gradient/media/solid+opacity) into text glyph shapes via destination-in compositing. */
function paintMaskedTextFill(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  opts: TextCanvasRenderOptions,
  layout: TextLayout,
  innerW: number,
  blockOffsetY: number,
  padX: number,
  padY: number,
  style: TextLayoutStyleOptions,
  fillPaint: ReturnType<typeof textNodeAsFillPaint>,
  paintFill: boolean,
): void {
  const w = Math.max(1, opts.width);
  const h = Math.max(1, opts.height);

  ctx.save();
  if (paintFill) {
    if (!paintNodeFillInBox(ctx, fillPaint, w, h, opts.mediaFill)) {
      const grad = createGradientPaintStyle(ctx, fillPaint, w, h);
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
    paintTextGlyphs(ctx, opts, layout, innerW, blockOffsetY, padX, padY, style, "fill");
    ctx.globalAlpha = prevAlpha;
    ctx.globalCompositeOperation = "source-over";
  }
  paintTextDecorations(ctx, opts, layout, innerW, blockOffsetY, padX, padY, style);
  ctx.restore();
}

/** Paint glyphs at precomputed positions — no measureText. */
function drawTextAt(
  ctx: TextCanvasContext,
  text: string,
  x: number,
  y: number,
  typo: ResolvedTextTypo,
  smallCaps = false,
  mode: "fill" | "stroke" = "fill",
): void {
  if (!text) return;
  const prev = ctx.font;
  if (smallCaps) {
    ctx.font = buildFontString({ ...typo, fontSize: Math.max(1, typo.fontSize * 0.82) });
  }
  const draw =
    mode === "stroke"
      ? (s: string, px: number, py: number) => ctx.strokeText(s, px, py)
      : (s: string, px: number, py: number) => ctx.fillText(s, px, py);
  draw(text, x, y);
  if (smallCaps) ctx.font = prev;
}

/** Bootstrap-only justify when canonical layout is unavailable. */
function drawJustifiedLineFallback(
  ctx: TextCanvasContext,
  text: string,
  x: number,
  y: number,
  boxWidth: number,
  typo: ResolvedTextTypo,
  mode: "fill" | "stroke" = "fill",
): void {
  const words = text.split(/(\s+)/);
  const wordCount = words.filter((w) => w && !/^\s+$/.test(w)).length;
  if (wordCount < 2) {
    drawTextAt(ctx, text, x, y, typo, false, mode);
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
    drawTextAt(ctx, token, cx, y, typo, false, mode);
    cx += measureStringWidth(getTextMeasureContext(), token, typo.letterSpacing);
  }
}

function drawLineDecorations(
  ctx: TextCanvasContext,
  x: number,
  y: number,
  width: number,
  typo: ResolvedTextTypo,
  decoration: TextLayoutStyleOptions["textDecoration"],
): void {
  if (width <= 0 || decoration === "none") return;
  ctx.strokeStyle = typo.color;
  ctx.lineWidth = textDecorationStrokeWidth(typo.fontSize);
  if (decoration === "underline") {
    const uy = underlineDecorationY(y, typo.fontSize, typo.lineHeight);
    ctx.beginPath();
    ctx.moveTo(x, uy);
    ctx.lineTo(x + width, uy);
    ctx.stroke();
  }
  if (decoration === "strikethrough") {
    const sy = strikethroughDecorationY(y, typo.fontSize, typo.lineHeight);
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

  const truncatedLayout = {
    lines,
    lineHeightPx: layout.lineHeightPx,
    firstLineAscent: layout.firstLineAscent,
    firstLineDescent: layout.firstLineDescent,
    paragraphSpacing: layout.paragraphSpacing,
    verticalTrimTop: layout.verticalTrimTop,
  };

  return {
    ...layout,
    lines,
    height: layoutTextContentHeight(truncatedLayout),
    width: Math.max(...lines.map((ln) => ln.width), 0),
  };
}

function drawSelection(
  ctx: TextCanvasContext,
  layout: TextLayout,
  typo: ResolvedTextTypo,
  align: TextAlign,
  innerWidth: number,
  padX: number,
  padY: number,
  start: number,
  end: number,
  canonical?: CanonicalTextLayout,
  canonicalLines?: Array<{ x: number; y: number; text: string; startIndex: number; width: number }>,
  layoutScale = 1,
): void {
  ctx.fillStyle = "rgba(24, 160, 251, 0.35)";

  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i]!;
    const canonicalLine = canonicalLines?.[i];
    const lineStart = line.startIndex;
    const lineEnd = line.startIndex + line.text.length;
    if (end <= lineStart || start >= lineEnd) continue;

    const selStart = Math.max(start, lineStart) - lineStart;
    const selEnd = Math.min(end, lineEnd) - lineStart;
    const lineBox = canonical?.lineBoxes?.[i];
    const lineTopDoc = canonicalLine?.y ?? lineTopY(layout, i);
    const lineHeightDoc = lineBox?.height ?? layout.lineHeightPx;
    const useBrowserPaint = canonical?.browserPaint === true;
    const y =
      scaleLayoutCoord(lineTopDoc, layoutScale) + (useBrowserPaint ? 0 : padY);
    const selH = scaleLayoutCoord(lineHeightDoc, layoutScale);

    if (canonical?.caretStops.length) {
      const x0 = scaleLayoutCoord(caretXAtIndex(canonical.caretStops, lineStart + selStart), layoutScale);
      const x1 = scaleLayoutCoord(caretXAtIndex(canonical.caretStops, lineStart + selEnd), layoutScale);
      ctx.fillRect(x0, y, Math.max(1, x1 - x0), selH);
      continue;
    }

    const before = line.text.slice(0, selStart);
    const selected = line.text.slice(selStart, selEnd);
    const lineX =
      canonicalLine?.x != null
        ? scaleLayoutCoord(canonicalLine.x, layoutScale)
        : lineOffsetX(line.width, innerWidth * layoutScale, align) + padX;
    const x0 =
      lineX + measureStringWidth(getTextMeasureContext(), before, typo.letterSpacing);
    const selW = measureStringWidth(getTextMeasureContext(), selected, typo.letterSpacing);
    ctx.fillRect(x0, y, Math.max(1, selW), selH);
  }
}
