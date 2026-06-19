import type { EditorNode } from "@/stores/useEditorStore";
import { clearCanonicalTextLayoutCache } from "./canonicalTextLayout";
import { bumpTextLayoutEpoch } from "./textLayoutEpoch";
import {
  normalizeTextResizeMode,
  textResizePatch,
} from "./textNodeModel";

export type TextHeightConstraintReason = "resize" | "inspector";

function readTextDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("textDebug") === "1";
}

/**
 * When auto-height text receives an explicit height (inspector H field or vertical resize),
 * convert to fixed size and preserve width + height.
 */
export function ensureTextModeForExplicitHeight(
  node: EditorNode,
  reason: TextHeightConstraintReason,
  opts?: { previousHeight?: number },
): Partial<EditorNode> {
  if (node.type !== "text") return {};

  const mode = normalizeTextResizeMode(node.textResizeMode, node.autoResize);
  if (mode !== "auto-height") return {};

  const previousHeight = opts?.previousHeight ?? node.height;
  if (node.height === previousHeight) return {};

  clearCanonicalTextLayoutCache(node.id);
  bumpTextLayoutEpoch();

  if (readTextDebugEnabled()) {
    console.info("[text-mode] auto-height converted for explicit height", {
      id: node.id,
      reason,
      oldMode: "auto-height",
      newMode: "fixed",
      oldHeight: previousHeight,
      newHeight: node.height,
    });
  }

  return textResizePatch("fixed");
}
