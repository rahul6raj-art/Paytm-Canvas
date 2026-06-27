import type { EditorNode } from "@/stores/useEditorStore";
import { DEFAULT_TEXT_FONT_SIZE } from "@/lib/textTypography";
import type { LineHeightUnit } from "@/lib/text/pipeline/types";
import type { ResolvedTextTypo } from "@/lib/textTypography";

export type { LineHeightUnit };

export const AUTO_LINE_HEIGHT_MULTIPLIER = 1.2;
export const DEFAULT_LINE_HEIGHT_PERCENT = 125;

/** Legacy nodes stored unitless multipliers (e.g. 1.25); Figma uses whole percents (125). */
export function lineHeightPercentStoredToMultiplier(stored: number): number {
  if (stored <= 4) return stored;
  return stored / 100;
}

export function lineHeightPercentMultiplierToStored(multiplier: number): number {
  return Math.round(multiplier * 100);
}

export type LineHeightStylePatch = {
  lineHeight?: number;
  lineHeightUnit: LineHeightUnit;
};

/** True when line height follows font metrics (Figma Auto). */
export function isAutoLineHeight(
  node: Pick<EditorNode, "lineHeight" | "lineHeightUnit">,
): boolean {
  if (node.lineHeightUnit === "auto") return true;
  if (node.lineHeightUnit === "px" || node.lineHeightUnit === "percent") return false;
  return node.lineHeight == null;
}

/** Resolve the stored unit; legacy nodes with only `lineHeight` use percent. */
export function lineHeightUnitFromNode(
  node: Pick<EditorNode, "lineHeight" | "lineHeightUnit">,
): LineHeightUnit {
  const u = node.lineHeightUnit;
  if (u === "auto" || u === "px" || u === "percent") return u;
  return node.lineHeight != null ? "percent" : "auto";
}

/** Auto line height fallback when font metrics are unavailable (SSR/tests). */
export function resolveAutoLineHeightPx(fontSize: number): number {
  return Math.round(Math.max(1, fontSize) * AUTO_LINE_HEIGHT_MULTIPLIER);
}

/** Resolve line height in px from font size and node settings. */
export function resolveLineHeightPx(
  fontSize: number,
  lineHeight: number | undefined,
  unit: LineHeightUnit = "percent",
  _typo?: Pick<ResolvedTextTypo, "fontFamily" | "fontSize" | "fontWeight">,
): number {
  const fs = Math.max(1, fontSize);
  if (unit === "auto") {
    return resolveAutoLineHeightPx(fs);
  }
  if (unit === "px") {
    return Math.max(1, lineHeight ?? fs * AUTO_LINE_HEIGHT_MULTIPLIER);
  }
  const stored = lineHeight ?? DEFAULT_LINE_HEIGHT_PERCENT;
  const mult = lineHeightPercentStoredToMultiplier(stored);
  return fs * Math.max(0.5, mult);
}

export function resolveLineHeightPxFromNode(
  node: Pick<
    EditorNode,
    "fontSize" | "fontWeight" | "fontFamily" | "lineHeight" | "lineHeightUnit"
  >,
): number {
  const fontSize = node.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
  const typo = {
    fontFamily: node.fontFamily ?? "Inter",
    fontSize,
    fontWeight: node.fontWeight ?? 400,
  };
  return resolveLineHeightPx(
    fontSize,
    node.lineHeight,
    lineHeightUnitFromNode(node),
  );
}

/** Unitless multiplier matching layout / canvas rendering. */
export function effectiveLineHeightMultiplier(
  node: Pick<
    EditorNode,
    "fontSize" | "fontWeight" | "fontFamily" | "lineHeight" | "lineHeightUnit"
  >,
): number {
  const fontSize = node.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
  return resolveLineHeightPxFromNode(node) / Math.max(1, fontSize);
}

export function lineHeightPercentPatch(value: number): LineHeightStylePatch {
  return { lineHeight: value, lineHeightUnit: "percent" };
}

export function lineHeightPxPatch(value: number): LineHeightStylePatch {
  return { lineHeight: value, lineHeightUnit: "px" };
}

export function lineHeightAutoPatch(): LineHeightStylePatch {
  return { lineHeight: undefined, lineHeightUnit: "auto" };
}

/** Inspector percent display (Figma-style whole number). */
export function lineHeightPercentDisplayFromNode(
  node: Pick<EditorNode, "lineHeight" | "lineHeightUnit">,
): number {
  if (isAutoLineHeight(node)) return DEFAULT_LINE_HEIGHT_PERCENT;
  const stored = node.lineHeight ?? DEFAULT_LINE_HEIGHT_PERCENT;
  if (lineHeightUnitFromNode(node) === "percent") {
    return stored <= 4 ? lineHeightPercentMultiplierToStored(stored) : stored;
  }
  return DEFAULT_LINE_HEIGHT_PERCENT;
}
