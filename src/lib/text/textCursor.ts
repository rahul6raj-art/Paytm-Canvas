import type { ResolvedTextTypo } from "@/lib/textTypography";
import type { TextNodeModel } from "./textNodeModel";
import {
  TEXT_BOX_PAD_X,
  TEXT_BOX_PAD_Y,
  toTextNodeModel,
  type TextAlign,
} from "./textNodeModel";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  DEFAULT_TEXT_ADVANCED_STYLE,
  displayIndexToRawIndex,
  prepareTextForDisplay,
  rawIndexToDisplayIndex,
  textAdvancedStyleFromNode,
  type TextAdvancedStyle,
} from "./textAdvancedStyle";
import { textLayoutForEditorNode } from "./canonicalTextLayout";
import {
  buildFontString,
  getCaretRect,
  getTextMeasureContext,
  layoutText,
  lineOffsetX,
  lineTopY,
  measureStringWidth,
  type TextLayout,
} from "./textMeasure";
import { textTypoFromModel, wrapWidthForResizeMode } from "./textNodeModel";

/**
 * Convert a canvas-local point (inside the text box) to the nearest character index.
 */
export function getCursorPositionFromPoint(
  x: number,
  y: number,
  textNode: TextNodeModel | EditorNode,
): number {
  const editorNode =
    "content" in textNode && (textNode as EditorNode).type === "text"
      ? (textNode as EditorNode)
      : null;
  const model = editorNode
    ? toTextNodeModel(editorNode, false)
    : (textNode as TextNodeModel);

  if (!model) return 0;

  const style = editorNode ? textAdvancedStyleFromNode(editorNode) : DEFAULT_TEXT_ADVANCED_STYLE;
  const prepared = editorNode ? textLayoutForEditorNode(editorNode) : null;
  const typo = prepared?.typo ?? textTypoFromModel(model);
  const displayText = prepareTextForDisplay(model.text, style);
  const layout =
    prepared?.layout ??
    layoutText(
      displayText,
      wrapWidthForResizeMode(model.width, model.textResizeMode),
      typo,
      style,
    );

  const innerW = prepared?.innerW ?? model.width - TEXT_BOX_PAD_X * 2;
  const displayIndex = cursorIndexFromPoint(
    x,
    y,
    layout,
    typo,
    innerW,
    model.textAlign,
    displayText.length,
    prepared?.canonical.lines,
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
  canonicalLines?: Array<{ y: number; x: number; text: string; startIndex: number }>,
): number {
  if (layout.lines.length === 0) return 0;

  const lineIdx = lineIndexFromLocalY(localY, layout, canonicalLines);
  const line = layout.lines[lineIdx]!;
  const canonicalLine = canonicalLines?.[lineIdx];
  const lineX = canonicalLine?.x ?? lineOffsetX(line.width, boxWidth, align) + TEXT_BOX_PAD_X;
  const relX = localX - lineX;

  if (layout.caretStops && layout.caretStops.length > 0) {
    const lineStops = layout.caretStops.filter(
      (stop) => stop.index >= line.startIndex && stop.index <= line.startIndex + line.text.length,
    );
    if (lineStops.length > 0) {
      let best = lineStops[0]!;
      let bestDist = Math.abs(best.x - localX);
      for (const stop of lineStops) {
        const dist = Math.abs(stop.x - localX);
        if (dist < bestDist) {
          best = stop;
          bestDist = dist;
        }
      }
      return Math.max(0, Math.min(best.index, textLength));
    }
  }

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

function lineIndexFromLocalY(
  localY: number,
  layout: TextLayout,
  canonicalLines?: Array<{ y: number }>,
): number {
  for (let i = 0; i < layout.lines.length; i++) {
    const top = canonicalLines?.[i]?.y ?? lineTopY(layout, i) + TEXT_BOX_PAD_Y;
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
  style?: TextAdvancedStyle,
): number {
  if (key === "ArrowLeft") return Math.max(0, index - 1);
  if (key === "ArrowRight") return Math.min(text.length, index + 1);

  const displayIndex = style ? rawIndexToDisplayIndex(index, text, style) : index;
  const displayLength = style ? prepareTextForDisplay(text, style).length : text.length;
  const caretRect = getCaretRect(displayIndex, layout, typo, boxWidth, align);
  const caret = { x: caretRect.x, y: caretRect.y + layout.lineHeightPx * 0.5 };
  const targetY =
    key === "ArrowUp" ? caret.y - layout.lineHeightPx * 0.5 : caret.y + layout.lineHeightPx * 1.5;
  const nextDisplay = cursorIndexFromPoint(
    caret.x,
    targetY,
    layout,
    typo,
    boxWidth,
    align,
    displayLength,
  );
  return style ? displayIndexToRawIndex(nextDisplay, text, style) : nextDisplay;
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
