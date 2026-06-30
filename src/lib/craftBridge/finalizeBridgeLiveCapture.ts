import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { measureTextPaintHeight } from "@/lib/text/textBaseline";
import { textLayoutPatchForNode } from "@/lib/text/textLayout";
import { textResizePatch } from "@/lib/text/textNodeModel";
import { resolveTextTypo } from "@/lib/textTypography";
import { PML_PHONE_COLUMN_WIDTH } from "@/lib/craftBridge/pmlScreenMetrics";
import { enforceManualScreenFrames } from "@/lib/webImport/enforceManualScreenFrames";
import { expandImportedFrameHeights } from "@/lib/webImport/finalizeWebImportGraph";
import {
  normalizeBottomNavTextNodes,
  normalizeImportedLabelTextNodes,
  normalizeWebImportTextNodes,
  stripWebImportAutoLayout,
} from "@/lib/webImport/normalizeWebImportLayers";
import { freezeBridgeCaptureSubtree } from "@/lib/craftBridge/bridgeCaptureLayout";
import {
  clampPhoneShellFrameWidths,
  isPhoneShellClassName,
} from "@/lib/webImport/phoneShellViewport";

function isBottomNavContainer(n: EditorNode): boolean {
  const tokens = (n.codeClassName ?? "").trim().split(/\s+/).filter(Boolean);
  return tokens.some((t) => t === "bn" || t === "bn__bar" || t === "bn__tabs");
}

/** Pin captured coordinates — never reflow flex stacks on bridge push. */
export function pinBridgeCaptureChildren(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    if (parentId === EDITOR_ROOT_KEY) continue;
    for (const kidId of kids) {
      const child = nodes[kidId];
      if (!child || child.visible === false) continue;
      nodes[kidId] = {
        ...child,
        layoutPositioning: "absolute",
        layoutSizingHorizontal: child.layoutSizingHorizontal ?? "fixed",
        layoutSizingVertical: child.layoutSizingVertical ?? "fixed",
        layoutDirty: false,
      };
    }
  }
}

/** Lay out one captured text node — never shrink below DOM height or ink bounds. */
export function layoutBridgeCaptureTextNode(node: EditorNode, content: string): EditorNode {
  const capturedHeight = node.height;
  let next: EditorNode = { ...node };
  if ((next.textResizeMode ?? "auto-width") === "fixed") {
    next = { ...next, ...textResizePatch("auto-width") };
  }
  const layoutPatch = textLayoutPatchForNode(next, content);
  if (layoutPatch) {
    next = { ...next, ...layoutPatch };
  }
  const typo = resolveTextTypo(next);
  const paintMin = Math.ceil(measureTextPaintHeight(content, typo));
  next = {
    ...next,
    height: Math.max(capturedHeight, next.height, paintMin),
  };
  return next;
}

/** Expand captured text to fit content — DOM getBoundingClientRect is often narrower than Craft fonts. */
export function fitBridgeCaptureTextBounds(nodes: Record<string, EditorNode>): void {
  normalizeWebImportTextNodes(nodes);
  normalizeImportedLabelTextNodes(nodes);
  normalizeBottomNavTextNodes(nodes);

  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    const content = node.content?.trim();
    if (!content) continue;

    const next = layoutBridgeCaptureTextNode(nodes[id]!, content);
    nodes[id] = {
      ...next,
      layoutPositioning: "absolute",
      layoutSizingHorizontal: "fixed",
      layoutSizingVertical: "fixed",
      layoutDirty: false,
    };
  }
}

/** @deprecated Use fitBridgeCaptureTextBounds */
export const freezeBridgeCaptureTextBounds = fitBridgeCaptureTextBounds;

/**
 * Bottom nav tabs sometimes sum wider than the phone column after capture.
 * Shrink width only — never change x/y (sections use horizontal inset, e.g. 16px).
 */
export function clampBottomNavWidths(
  nodes: Record<string, EditorNode>,
  columnWidth: number = PML_PHONE_COLUMN_WIDTH,
): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (!isBottomNavContainer(node)) continue;
    if (node.width <= columnWidth) continue;
    nodes[id] = { ...node, width: columnWidth };
  }
}

/**
 * Bridge live capture: keep Playwright x/y/width/height untouched except phone shell
 * width lock and bottom-nav overflow. Do not rewrite section margins or padding.
 */
export function finalizeBridgeLiveCapture(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  columnWidth: number = PML_PHONE_COLUMN_WIDTH,
): void {
  pinBridgeCaptureChildren(nodes, childOrder);
  freezeBridgeCaptureSubtree(nodes, childOrder);
  fitBridgeCaptureTextBounds(nodes);
  // Grow card/row frames when text bounds exceed captured flex heights (clip was cutting labels).
  expandImportedFrameHeights(nodes, childOrder);
  stripWebImportAutoLayout(nodes);
  clampBottomNavWidths(nodes, columnWidth);
  clampPhoneShellFrameWidths(nodes, childOrder, columnWidth);
  enforceManualScreenFrames(nodes, childOrder);

  for (const rootId of childOrder[EDITOR_ROOT_KEY] ?? []) {
    const root = nodes[rootId];
    if (!root) continue;
    const phoneShell =
      isPhoneShellClassName(root.codeClassName) ||
      (root.width > columnWidth && root.width <= 420);
    if (!phoneShell) continue;
    nodes[rootId] = {
      ...root,
      width: columnWidth,
      clipChildren: true,
      manualScreenLayout: true,
      layoutMode: "none",
    };
  }
}
