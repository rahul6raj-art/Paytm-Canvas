import type { EditorNode } from "@/stores/useEditorStore";
import { resolveTextTypo } from "@/lib/textTypography";
import {
  clearCanonicalTextLayoutCache,
  textLayoutForEditorNode,
} from "./canonicalTextLayout";
import { textAdvancedStyleFromNode } from "./textAdvancedStyle";
import { textResizeModeToAutoResize } from "./autoResizeMode";
import { computeTextBoxSize } from "./textLayout";
import { bumpTextLayoutEpoch } from "./textLayoutEpoch";
import {
  normalizeTextResizeMode,
  textResizePatch,
  type TextResizeMode,
} from "./textNodeModel";

function readTextDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("textDebug") === "1";
}

/**
 * Apply a Figma-style text resize mode: sync textResizeMode + autoResize, run layout,
 * update node dimensions, and invalidate layout cache.
 */
export function setTextResizeMode(
  node: EditorNode,
  mode: TextResizeMode,
): Partial<EditorNode> {
  if (node.type !== "text") return {};

  const oldMode = normalizeTextResizeMode(node.textResizeMode, node.autoResize);
  const oldAutoResize = node.autoResize ?? textResizeModeToAutoResize(oldMode);
  const modePatch = textResizePatch(mode);
  const merged: EditorNode = { ...node, ...modePatch };
  const text = merged.content ?? "";
  const typo = resolveTextTypo(merged);
  const style = textAdvancedStyleFromNode(merged);

  let dimensionPatch: Partial<EditorNode> = {};

  if (mode === "auto-width") {
    const size = computeTextBoxSize(
      text,
      typo,
      mode,
      merged.width,
      merged.height,
      style,
      merged,
    );
    dimensionPatch = { width: size.width, height: size.height };
  } else if (mode === "auto-height") {
    const size = computeTextBoxSize(
      text,
      typo,
      mode,
      merged.width,
      merged.height,
      style,
      merged,
    );
    dimensionPatch = { height: size.height };
  }

  clearCanonicalTextLayoutCache(node.id);
  bumpTextLayoutEpoch();

  const finalNode: EditorNode = { ...merged, ...dimensionPatch };
  const layoutResult = textLayoutForEditorNode(finalNode);
  const layoutLineCount = layoutResult?.layout.lines.length ?? 0;

  const patch = { ...modePatch, ...dimensionPatch };

  if (readTextDebugEnabled()) {
    console.info("[text-resize-mode]", {
      id: node.id,
      oldMode,
      newMode: mode,
      oldAutoResize,
      newAutoResize: modePatch.autoResize,
      oldWidth: node.width,
      newWidth: dimensionPatch.width ?? node.width,
      oldHeight: node.height,
      newHeight: dimensionPatch.height ?? node.height,
      layoutLineCount,
      wrapWidth: textLayoutForEditorNode(finalNode)?.debug.availableWidth,
    });
  }

  return patch;
}
