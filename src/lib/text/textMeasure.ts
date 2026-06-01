import type { ResolvedTextTypo } from "@/lib/textTypography";
import type { TextAlign } from "./textNodeModel";

/** One visual line after wrapping; `startIndex` is the offset in the full string. */
export type TextLine = {
  text: string;
  startIndex: number;
  width: number;
};

export type TextLayout = {
  lines: TextLine[];
  width: number;
  height: number;
  lineHeightPx: number;
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
  return `${typo.fontWeight} ${typo.fontSize}px ${typo.fontFamily}`;
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
    return [{ text: paragraph, startIndex, width }];
  }

  if (!paragraph) {
    return [{ text: "", startIndex, width: 0 }];
  }

  const lines: TextLine[] = [];
  let lineStart = 0;
  let line = "";

  const flush = () => {
    lines.push({
      text: line,
      startIndex: startIndex + lineStart,
      width: measureStringWidth(ctx, line, typo.letterSpacing),
    });
    lineStart += line.length;
    line = "";
  };

  const tokens = paragraph.split(/(\s+)/);
  for (const token of tokens) {
    if (!token) continue;
    const candidate = line + token;
    const candidateWidth = measureStringWidth(ctx, candidate, typo.letterSpacing);
    if (candidateWidth <= maxWidth || !line) {
      line = candidate;
      continue;
    }
    flush();
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
): TextLayout {
  const ctx = getTextMeasureContext();
  configureMeasureCtx(ctx, typo);
  const lineHeightPx = typo.fontSize * typo.lineHeight;

  const paragraphs = text.split("\n");
  const lines: TextLine[] = [];
  let index = 0;

  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p] ?? "";
    const wrapped = wrapParagraph(para, index, maxWidth, typo);
    lines.push(...wrapped);
    index += para.length + (p < paragraphs.length - 1 ? 1 : 0);
  }

  if (lines.length === 0) {
    lines.push({ text: "", startIndex: 0, width: 0 });
  }

  let width = 0;
  for (const ln of lines) width = Math.max(width, ln.width);

  return {
    lines,
    width,
    height: Math.max(lineHeightPx, lines.length * lineHeightPx),
    lineHeightPx,
  };
}

/** X offset for a line inside a box with horizontal alignment. */
export function lineOffsetX(lineWidth: number, boxWidth: number, align: TextAlign): number {
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
        y: i * layout.lineHeightPx,
        height: layout.lineHeightPx,
      };
    }
  }

  return { x: 0, y: 0, height: layout.lineHeightPx };
}
