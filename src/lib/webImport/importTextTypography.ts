import type { EditorNode } from "@/stores/useEditorStore";
import {
  lineHeightPercentMultiplierToStored,
  type LineHeightUnit,
} from "@/lib/text/lineHeight";
import type { ExtractedTypography } from "@/lib/webImport/types";

/**
 * DOM capture stores lineHeight as a unitless ratio (e.g. 1.11) but omits lineHeightUnit.
 * Without the unit, raw px values (40) are misread as Figma percent → tiny line boxes →
 * baseline guide sits on top of glyphs and text looks vertically wrong.
 */
export function fixImportedTextLineHeightUnit(node: EditorNode): EditorNode {
  if (node.type !== "text" || node.lineHeight == null) return node;
  if (node.lineHeightUnit === "px" || node.lineHeightUnit === "auto") return node;

  const lh = node.lineHeight;
  const fs = Math.max(1, node.fontSize ?? 14);

  if (lh >= 50 && lh <= 500) {
    return node.lineHeightUnit === "percent"
      ? node
      : { ...node, lineHeightUnit: "percent" as LineHeightUnit };
  }

  if (lh > 0 && lh <= 4) {
    return {
      ...node,
      lineHeight: lineHeightPercentMultiplierToStored(lh),
      lineHeightUnit: "percent",
    };
  }

  if (lh > 4 && lh <= fs * 4) {
    return { ...node, lineHeight: Math.round(lh), lineHeightUnit: "px" };
  }

  return node;
}

export function applyImportedTypographyFields(
  node: EditorNode,
  typography: ExtractedTypography | undefined,
): EditorNode {
  return { ...node, ...typographyFieldsFromExtracted(typography) };
}

export function typographyFieldsFromExtracted(
  typography: ExtractedTypography | undefined,
): Pick<
  EditorNode,
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "lineHeight"
  | "lineHeightUnit"
  | "letterSpacing"
  | "textAlign"
  | "verticalAlign"
  | "textDecoration"
> {
  const draft = {
    type: "text" as const,
    fontFamily: typography?.fontFamily ?? "Inter, sans-serif",
    fontSize: typography?.fontSize ?? 14,
    fontWeight: typography?.fontWeight ?? 400,
    lineHeight: typography?.lineHeight,
    letterSpacing: typography?.letterSpacing,
    textDecoration: typography?.textDecoration as EditorNode["textDecoration"],
    textAlign: typography?.textAlign ?? "left",
    verticalAlign: typography?.verticalAlign,
  } as EditorNode;
  const fixed = fixImportedTextLineHeightUnit(draft);
  return {
    fontFamily: fixed.fontFamily,
    fontSize: fixed.fontSize,
    fontWeight: fixed.fontWeight,
    lineHeight: fixed.lineHeight,
    lineHeightUnit: fixed.lineHeightUnit,
    letterSpacing: fixed.letterSpacing,
    textAlign: fixed.textAlign,
    verticalAlign: fixed.verticalAlign,
    textDecoration: fixed.textDecoration,
  };
}

/** Fix line-height units on all imported text layers after live capture. */
export function normalizeImportedTextTypography(nodes: Record<string, EditorNode>): void {
  for (const [id, n] of Object.entries(nodes)) {
    if (n.type !== "text") continue;
    nodes[id] = fixImportedTextLineHeightUnit(n);
  }
}
