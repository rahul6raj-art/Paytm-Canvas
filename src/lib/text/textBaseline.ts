import { getNodeWorldMatrixFromChildOrder } from "@/lib/editorGraph";
import { applyMatrixToPoint } from "@/lib/transformMath";
import type { ResolvedTextTypo } from "@/lib/textTypography";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  prepareTextForDisplay,
  textAdvancedStyleFromNode,
} from "./textAdvancedStyle";
import {
  TEXT_BOX_PAD_Y,
  textInnerHeight,
  textInnerWidth,
  textTypoFromModel,
  toTextNodeModel,
  wrapWidthForResizeMode,
  type TextResizeMode,
} from "./textNodeModel";
import { verticalContentOffsetY } from "./textVerticalAlign";
import {
  buildFontString,
  getTextMeasureContext,
  layoutText,
  lineTopY,
  type TextLayout,
} from "./textMeasure";

/** Approximate alphabetic baseline offset from em top (canvas `textBaseline: top`). */
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

/** Map canvas line-top y (`textBaseline: top`) to SVG `<tspan y>` with `dominant-baseline: alphabetic`. */
export function svgTextTspanY(canvasLineTopY: number, typo: ResolvedTextTypo): number {
  return canvasLineTopY + measureTypoAscent(typo);
}

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

/** Tight single-line height from font metrics (Figma hug-contents vertical). */
export function tightLineHeightPx(typo: ResolvedTextTypo): number {
  return measureTypoAscent(typo) + measureTypoDescent(typo);
}

/** Ink height when the anchor uses canvas/SVG `textBaseline: top` at the line box top. */
export function measureTextPaintHeight(text: string, typo: ResolvedTextTypo): number {
  if (typeof document === "undefined") {
    return typo.fontSize + typo.fontSize * 0.22;
  }
  const ctx = getTextMeasureContext();
  const prevBaseline = ctx.textBaseline;
  ctx.font = buildFontString(typo);
  ctx.textBaseline = "top";
  const sample = text.length > 0 ? text : " ";
  const metrics = ctx.measureText(sample);
  ctx.textBaseline = prevBaseline;
  const ascent =
    metrics.actualBoundingBoxAscent ??
    metrics.fontBoundingBoxAscent ??
    typo.fontSize * 0.82;
  const descent =
    metrics.actualBoundingBoxDescent ??
    metrics.fontBoundingBoxDescent ??
    typo.fontSize * 0.22;
  return Math.max(typo.fontSize, ascent + descent);
}

function hugFirstLineHeight(
  layout: Pick<TextLayout, "lines" | "verticalTrimTop">,
  typo: ResolvedTextTypo,
): number {
  const trim = layout.verticalTrimTop * 2;
  const lineText = layout.lines[0]?.text ?? "";
  const paintH = lineText ? measureTextPaintHeight(lineText, typo) : tightLineHeightPx(typo);
  return Math.max(typo.fontSize * 0.5, paintH - trim);
}

/** Hug-contents height: ink bounds on first line, line-height stepping for wrapped lines. */
export function hugContentHeightForLayout(
  layout: Pick<TextLayout, "lines" | "lineHeightPx" | "paragraphSpacing" | "verticalTrimTop">,
  typo: ResolvedTextTypo,
): number {
  if (layout.lines.length <= 1) {
    return hugFirstLineHeight(layout, typo);
  }
  let height = hugFirstLineHeight(layout, typo);
  for (let i = 1; i < layout.lines.length; i++) {
    height += layout.lineHeightPx;
    if (layout.lines[i]?.paragraphStart) {
      height += layout.paragraphSpacing;
    }
  }
  return height;
}

/** Content height used for vertical alignment inside the text box. */
export function textBlockContentHeight(
  layout: Pick<TextLayout, "lines" | "height" | "lineHeightPx" | "paragraphSpacing" | "verticalTrimTop">,
  typo: ResolvedTextTypo,
  mode: TextResizeMode,
): number {
  if (mode === "auto-width" || mode === "auto-height") {
    return hugContentHeightForLayout(layout, typo);
  }
  return layout.height;
}

/** First-line baseline Y in the text node's local box coordinates. */
export function textBaselineLocalY(node: EditorNode): number | null {
  const model = toTextNodeModel(node, false);
  if (!model) return null;

  const typo = textTypoFromModel(model);
  const style = textAdvancedStyleFromNode(node);
  const innerW = textInnerWidth(model.width);
  const innerH = textInnerHeight(model.height);
  const wrapWidth = wrapWidthForResizeMode(model.width, model.textResizeMode);
  const effectiveWrap =
    wrapWidth === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Math.min(wrapWidth, innerW));
  const displayText = prepareTextForDisplay(model.text, style);
  const layout = layoutText(displayText, effectiveWrap, typo, style);
  const contentHeight = textBlockContentHeight(layout, typo, model.textResizeMode ?? "auto-width");
  const blockOffsetY = verticalContentOffsetY(contentHeight, innerH, model.verticalAlign);
  const lineBoxTop = lineTopY(layout, 0) + TEXT_BOX_PAD_Y + blockOffsetY;

  return lineBoxTop + measureTypoAscent(typo);
}

/** Baseline segment across the text box width in world coordinates. */
export function textBaselineWorldSegment(
  nodeId: string,
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const baselineY = textBaselineLocalY(node);
  if (baselineY == null) return null;

  const wm = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (!wm) return null;

  const w = Math.max(1, node.width);
  const p1 = applyMatrixToPoint(wm, { x: 0, y: baselineY });
  const p2 = applyMatrixToPoint(wm, { x: w, y: baselineY });
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}
