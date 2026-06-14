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
} from "./textNodeModel";
import { verticalContentOffsetY } from "./textVerticalAlign";
import {
  buildFontString,
  getTextMeasureContext,
  layoutText,
  lineTopY,
} from "./textMeasure";

/** Approximate alphabetic baseline offset from a top text baseline (canvas `textBaseline: top`). */
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
  const blockOffsetY = verticalContentOffsetY(layout.height, innerH, model.verticalAlign);
  const ascent = measureTypoAscent(typo);

  return lineTopY(layout, 0) + TEXT_BOX_PAD_Y + blockOffsetY + ascent;
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
