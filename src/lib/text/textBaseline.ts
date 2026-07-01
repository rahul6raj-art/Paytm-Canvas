import { getNodeWorldMatrixFromChildOrder } from "@/lib/editorGraph";
import { applyMatrixToPoint } from "@/lib/transformMath";
import type { ResolvedTextTypo } from "@/lib/textTypography";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  buildFontString,
  getTextMeasureContext,
  layoutTextFrameContentHeight,
  canvasAlphabeticBaselineY,
  measureTypoAscent,
  measureTypoDescent,
  type TextLayout,
} from "./textMeasure";
import type { TextResizeMode } from "./textNodeModel";

export { measureTypoAscent, measureTypoDescent } from "./textMeasure";

/** Map line box top to SVG `<tspan y>` with `dominant-baseline: alphabetic` (includes CSS half-leading). */
export function svgTextTspanY(
  lineBoxTopY: number,
  typo: ResolvedTextTypo,
  lineHeightPx: number = typo.lineHeightPx,
): number {
  return canvasAlphabeticBaselineY(lineBoxTopY, lineHeightPx, typo);
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


/** Hug-contents height: sum of line boxes (never glyph bbox metrics). */
export function hugContentHeightForLayout(
  layout: Pick<
    TextLayout,
    "lines" | "lineHeightPx" | "paragraphSpacing" | "verticalTrimTop"
  >,
  _typo?: ResolvedTextTypo,
): number {
  return layoutTextFrameContentHeight(layout);
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
  // Lazy import avoids circular dependency with canonicalTextLayout → textBaseline.
  const { textLayoutForEditorNode } = require("./canonicalTextLayout") as typeof import("./canonicalTextLayout");
  const prepared = textLayoutForEditorNode(node);
  if (!prepared) return null;
  const lineBox = prepared.canonical.lineBoxes[0];
  if (lineBox && Number.isFinite(lineBox.baseline)) {
    return lineBox.baseline;
  }
  const firstLine = prepared.canonical.lines[0];
  if (!firstLine) return null;
  return canvasAlphabeticBaselineY(firstLine.y, prepared.layout.lineHeightPx, prepared.typo);
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
