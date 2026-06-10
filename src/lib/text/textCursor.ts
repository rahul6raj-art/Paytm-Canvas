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
  DEFAULT_TEXT_ADVANCED_STYLE,
  textAdvancedStyleFromNode,
  displayIndexToRawIndex,
  layoutDisplayText,
  prepareTextForDisplay,
  rawIndexToDisplayIndex,
  type TextAdvancedStyle,
} from "./textAdvancedStyle";
import {
  getTextMeasureContext,
  layoutText,
  lineOffsetX,
  lineTopY,
  measureStringWidth,
  buildFontString,
  type TextLayout,
} from "./textMeasure";
import type { TextAlign } from "./textNodeModel";
import { textTypoFromModel } from "./textNodeModel";
import { verticalContentOffsetY } from "./textVerticalAlign";

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
  const editorNode = "content" in textNode ? (textNode as EditorNode) : null;
  const style: TextAdvancedStyle = editorNode
    ? textAdvancedStyleFromNode(editorNode)
    : DEFAULT_TEXT_ADVANCED_STYLE;
  const displayText = prepareTextForDisplay(model.text, style);
  const layout = editorNode
    ? layoutDisplayText(model.text, wrapWidth, editorNode).layout
    : layoutText(displayText, wrapWidth, typo, style);
  const innerH = model.height - TEXT_BOX_PAD_Y * 2;
  const blockY = verticalContentOffsetY(layout.height, innerH, model.verticalAlign);
  const displayIndex = cursorIndexFromPoint(
    x - TEXT_BOX_PAD_X,
    y - TEXT_BOX_PAD_Y - blockY,
    layout,
    typo,
    innerW,
    model.textAlign,
    displayText.length,
  );
  return displayIndexToRawIndex(displayIndex, model.text, style);
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

  const lineIdx = lineIndexFromLocalY(localY, layout);
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

function lineIndexFromLocalY(localY: number, layout: TextLayout): number {
  for (let i = 0; i < layout.lines.length; i++) {
    const top = lineTopY(layout, i);
    const bottom = top + layout.lineHeightPx;
    if (localY < bottom || i === layout.lines.length - 1) return i;
  }
  return Math.max(0, layout.lines.length - 1);
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
  style?: import("./textAdvancedStyle").TextAdvancedStyle,
): number {
  if (key === "ArrowLeft") return Math.max(0, index - 1);
  if (key === "ArrowRight") return Math.min(text.length, index + 1);

  const displayIndex = style ? rawIndexToDisplayIndex(index, text, style) : index;
  const displayLength = style ? prepareTextForDisplay(text, style).length : text.length;
  const caret = getCaretRectForIndex(displayIndex, layout, typo, boxWidth, align);
  const targetY =
    key === "ArrowUp" ? caret.y - layout.lineHeightPx * 0.5 : caret.y + layout.lineHeightPx * 1.5;
  const nextDisplay = cursorIndexFromPoint(caret.x, targetY, layout, typo, boxWidth, align, displayLength);
  return style ? displayIndexToRawIndex(nextDisplay, text, style) : nextDisplay;
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
      return { x, y: lineTopY(layout, i) + layout.lineHeightPx * 0.5 };
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
