import type { EditorNode } from "@/stores/useEditorStore";
import { resolveTextTypo } from "@/lib/textTypography";
import {
  layoutTextCanonical,
  textLayoutForEditorNode,
  type CanonicalTextLayout,
  type TextLayoutForRender,
} from "../canonicalTextLayout";
import { prepareTextForDisplay, textAdvancedStyleFromNode } from "../textAdvancedStyle";
import {
  nodeForTextLayout,
  normalizeTextAlign,
  normalizeTextResizeMode,
  toTextNodeModel,
} from "../textNodeModel";
import {
  lineHeightUnitFromNode,
  resolveLineHeightPx,
  resolveTextFontMetrics,
} from "./fontMetrics";
import type { TextLayoutInput, TextPipelineResult } from "./types";
import { buildTextPaintPlan } from "./textPaintFromLayout";

const measurementDirty = new Set<string>();

/** Mark a node for full layout re-measurement on next pipeline pass. */
export function markTextMeasurementDirty(nodeId: string): void {
  measurementDirty.add(nodeId);
}

export function clearTextMeasurementDirty(nodeId?: string): void {
  if (!nodeId) {
    measurementDirty.clear();
    return;
  }
  measurementDirty.delete(nodeId);
}

export function isTextMeasurementDirty(nodeId: string): boolean {
  return measurementDirty.has(nodeId);
}

export function textLayoutInputFromNode(node: EditorNode): TextLayoutInput | null {
  const model = toTextNodeModel(node, false);
  if (!model) return null;
  const style = textAdvancedStyleFromNode(node);
  return {
    nodeId: model.id,
    content: model.text,
    width: model.width,
    height: model.height,
    typo: resolveTextTypo(node),
    style,
    textAlign: normalizeTextAlign(model.textAlign),
    textResizeMode: normalizeTextResizeMode(model.textResizeMode, model.autoResize),
    lineHeightUnit: lineHeightUnitFromNode(node),
  };
}

/**
 * Text Content → Font Resolution → Shaping → Measurement → Line Layout → Alignment
 * Single orchestrated entry — rendering consumes the returned paint plan only.
 */
export function runTextLayoutPipeline(
  node: EditorNode,
  opts?: { bypassCache?: boolean },
): TextPipelineResult | null {
  const layoutNode = nodeForTextLayout(node);
  const input = textLayoutInputFromNode(layoutNode);
  if (!input) return null;

  const bypass = opts?.bypassCache || measurementDirty.has(layoutNode.id);
  if (bypass) measurementDirty.delete(layoutNode.id);

  const prepared = textLayoutForEditorNode(layoutNode);
  if (!prepared) return null;

  let lineHeightPx = resolveLineHeightPx(
    input.typo.fontSize,
    layoutNode.lineHeight,
    input.lineHeightUnit,
  );
  if (input.lineHeightUnit === "auto") {
    lineHeightPx = prepared.layout.lineHeightPx;
  }
  const metrics = resolveTextFontMetrics(
    input.typo,
    lineHeightPx,
    prepared.canonical.fontMetrics,
  );

  const paint = buildTextPaintPlan(prepared, metrics, layoutNode);

  return { prepared, paint, canonical: prepared.canonical };
}

/** Shaping + measurement only (no paint plan). Used by box auto-size helpers. */
export function measureTextNodeLayout(
  node: EditorNode,
  opts?: { bypassCache?: boolean },
): CanonicalTextLayout | null {
  const layoutNode = nodeForTextLayout(node);
  const style = textAdvancedStyleFromNode(layoutNode);
  const model = toTextNodeModel(layoutNode, false);
  if (!model) return null;
  const displayText = prepareTextForDisplay(model.text, style);
  return layoutTextCanonical(layoutNode, {
    bypassCache: opts?.bypassCache,
  });
}

export type { TextLayoutForRender };
