import type { EditorNode } from "@/stores/useEditorStore";
import { DEFAULT_TEXT_FONT_SIZE } from "@/lib/textTypography";

export type LetterSpacingUnit = "percent" | "px";

export type LetterSpacingStylePatch = {
  letterSpacing: number;
  letterSpacingUnit: LetterSpacingUnit;
};

const MIN_LETTER_SPACING_RATIO = -0.25;

/** Legacy nodes stored absolute px; new edits may use percent of font size. */
export function letterSpacingUnitFromNode(
  node: Pick<EditorNode, "letterSpacing" | "letterSpacingUnit">,
): LetterSpacingUnit {
  const u = node.letterSpacingUnit;
  if (u === "percent" || u === "px") return u;
  return "px";
}

export function clampLetterSpacingPx(px: number, fontSize: number): number {
  const min = Math.max(-999, fontSize * MIN_LETTER_SPACING_RATIO);
  return Math.max(min, Math.min(999, px));
}

export function resolveLetterSpacingPx(
  fontSize: number,
  letterSpacing: number | undefined,
  unit: LetterSpacingUnit = "px",
): number {
  const stored = letterSpacing ?? 0;
  const px =
    unit === "percent"
      ? (Math.max(1, fontSize) * stored) / 100
      : stored;
  return clampLetterSpacingPx(px, fontSize);
}

export function resolveLetterSpacingPxFromNode(
  node: Pick<EditorNode, "fontSize" | "letterSpacing" | "letterSpacingUnit">,
): number {
  const fontSize = node.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
  return resolveLetterSpacingPx(fontSize, node.letterSpacing, letterSpacingUnitFromNode(node));
}

/** Inspector value as a percent of font size (Figma-style). */
export function letterSpacingPercentFromNode(
  node: Pick<EditorNode, "fontSize" | "letterSpacing" | "letterSpacingUnit">,
): number {
  const fontSize = Math.max(1, node.fontSize ?? DEFAULT_TEXT_FONT_SIZE);
  const stored = node.letterSpacing ?? 0;
  if (letterSpacingUnitFromNode(node) === "percent") return stored;
  return (stored / fontSize) * 100;
}

export function letterSpacingPxFromNode(
  node: Pick<EditorNode, "fontSize" | "letterSpacing" | "letterSpacingUnit">,
): number {
  return resolveLetterSpacingPxFromNode(node);
}

export function letterSpacingPercentPatch(value: number): LetterSpacingStylePatch {
  return { letterSpacing: value, letterSpacingUnit: "percent" };
}

export function letterSpacingPxPatch(value: number): LetterSpacingStylePatch {
  return { letterSpacing: value, letterSpacingUnit: "px" };
}

/** Default for nodes without letter spacing. */
export function defaultLetterSpacingPatch(): LetterSpacingStylePatch {
  return { letterSpacing: 0, letterSpacingUnit: "px" };
}
