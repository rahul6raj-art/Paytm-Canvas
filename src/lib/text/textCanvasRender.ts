import type { ResolvedTextTypo } from "@/lib/textTypography";
import { TEXT_BOX_PAD_X, TEXT_BOX_PAD_Y, type TextAlign } from "./textNodeModel";
import {
  buildFontString,
  getTextMeasureContext,
  layoutText,
  lineOffsetX,
  measureStringWidth,
  type TextLayout,
} from "./textMeasure";
import { getCaretRect } from "./textMeasure";
import { normalizedRange } from "./textCursor";

export type TextCanvasRenderOptions = {
  typo: ResolvedTextTypo;
  text: string;
  width: number;
  height: number;
  textAlign: TextAlign;
  wrapWidth: number;
  selection?: { anchor: number; focus: number } | null;
  caretIndex?: number | null;
  caretVisible?: boolean;
  /** Viewport zoom — bitmap is scaled by CSS, so bake zoom into backing-store resolution. */
  zoom?: number;
  dpr?: number;
};

const MAX_TEXT_BITMAP_EDGE = 8192;

/**
 * Backing-store scale so text stays sharp when the canvas scene is CSS-zoomed.
 * Caps total bitmap size to avoid huge allocations at extreme zoom.
 */
export function resolveTextCanvasDpr(
  cssWidth: number,
  cssHeight: number,
  zoom = 1,
): number {
  const base = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const desired = Math.max(1, base * Math.max(1, zoom));
  const maxByW = MAX_TEXT_BITMAP_EDGE / Math.max(1, cssWidth);
  const maxByH = MAX_TEXT_BITMAP_EDGE / Math.max(1, cssHeight);
  return Math.max(1, Math.min(desired, maxByW, maxByH));
}

/** Draw text, selection highlight, and caret onto a canvas context (local box coords). */
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
  ctx.font = buildFontString(opts.typo);
  ctx.textBaseline = "top";
  ctx.fillStyle = opts.typo.color;

  const innerW = Math.max(1, w - TEXT_BOX_PAD_X * 2);
  const wrapWidth =
    opts.wrapWidth === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Math.min(opts.wrapWidth, innerW));
  const layout = layoutText(opts.text, wrapWidth, opts.typo);

  if (opts.selection && opts.selection.anchor !== opts.selection.focus) {
    const { start, end } = normalizedRange(opts.selection.anchor, opts.selection.focus);
    drawSelection(
      ctx,
      layout,
      opts.typo,
      opts.textAlign,
      innerW,
      TEXT_BOX_PAD_X,
      TEXT_BOX_PAD_Y,
      start,
      end,
    );
  }

  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i]!;
    const x = lineOffsetX(line.width, innerW, opts.textAlign) + TEXT_BOX_PAD_X;
    const y = i * layout.lineHeightPx + TEXT_BOX_PAD_Y;
    drawLineWithSpacing(ctx, line.text, x, y, opts.typo);
  }

  if (opts.caretVisible && opts.caretIndex != null) {
    const caret = getCaretRect(opts.caretIndex, layout, opts.typo, innerW, opts.textAlign);
    ctx.fillStyle = opts.typo.color;
    ctx.fillRect(caret.x + TEXT_BOX_PAD_X, caret.y + TEXT_BOX_PAD_Y, 1, caret.height);
  }

  return layout;
}

function drawLineWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  typo: ResolvedTextTypo,
): void {
  if (!typo.letterSpacing) {
    ctx.fillText(text, x, y);
    return;
  }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + typo.letterSpacing;
  }
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
    const y = i * layout.lineHeightPx + padY;
    ctx.fillRect(x0, y, Math.max(1, selW), layout.lineHeightPx);
  }
}
