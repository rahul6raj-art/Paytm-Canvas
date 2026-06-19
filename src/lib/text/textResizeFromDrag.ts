import type { Bounds, ResizeHandle } from "@/lib/resize";
import { EDGE_RESIZE_HANDLES } from "@/lib/resize";
import type { EditorNode } from "@/stores/useEditorStore";
import { ensureTextModeForExplicitHeight } from "./ensureTextModeForExplicitHeight";
import { ensureTextModeForExplicitWidth } from "./ensureTextModeForExplicitWidth";
import { textLayoutPatchForNode } from "./textLayout";
import {
  normalizeTextResizeMode,
  textResizePatch,
  type TextResizeMode,
} from "./textNodeModel";

/** Figma-style resize handles per text mode (edge handles only; corners rotate in Craft). */
export function textResizeHandlesForMode(
  mode: TextResizeMode,
): readonly ResizeHandle[] | null {
  switch (mode) {
    case "auto-width":
      return ["e", "w"];
    case "auto-height":
      return EDGE_RESIZE_HANDLES;
    case "fixed":
      return EDGE_RESIZE_HANDLES;
    default:
      return null;
  }
}

export function isTextResizeHandleAllowed(
  node: EditorNode,
  handle: ResizeHandle,
): boolean {
  if (node.type !== "text") return true;
  const allowed = textResizeHandlesForMode(
    normalizeTextResizeMode(node.textResizeMode, node.autoResize),
  );
  if (!allowed) return true;
  return allowed.includes(handle);
}

/**
 * Figma-style geometry when dragging text resize handles:
 * - Width drag: convert auto-width → auto-height, reflow, height follows wrapped content.
 * - Height drag on auto-height: convert to fixed at dragged height.
 * - Aspect lock never shrinks text height when wrapping needs more lines.
 */
export function buildTextResizeGeometryPatch(
  node: EditorNode,
  startBounds: Bounds,
  next: Pick<EditorNode, "x" | "y" | "width" | "height">,
): Partial<EditorNode> {
  if (node.type !== "text") return {};

  const widthChanged = next.width !== startBounds.width;
  const heightChanged = next.height !== startBounds.height;
  if (!widthChanged && !heightChanged) return {};

  const merged: EditorNode = { ...node, ...next };
  let patch: Partial<EditorNode> = {};

  if (widthChanged) {
    patch = ensureTextModeForExplicitWidth(merged, "resize", {
      previousWidth: startBounds.width,
    });
    const mode = normalizeTextResizeMode(
      patch.textResizeMode ?? merged.textResizeMode,
      patch.autoResize ?? merged.autoResize,
    );
    if (mode === "fixed" && patch.height == null) {
      // Fixed width: keep explicit frame height from the drag; reflow inside the box.
      patch.height = next.height;
    }
  } else if (heightChanged) {
    const mode = normalizeTextResizeMode(merged.textResizeMode, merged.autoResize);
    patch = ensureTextModeForExplicitHeight(merged, "resize", {
      previousHeight: startBounds.height,
    });
    if (mode === "auto-width" && Object.keys(patch).length === 0) {
      patch = { ...textResizePatch("auto-height") };
      const layoutPatch = textLayoutPatchForNode(
        { ...merged, ...patch },
        node.content ?? "",
      );
      if (layoutPatch) patch = { ...patch, ...layoutPatch };
    }
    // Explicit vertical sizing always uses the dragged height (fixed mode).
    if (
      normalizeTextResizeMode(patch.textResizeMode, patch.autoResize) === "fixed" ||
      Object.keys(patch).length > 0
    ) {
      patch.height = next.height;
    }
  }

  // Auto-height: ensure wrapped content height wins over any proportional resize height.
  if (widthChanged) {
    const mode = normalizeTextResizeMode(
      patch.textResizeMode ?? merged.textResizeMode,
      patch.autoResize ?? merged.autoResize,
    );
    if (mode === "auto-height" && patch.height == null) {
      const layoutPatch = textLayoutPatchForNode(
        { ...merged, ...patch },
        node.content ?? "",
      );
      if (layoutPatch?.height != null) {
        patch.height = layoutPatch.height;
      }
    }
  }

  return patch;
}
