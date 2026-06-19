import type { EditorNode } from "@/stores/useEditorStore";
import { clearCanonicalTextLayoutCache } from "./canonicalTextLayout";
import { textLayoutPatchForNode } from "./textLayout";
import { bumpTextLayoutEpoch } from "./textLayoutEpoch";
import { textResizePatch } from "./textNodeModel";

export type TextWidthConstraintReason =
  | "resize"
  | "inspector"
  | "auto-layout"
  | "fig-import-constrained"
  | "web-import"
  | "patch";

export type EnsureTextModeOpts = {
  /** Width before this explicit assignment (defaults to node.width). */
  previousWidth?: number;
  /** Skip auto-height layout height sync (manual height-only resize). */
  skipHeight?: boolean;
};

function readTextDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("textDebug") === "1";
}

function logTextModeConversion(
  node: EditorNode,
  reason: TextWidthConstraintReason,
  oldWidth: number,
  newWidth: number,
): void {
  if (!readTextDebugEnabled()) return;
  console.info("[text-mode] auto-width converted for explicit width", {
    id: node.id,
    reason,
    oldMode: "auto-width",
    newMode: "auto-height",
    oldWidth,
    newWidth,
  });
}

function shouldConvertAutoWidthToAutoHeight(
  reason: TextWidthConstraintReason,
  newWidth: number,
  previousWidth: number,
): boolean {
  if (newWidth === previousWidth) {
    return reason === "fig-import-constrained" || reason === "web-import";
  }
  if (reason === "resize") {
    return true;
  }
  if (reason === "auto-layout" || reason === "fig-import-constrained" || reason === "web-import") {
    return true;
  }
  // Inspector / patch: narrowing assigns a constrained width (Figma point text widens freely).
  return newWidth < previousWidth;
}

function hasExplicitWidthAssignment(
  reason: TextWidthConstraintReason,
  newWidth: number,
  previousWidth: number,
): boolean {
  if (newWidth !== previousWidth) return true;
  return reason === "fig-import-constrained" || reason === "web-import";
}

/**
 * When auto-width text receives an explicit constrained width, convert to auto-height,
 * invalidate layout cache, recompute wrapped layout, and sync height.
 */
export function ensureTextModeForExplicitWidth(
  node: EditorNode,
  reason: TextWidthConstraintReason,
  opts?: EnsureTextModeOpts,
): Partial<EditorNode> {
  if (node.type !== "text") return {};

  const previousWidth = opts?.previousWidth ?? node.width;
  if (!hasExplicitWidthAssignment(reason, node.width, previousWidth)) {
    return {};
  }

  let patch: Partial<EditorNode> = {};
  const mode = node.textResizeMode ?? "auto-width";

  if (mode === "auto-width") {
    if (!shouldConvertAutoWidthToAutoHeight(reason, node.width, previousWidth)) {
      return {};
    }
    patch = { ...textResizePatch("auto-height") };
    logTextModeConversion(node, reason, previousWidth, node.width);
    clearCanonicalTextLayoutCache(node.id);
    bumpTextLayoutEpoch();
  } else if (node.width === previousWidth) {
    return {};
  } else {
    clearCanonicalTextLayoutCache(node.id);
    bumpTextLayoutEpoch();
  }

  const mergedMode = patch.textResizeMode ?? mode;
  if (mergedMode === "auto-height" && !opts?.skipHeight) {
    const merged = { ...node, ...patch };
    const layoutPatch = textLayoutPatchForNode(merged, merged.content ?? "");
    if (layoutPatch) {
      patch = { ...patch, ...layoutPatch };
    }
  }

  return patch;
}

/** CSS signals for imported web text resize mode. Prefer auto-width so labels are not clipped to narrow DOM boxes. */
export function webImportTextResizeMode(styles: {
  width?: string;
  maxWidth?: string;
  whiteSpace?: string;
  overflowWrap?: string;
  wordBreak?: string;
}): "auto-width" | "auto-height" | "fixed" {
  const ws = (styles.whiteSpace ?? "").trim().toLowerCase();
  if (ws === "nowrap" || ws === "pre") return "auto-width";
  const wraps =
    ws === "normal" ||
    ws === "pre-wrap" ||
    ws === "break-spaces" ||
    Boolean(styles.overflowWrap && styles.overflowWrap !== "normal") ||
    Boolean(styles.wordBreak && styles.wordBreak !== "normal");
  const hasWidth =
    Boolean(styles.width && styles.width !== "auto" && styles.width !== "none") ||
    Boolean(styles.maxWidth && styles.maxWidth !== "none");
  if (wraps && hasWidth) return "auto-height";
  return "auto-width";
}
