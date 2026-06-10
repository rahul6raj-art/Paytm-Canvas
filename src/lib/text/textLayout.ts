import type { ResolvedTextTypo } from "@/lib/textTypography";
import type { TextResizeMode } from "./textNodeModel";
import {
  MIN_TEXT_BOX,
  TEXT_BOX_PAD_X,
  TEXT_BOX_PAD_Y,
  textResizePatch,
  wrapWidthForResizeMode,
} from "./textNodeModel";
import { layoutText } from "./textMeasure";
import type { EditorNode } from "@/stores/useEditorStore";
import { resolveTextTypo } from "@/lib/textTypography";
import {
  DEFAULT_TEXT_ADVANCED_STYLE,
  prepareTextForDisplay,
  textAdvancedStyleFromNode,
  type TextAdvancedStyle,
} from "./textAdvancedStyle";

/** Recompute width/height from content according to resize mode. */
export function computeTextBoxSize(
  text: string,
  typo: ResolvedTextTypo,
  mode: TextResizeMode,
  currentWidth: number,
  currentHeight: number,
  style: TextAdvancedStyle = DEFAULT_TEXT_ADVANCED_STYLE,
): { width: number; height: number } {
  const wrapWidth = wrapWidthForResizeMode(
    Math.max(MIN_TEXT_BOX, currentWidth),
    mode,
  );
  const displayText = prepareTextForDisplay(text, style);
  const layout = layoutText(displayText, wrapWidth, typo, style);

  if (mode === "auto-width") {
    return {
      width: Math.max(MIN_TEXT_BOX, layout.width + TEXT_BOX_PAD_X * 2),
      height: Math.max(MIN_TEXT_BOX, layout.height + TEXT_BOX_PAD_Y * 2),
    };
  }
  if (mode === "auto-height") {
    const contentWidth = layout.width + TEXT_BOX_PAD_X * 2;
    return {
      width: Math.max(MIN_TEXT_BOX, currentWidth, contentWidth),
      height: Math.max(MIN_TEXT_BOX, layout.height + TEXT_BOX_PAD_Y * 2),
    };
  }
  return {
    width: Math.max(MIN_TEXT_BOX, currentWidth),
    height: Math.max(MIN_TEXT_BOX, currentHeight),
  };
}

export function textLayoutPatchForNode(
  node: EditorNode,
  text: string,
): Partial<EditorNode> | null {
  if (node.type !== "text") return null;
  const typo = resolveTextTypo(node);
  const mode = node.textResizeMode ?? "auto-width";
  const style = textAdvancedStyleFromNode(node);
  if (style.textTruncate === "end") {
    if (mode === "fixed") return null;
    if (mode === "auto-width") {
      const size = computeTextBoxSize(text, typo, mode, node.width, node.height, style);
      if (size.width === node.width) return null;
      return { width: size.width };
    }
    return null;
  }
  if (mode === "fixed") return null;
  const size = computeTextBoxSize(text, typo, mode, node.width, node.height, style);
  if (size.width === node.width && size.height === node.height) return null;
  return { width: size.width, height: size.height };
}

/** Node fields that can change measured text bounds. */
export const TEXT_LAYOUT_AFFECTING_KEYS = new Set<keyof EditorNode>([
  "content",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textResizeMode",
  "textCase",
  "listStyle",
  "paragraphSpacing",
  "verticalTrim",
  "textTruncate",
  "width",
]);

export function patchAffectsTextLayout(patch: Partial<EditorNode>): boolean {
  return Object.keys(patch).some((k) =>
    TEXT_LAYOUT_AFFECTING_KEYS.has(k as keyof EditorNode),
  );
}

/** Merge width/height updates when typography or content changes (Figma auto-height / auto-width). */
export function withTextLayoutPatch(
  node: EditorNode,
  patch: Partial<EditorNode>,
): Partial<EditorNode> {
  if (node.type !== "text") return patch;
  let next = patch;
  if (patch.textResizeMode != null) {
    next = { ...next, ...textResizePatch(patch.textResizeMode) };
  }
  if (patch.textTruncate === "end") {
    const mode = next.textResizeMode ?? node.textResizeMode ?? "auto-width";
    if (mode !== "fixed") {
      next = { ...next, ...textResizePatch("fixed") };
    }
  }
  if (!patchAffectsTextLayout(next)) return next;
  const merged = { ...node, ...next };
  const layoutPatch = textLayoutPatchForNode(merged, merged.content ?? "");
  return layoutPatch ? { ...next, ...layoutPatch } : next;
}
