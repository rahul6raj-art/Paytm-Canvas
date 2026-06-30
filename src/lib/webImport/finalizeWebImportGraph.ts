import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { applyWebImportAutoLayoutStructure } from "@/lib/webImport/applyWebImportAutoLayoutStructure";
import { enforceManualScreenFrames } from "@/lib/webImport/enforceManualScreenFrames";
import { enforceManualComponentComposition } from "@/lib/webImport/enforceManualComponentComposition";
import { disableAutoLayoutForAbsoluteChildren } from "@/lib/webImport/normalizeWebImportLayers";
import {
  collapsePassThroughWrappers,
  dedupeOverlappingFormSiblings,
  fixOverlappingStackedSiblings,
  normalizeFooterLegalText,
  normalizeEmailToButtonGap,
  normalizeWebImportTextNodes,
  normalizeImportedLabelTextNodes,
  normalizeListItemTextNodes,
  normalizeBottomNavTextNodes,
  normalizeWebImportSvgPaths,
  normalizeWebImportColors,
  preserveWebImportOverflowEffects,
  trimFramesToChildBounds,
} from "@/lib/webImport/normalizeWebImportLayers";
import { pinPhoneShellBottomChromeNodes } from "@/lib/webImport/phoneShellBottomChrome";
import {
  applyPhoneShellFullPageLayout,
  isPhoneShellClassName,
  shouldPreserveViewportFrameBounds,
} from "@/lib/webImport/phoneShellViewport";

/** Grow frames/groups to fit positioned children (includes bottom padding). */
export function expandImportedFrameHeights(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  passes = 3,
): void {
  for (let pass = 0; pass < passes; pass++) {
    expandFramesToFitChildren(nodes, childOrder);
  }
}

function expandFramesToFitChildren(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    if (parentId === EDITOR_ROOT_KEY) continue;
    const parent = nodes[parentId];
    if (!parent || (parent.type !== "frame" && parent.type !== "group")) continue;
    if (shouldPreserveViewportFrameBounds(parent)) continue;
    if (kids.length === 0) continue;

    const padR = parent.paddingRight ?? 0;
    const padB = parent.paddingBottom ?? 0;
    let maxX = 0;
    let maxY = 0;
    for (const cid of kids) {
      const c = nodes[cid];
      if (!c?.visible) continue;
      maxX = Math.max(maxX, c.x + c.width);
      maxY = Math.max(maxY, c.y + c.height);
    }
    const needW = maxX + padR;
    const needH = maxY + padB;
    if (needW > parent.width || needH > parent.height) {
      nodes[parentId] = {
        ...parent,
        width: Math.max(parent.width, Math.ceil(needW)),
        height: Math.max(parent.height, Math.ceil(needH)),
      };
    }
  }
}

/** Finalize an imported web graph: normalize layers, preserve 1:1 positions, expand frames. */
export function finalizeWebImportGraph(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  pageWidth: number,
  pageHeight: number,
  opts?: { composition?: "screen" | "component"; bridgeCapture?: boolean },
): Record<string, EditorNode> {
  const bridge = opts?.bridgeCapture === true;

  if (!bridge) {
    dedupeOverlappingFormSiblings(nodes, childOrder);
    collapsePassThroughWrappers(nodes, childOrder);
    trimFramesToChildBounds(nodes, childOrder);
    fixOverlappingStackedSiblings(nodes, childOrder);
    normalizeFooterLegalText(nodes, childOrder);
    normalizeEmailToButtonGap(nodes, childOrder);
  }

  if (!bridge) {
    normalizeWebImportTextNodes(nodes);
    normalizeImportedLabelTextNodes(nodes);
    normalizeListItemTextNodes(nodes, childOrder);
    normalizeBottomNavTextNodes(nodes);
  }

  normalizeWebImportSvgPaths(nodes);
  normalizeWebImportColors(nodes);

  if (!bridge) {
    expandImportedFrameHeights(nodes, childOrder);
  }
  preserveWebImportOverflowEffects(nodes, childOrder);
  if (opts?.composition === "component") {
    enforceManualComponentComposition(nodes, childOrder);
  } else {
    applyPhoneShellFullPageLayout(nodes, childOrder, pageWidth, pageHeight);
    if (!bridge) {
      applyWebImportAutoLayoutStructure(nodes, childOrder);
    }
    if (!bridge) {
      normalizeListItemTextNodes(nodes, childOrder);
    }
    enforceManualScreenFrames(nodes, childOrder);
    if (!bridge) {
      disableAutoLayoutForAbsoluteChildren(nodes, childOrder);
    }
  }

  if (opts?.composition !== "component") {
    const shellHeight =
      Object.values(nodes).find((n) => isPhoneShellClassName(n.codeClassName))?.height ?? pageHeight;
    pinPhoneShellBottomChromeNodes(nodes, childOrder, shellHeight);
  }

  return nodes;
}
