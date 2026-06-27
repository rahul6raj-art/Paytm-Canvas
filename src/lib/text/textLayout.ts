import type { ResolvedTextTypo } from "@/lib/textTypography";
import type { TextResizeMode } from "./textNodeModel";
import {
  EMPTY_TEXT_CARET_INNER_WIDTH,
  MIN_TEXT_BOX,
  TEXT_BOX_PAD_X,
  textResizePatch,
  textVerticalPad,
  wrapWidthForResizeMode,
} from "./textNodeModel";
import { layoutTextCanonical, canonicalToTextLayout, clearCanonicalTextLayoutCache } from "./canonicalTextLayout";
import { layoutText, type TextLayout } from "./textMeasure";
import { hugContentHeightForLayout } from "./textBaseline";
import type { EditorNode } from "@/stores/useEditorStore";
import { resolveTextTypo } from "@/lib/textTypography";
import { nodeForTextLayout } from "./textNodeModel";
import {
  ensureTextModeForExplicitWidth,
} from "./ensureTextModeForExplicitWidth";
import { ensureTextModeForExplicitHeight } from "./ensureTextModeForExplicitHeight";
import { setTextResizeMode } from "./setTextResizeMode";
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
  node?: EditorNode,
): { width: number; height: number } {
  const wrapWidth = wrapWidthForResizeMode(
    Math.max(MIN_TEXT_BOX, currentWidth),
    mode,
  );
  const displayText = prepareTextForDisplay(text, style);
  const layoutNode = node != null ? nodeForTextLayout({ ...node, content: text }) : null;
  const canonical =
    layoutNode != null ? layoutTextCanonical(layoutNode, { bypassCache: true }) : null;
  if (canonical?.source === "wasm") {
    return { width: canonical.nodeWidth, height: canonical.nodeHeight };
  }
  const layout =
    canonical != null
      ? canonicalToTextLayout(canonical, typo)
      : layoutText(displayText, wrapWidth, typo, style);

  const contentHeight = hugContentHeightForLayout(layout, typo);
  const verticalPad = textVerticalPad(mode);

  if (mode === "auto-width") {
    const isEmpty = displayText.length === 0;
    const width = Math.ceil(layout.width) + TEXT_BOX_PAD_X * 2;
    const height = Math.ceil(contentHeight) + verticalPad * 2;
    if (isEmpty) {
      return {
        width: Math.max(TEXT_BOX_PAD_X * 2 + EMPTY_TEXT_CARET_INNER_WIDTH, width),
        height,
      };
    }
    return {
      width: Math.max(MIN_TEXT_BOX, width),
      height: Math.max(MIN_TEXT_BOX, height),
    };
  }
  if (mode === "auto-height") {
    // Width is user-controlled (drag / inspector); only height follows wrapped content.
    return {
      width: Math.max(MIN_TEXT_BOX, currentWidth),
      height: Math.max(MIN_TEXT_BOX, contentHeight + verticalPad * 2),
    };
  }
  // Fixed (NONE): both axes are user-controlled; text wraps inside and may overflow.
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
      const size = computeTextBoxSize(text, typo, mode, node.width, node.height, style, node);
      if (size.width === node.width) return null;
      return { width: size.width };
    }
    return null;
  }
  // Recover point-text layers stuck in auto-height at the caret-only shell (typing must hug content).
  const caretShellMax = TEXT_BOX_PAD_X * 2 + EMPTY_TEXT_CARET_INNER_WIDTH + 1;
  if (mode === "auto-height" && node.width <= caretShellMax && text.length > 0) {
    const size = computeTextBoxSize(text, typo, "auto-width", node.width, node.height, style, node);
    const patch: Partial<EditorNode> = { ...textResizePatch("auto-width") };
    if (size.width !== node.width) patch.width = size.width;
    if (size.height !== node.height) patch.height = size.height;
    return patch;
  }

  const size = computeTextBoxSize(text, typo, mode, node.width, node.height, style, node);
  if (mode === "fixed") {
    return null;
  }
  if (size.width === node.width && size.height === node.height) return null;
  return {
    ...(size.width !== node.width ? { width: size.width } : {}),
    ...(size.height !== node.height ? { height: size.height } : {}),
  };
}

/** Node fields that can change measured text bounds. */
export const TEXT_LAYOUT_AFFECTING_KEYS = new Set<keyof EditorNode>([
  "content",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "lineHeightUnit",
  "letterSpacing",
  "letterSpacingUnit",
  "textResizeMode",
  "autoResize",
  "textAlign",
  "verticalAlign",
  "textCase",
  "listStyle",
  "paragraphSpacing",
  "verticalTrim",
  "textTruncate",
  "width",
  "height",
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

  if (patch.textResizeMode != null) {
    const modePatch = setTextResizeMode(node, patch.textResizeMode);
    const extras: Partial<EditorNode> = { ...patch };
    delete extras.textResizeMode;
    delete extras.autoResize;
    if (modePatch.width != null) delete extras.width;
    if (modePatch.height != null) delete extras.height;
    if (Object.keys(extras).length === 0) return modePatch;
    return withTextLayoutPatch({ ...node, ...modePatch }, extras);
  }

  let next = patch;

  if (patch.width != null && !("content" in patch)) {
    const merged = { ...node, ...patch };
    const modePatch = ensureTextModeForExplicitWidth(merged, "inspector", {
      previousWidth: node.width,
    });
    if (Object.keys(modePatch).length > 0) {
      next = { ...next, ...modePatch };
    }
  }

  if (patch.height != null && patch.width == null && !("content" in patch)) {
    const merged = { ...node, ...next };
    const modePatch = ensureTextModeForExplicitHeight(merged, "inspector", {
      previousHeight: node.height,
    });
    if (Object.keys(modePatch).length > 0) {
      next = { ...next, ...modePatch };
    }
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
