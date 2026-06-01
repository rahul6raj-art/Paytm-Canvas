import type { EditorNode } from "@/stores/useEditorStore";
import { resolveTextTypo, type ResolvedTextTypo } from "@/lib/textTypography";

/** Horizontal alignment for text nodes. */
export type TextAlign = "left" | "center" | "right";

/** How the text box resizes relative to its content. */
export type TextResizeMode = "auto-width" | "auto-height" | "fixed";

/** Normalized text node view (maps store `content` → `text`). */
export type TextNodeModel = {
  id: string;
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  textAlign: TextAlign;
  textResizeMode: TextResizeMode;
  isEditing: boolean;
};

export const DEFAULT_TEXT_RESIZE_MODE: TextResizeMode = "auto-height";
export const DEFAULT_TEXT_ALIGN: TextAlign = "left";
export const MIN_TEXT_BOX = 8;

/** Inset between the node frame and where glyphs are drawn / measured. */
export const TEXT_BOX_PAD_X = 4;
export const TEXT_BOX_PAD_Y = 2;

export function textInnerWidth(boxWidth: number): number {
  return Math.max(1, boxWidth - TEXT_BOX_PAD_X * 2);
}

export function textInnerHeight(boxHeight: number): number {
  return Math.max(1, boxHeight - TEXT_BOX_PAD_Y * 2);
}

export function wrapWidthForResizeMode(
  boxWidth: number,
  mode: TextResizeMode,
): number {
  if (mode === "auto-width") return Number.POSITIVE_INFINITY;
  return textInnerWidth(boxWidth);
}

export function normalizeTextAlign(value: unknown): TextAlign {
  if (value === "center" || value === "right") return value;
  return "left";
}

export function normalizeTextResizeMode(value: unknown): TextResizeMode {
  if (value === "auto-width" || value === "fixed") return value;
  return "auto-height";
}

/** Build a normalized text model from an editor node + edit flag. */
export function toTextNodeModel(
  node: EditorNode,
  isEditing: boolean,
): TextNodeModel | null {
  if (node.type !== "text") return null;
  const typo = resolveTextTypo(node);
  return {
    id: node.id,
    type: "text",
    x: node.x,
    y: node.y,
    width: Math.max(MIN_TEXT_BOX, node.width),
    height: Math.max(MIN_TEXT_BOX, node.height),
    text: node.content ?? "",
    fontFamily: typo.fontFamily,
    fontSize: typo.fontSize,
    fontWeight: typo.fontWeight,
    lineHeight: typo.lineHeight,
    letterSpacing: typo.letterSpacing,
    color: typo.color,
    textAlign: normalizeTextAlign(node.textAlign),
    textResizeMode: normalizeTextResizeMode(node.textResizeMode),
    isEditing,
  };
}

export function textTypoFromModel(model: Pick<TextNodeModel, "fontFamily" | "fontSize" | "fontWeight" | "lineHeight" | "letterSpacing" | "color">): ResolvedTextTypo {
  return {
    color: model.color,
    fontFamily: model.fontFamily,
    fontSize: model.fontSize,
    fontWeight: model.fontWeight,
    lineHeight: model.lineHeight,
    letterSpacing: model.letterSpacing,
  };
}
