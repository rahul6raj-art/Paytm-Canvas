import type { ResolvedTextTypo } from "@/lib/textTypography";
import type { TextResizeMode } from "./textNodeModel";
import {
  MIN_TEXT_BOX,
  TEXT_BOX_PAD_X,
  TEXT_BOX_PAD_Y,
  wrapWidthForResizeMode,
} from "./textNodeModel";
import { layoutText } from "./textMeasure";
import type { EditorNode } from "@/stores/useEditorStore";
import { resolveTextTypo } from "@/lib/textTypography";

/** Recompute width/height from content according to resize mode. */
export function computeTextBoxSize(
  text: string,
  typo: ResolvedTextTypo,
  mode: TextResizeMode,
  currentWidth: number,
  currentHeight: number,
): { width: number; height: number } {
  const wrapWidth = wrapWidthForResizeMode(
    Math.max(MIN_TEXT_BOX, currentWidth),
    mode,
  );
  const layout = layoutText(text, wrapWidth, typo);

  if (mode === "auto-width") {
    return {
      width: Math.max(MIN_TEXT_BOX, layout.width + TEXT_BOX_PAD_X * 2),
      height: Math.max(MIN_TEXT_BOX, layout.height + TEXT_BOX_PAD_Y * 2),
    };
  }
  if (mode === "auto-height") {
    return {
      width: Math.max(MIN_TEXT_BOX, currentWidth),
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
  const mode = node.textResizeMode ?? "auto-height";
  if (mode === "fixed") return null;
  const size = computeTextBoxSize(text, typo, mode, node.width, node.height);
  if (size.width === node.width && size.height === node.height) return null;
  return { width: size.width, height: size.height };
}
