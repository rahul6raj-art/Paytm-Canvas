import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  collapsePassThroughWrappers,
  dedupeOverlappingFormSiblings,
  disableAutoLayoutForAbsoluteChildren,
  fixOverlappingStackedSiblings,
  normalizeFooterLegalText,
  normalizeEmailToButtonGap,
  normalizeWebImportTextNodes,
  normalizeBottomNavTextNodes,
  normalizeWebImportSvgPaths,
  normalizeWebImportColors,
  preserveWebImportOverflowEffects,
  stripWebImportAutoLayout,
  trimFramesToChildBounds,
} from "@/lib/webImport/normalizeWebImportLayers";
import { pinPhoneShellBottomChromeNodes } from "@/lib/webImport/phoneShellBottomChrome";
import {
  applyPhoneShellFullPageLayout,
  isPhoneShellClassName,
  shouldPreserveViewportFrameBounds,
} from "@/lib/webImport/phoneShellViewport";

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

/** Finalize an imported web graph: normalize layers, keep captured layout, expand frames. */
export function finalizeWebImportGraph(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  pageWidth: number,
  pageHeight: number,
): Record<string, EditorNode> {
  dedupeOverlappingFormSiblings(nodes, childOrder);
  collapsePassThroughWrappers(nodes, childOrder);
  preserveWebImportLayout(nodes);
  stripWebImportAutoLayout(nodes);
  trimFramesToChildBounds(nodes, childOrder);
  fixOverlappingStackedSiblings(nodes, childOrder);
  normalizeFooterLegalText(nodes, childOrder);
  normalizeEmailToButtonGap(nodes, childOrder);
  disableAutoLayoutForAbsoluteChildren(nodes, childOrder);
  normalizeWebImportTextNodes(nodes);
  normalizeBottomNavTextNodes(nodes);
  normalizeWebImportSvgPaths(nodes);
  normalizeWebImportColors(nodes);

  for (let pass = 0; pass < 3; pass++) {
    expandFramesToFitChildren(nodes, childOrder);
  }
  preserveWebImportOverflowEffects(nodes, childOrder);
  applyPhoneShellFullPageLayout(nodes, childOrder, pageWidth, pageHeight);
  const shellHeight =
    Object.values(nodes).find((n) => isPhoneShellClassName(n.codeClassName))?.height ?? pageHeight;
  pinPhoneShellBottomChromeNodes(nodes, childOrder, shellHeight);

  return nodes;
}

/**
 * Position-faithful import: pin children with absolute coords inside captured
 * flex/stack parents so the layout engine cannot reflow browser geometry.
 */
function preserveWebImportLayout(nodes: Record<string, EditorNode>): void {
  for (const [id, n] of Object.entries(nodes)) {
    const patch: Partial<EditorNode> = { layoutDirty: false };
    if (n.parentId != null) {
      patch.layoutPositioning = "absolute";
    }
    nodes[id] = { ...n, ...patch };
  }
}
