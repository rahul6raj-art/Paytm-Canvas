import type { ResolvedTextTypo } from "@/lib/textTypography";
import type { TextNodeModel } from "./textNodeModel";
import {
  TEXT_BOX_PAD_X,
  TEXT_BOX_PAD_Y,
  toTextNodeModel,
  wrapWidthForResizeMode,
} from "./textNodeModel";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  getTextMeasureContext,
  layoutText,
  lineOffsetX,
  measureStringWidth,
  buildFontString,
  type TextLayout,
} from "./textMeasure";
import type { TextAlign } from "./textNodeModel";
import { textTypoFromModel } from "./textNodeModel";

/**
 * Convert a canvas-local point (inside the text box) to the nearest character index.
 *
 * Algorithm:
 * 1. Pick the line from Y using lineHeightPx.
 * 2. Subtract alignment offset to get X relative to line start.
 * 3. Walk characters with measureText, return the index with minimum distance.
 */
export function getCursorPositionFromPoint(
  x: number,
  y: number,
  textNode: TextNodeModel | EditorNode,
): number {
  const model =
    "text" in textNode && textNode.type === "text" && "textAlign" in textNode
      ? (textNode as TextNodeModel)
      : toTextNodeModel(textNode as EditorNode, false);

  if (!model) return 0;

  const typo = textTypoFromModel(model);
  const wrapWidth = wrapWidthForResizeMode(model.width, model.textResizeMode);
  const innerW = model.width - TEXT_BOX_PAD_X * 2;
  const layout = layoutText(model.text, wrapWidth, typo);
  return cursorIndexFromPoint(
    x - TEXT_BOX_PAD_X,
    y - TEXT_BOX_PAD_Y,
    layout,
    typo,
    innerW,
    model.textAlign,
    model.text.length,
  );
}

export function cursorIndexFromPoint(
  localX: number,
  localY: number,
  layout: TextLayout,
  typo: ResolvedTextTypo,
  boxWidth: number,
  align: TextAlign,
  textLength: number,
): number {
  if (layout.lines.length === 0) return 0;

  const lineIdx = Math.max(
    0,
    Math.min(layout.lines.length - 1, Math.floor(localY / layout.lineHeightPx)),
  );
  const line = layout.lines[lineIdx]!;
  const relX = localX - lineOffsetX(line.width, boxWidth, align);

  const ctx = getTextMeasureContext();
  ctx.font = buildFontString(typo);

  let bestIndex = line.startIndex;
  let bestDist = Infinity;

  for (let i = 0; i <= line.text.length; i++) {
    const w = measureStringWidth(ctx, line.text.slice(0, i), typo.letterSpacing);
    const dist = Math.abs(w - relX);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = line.startIndex + i;
    }
  }

  if (lineIdx < layout.lines.length - 1 && relX > line.width) {
    const next = layout.lines[lineIdx + 1]!;
    return next.startIndex;
  }

  return Math.max(0, Math.min(bestIndex, textLength));
}

/** Move caret with arrow keys through wrapped lines. */
export function moveCaretWithArrow(
  key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown",
  index: number,
  text: string,
  layout: TextLayout,
  typo: ResolvedTextTypo,
  boxWidth: number,
  align: TextAlign,
): number {
  if (key === "ArrowLeft") return Math.max(0, index - 1);
  if (key === "ArrowRight") return Math.min(text.length, index + 1);

  const caret = getCaretRectForIndex(index, layout, typo, boxWidth, align);
  const targetY =
    key === "ArrowUp" ? caret.y - layout.lineHeightPx * 0.5 : caret.y + layout.lineHeightPx * 1.5;
  return cursorIndexFromPoint(caret.x, targetY, layout, typo, boxWidth, align, text.length);
}

function getCaretRectForIndex(
  index: number,
  layout: TextLayout,
  typo: ResolvedTextTypo,
  boxWidth: number,
  align: TextAlign,
): { x: number; y: number } {
  const ctx = getTextMeasureContext();
  ctx.font = buildFontString(typo);

  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i]!;
    const end = line.startIndex + line.text.length;
    if (index <= end || i === layout.lines.length - 1) {
      const local = Math.max(0, Math.min(index - line.startIndex, line.text.length));
      const x =
        lineOffsetX(line.width, boxWidth, align) +
        measureStringWidth(ctx, line.text.slice(0, local), typo.letterSpacing);
      return { x, y: i * layout.lineHeightPx + layout.lineHeightPx * 0.5 };
    }
  }
  return { x: 0, y: 0 };
}

export function collapsedSelection(index: number): { anchor: number; focus: number } {
  return { anchor: index, focus: index };
}

export function normalizedRange(
  anchor: number,
  focus: number,
): { start: number; end: number } {
  return anchor <= focus ? { start: anchor, end: focus } : { start: focus, end: anchor };
}
