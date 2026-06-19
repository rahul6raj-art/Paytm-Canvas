import type { EditorNode } from "@/stores/useEditorStore";
import { resolveTextTypo } from "@/lib/textTypography";
import { layoutText, type TextLayout } from "./textMeasure";

export type TextDecorationMode = "none" | "underline" | "strikethrough";
export type TextCaseMode = "none" | "upper" | "lower" | "title" | "small-caps";
export type TextVerticalTrim = "standard" | "cap-height";
export type TextListStyle = "none" | "bullet" | "numbered";
export type TextTruncateMode = "none" | "end";

export type TextAdvancedStyle = {
  textDecoration: TextDecorationMode;
  textCase: TextCaseMode;
  verticalTrim: TextVerticalTrim;
  listStyle: TextListStyle;
  paragraphSpacing: number;
  textTruncate: TextTruncateMode;
};

export type TextLayoutStyleOptions = TextAdvancedStyle;

export const DEFAULT_TEXT_ADVANCED_STYLE: TextAdvancedStyle = {
  textDecoration: "none",
  textCase: "none",
  verticalTrim: "standard",
  listStyle: "none",
  paragraphSpacing: 0,
  textTruncate: "none",
};

export function normalizeTextDecoration(value: unknown): TextDecorationMode {
  if (value === "underline" || value === "strikethrough") return value;
  if (value === "line-through") return "strikethrough";
  return "none";
}

export function textDecorationStrokeWidth(fontSize: number): number {
  return Math.max(1, fontSize / 12);
}

export function underlineDecorationY(
  lineTopY: number,
  fontSize: number,
  lineHeight: number,
): number {
  const lineHeightPx = fontSize * lineHeight;
  return lineTopY + lineHeightPx - Math.max(1, fontSize * 0.12);
}

export function strikethroughDecorationY(
  lineTopY: number,
  fontSize: number,
  lineHeight: number,
): number {
  const lineHeightPx = fontSize * lineHeight;
  return lineTopY + lineHeightPx * 0.45;
}

export function normalizeTextCase(value: unknown): TextCaseMode {
  if (value === "upper" || value === "lower" || value === "title" || value === "small-caps") {
    return value;
  }
  return "none";
}

export function normalizeTextVerticalTrim(value: unknown): TextVerticalTrim {
  if (value === "cap-height") return value;
  return "standard";
}

export function normalizeTextListStyle(value: unknown): TextListStyle {
  if (value === "bullet" || value === "numbered") return value;
  return "none";
}

export function normalizeTextTruncate(value: unknown): TextTruncateMode {
  if (value === "end") return value;
  return "none";
}

export function textAdvancedStyleFromNode(node: EditorNode): TextAdvancedStyle {
  return {
    textDecoration: normalizeTextDecoration(node.textDecoration),
    textCase: normalizeTextCase(node.textCase),
    verticalTrim: normalizeTextVerticalTrim(node.verticalTrim),
    listStyle: normalizeTextListStyle(node.listStyle),
    paragraphSpacing: Math.max(0, node.paragraphSpacing ?? 0),
    textTruncate: normalizeTextTruncate(node.textTruncate),
  };
}

/** Apply list prefixes and text-case for measure/render (content in store stays raw). */
export function prepareTextForDisplay(text: string, style: TextAdvancedStyle): string {
  const paragraphs = text.split("\n");
  const withLists = paragraphs.map((para, index) => {
    if (!para) return para;
    if (style.listStyle === "bullet") return `• ${para}`;
    if (style.listStyle === "numbered") return `${index + 1}. ${para}`;
    return para;
  });
  const joined = withLists.join("\n");
  return applyTextCase(joined, style.textCase);
}

export function applyTextCase(text: string, mode: TextCaseMode): string {
  switch (mode) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "title":
      return text.replace(/[a-zA-Z]+/g, (word) =>
        word.length <= 1
          ? word.toUpperCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      );
    case "small-caps":
      return text.toUpperCase();
    default:
      return text;
  }
}

/** Trim extra ascender/descender padding from line boxes (approximate cap-height trim). */
export function verticalTrimInsetPx(fontSize: number, trim: TextVerticalTrim): number {
  if (trim !== "cap-height") return 0;
  return Math.max(0, fontSize * 0.12);
}

/** Map a caret index in stored text to the display string used for layout/render. */
export function rawIndexToDisplayIndex(
  rawIndex: number,
  rawText: string,
  style: TextAdvancedStyle,
): number {
  const display = prepareTextForDisplay(rawText, style);
  if (rawIndex <= 0) return 0;
  if (rawIndex >= rawText.length) return display.length;

  const rawParas = rawText.split("\n");
  const displayParas = display.split("\n");
  let rawOffset = 0;
  let displayOffset = 0;

  for (let p = 0; p < rawParas.length; p++) {
    const rawPara = rawParas[p]!;
    const rawParaEnd = rawOffset + rawPara.length;
    const displayPara = displayParas[p] ?? "";
    const prefixLen = displayPara.length - applyTextCase(rawPara, style.textCase).length;

    if (rawIndex <= rawParaEnd) {
      return displayOffset + prefixLen + (rawIndex - rawOffset);
    }

    rawOffset = rawParaEnd + 1;
    displayOffset += displayPara.length + 1;
  }

  return display.length;
}

/** Map a display-string index (layout/hit-test) back to stored text. */
export function displayIndexToRawIndex(
  displayIndex: number,
  rawText: string,
  style: TextAdvancedStyle,
): number {
  const display = prepareTextForDisplay(rawText, style);
  if (displayIndex <= 0) return 0;
  if (displayIndex >= display.length) return rawText.length;

  const rawParas = rawText.split("\n");
  const displayParas = display.split("\n");
  let rawOffset = 0;
  let displayOffset = 0;

  for (let p = 0; p < rawParas.length; p++) {
    const rawPara = rawParas[p]!;
    const displayPara = displayParas[p] ?? "";
    const displayParaEnd = displayOffset + displayPara.length;
    const prefixLen = displayPara.length - applyTextCase(rawPara, style.textCase).length;

    if (displayIndex <= displayParaEnd) {
      const inDisplayPara = displayIndex - displayOffset;
      if (inDisplayPara < prefixLen) return rawOffset;
      return rawOffset + (inDisplayPara - prefixLen);
    }

    rawOffset += rawPara.length + 1;
    displayOffset = displayParaEnd + 1;
  }

  return rawText.length;
}

export function layoutDisplayText(
  rawText: string,
  wrapWidth: number,
  node: EditorNode,
): { layout: TextLayout; displayText: string; style: TextAdvancedStyle } {
  const typo = resolveTextTypo(node);
  const style = textAdvancedStyleFromNode(node);
  const displayText = prepareTextForDisplay(rawText, style);
  const layout = layoutText(displayText, wrapWidth, typo, style);
  return { layout, displayText, style };
}
