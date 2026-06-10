import { shouldClipChildren } from "@/lib/clipChildren";
import { flowChildIds } from "@/lib/layoutEngine/layoutAutoNode";
import {
  isAutoLayoutContainer,
  paddingBox,
  parentCounterAxisHug,
  parentPrimaryAxisHug,
  type LayoutEngineNode,
  type LayoutMode,
  type Size2,
} from "@/lib/layoutEngine/types";
import type { EditorNode } from "@/stores/useEditorStore";

function asEngineNode(n: EditorNode): LayoutEngineNode {
  return n as LayoutEngineNode;
}

/** Tight content box from laid-out flow children (parent-local). */
export function flowContentExtentLocal(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Size2 {
  const parent = nodes[parentId];
  if (!parent) return { width: 0, height: 0 };
  const pad = paddingBox(asEngineNode(parent));
  const kids = flowChildIds(parentId, nodes as Record<string, LayoutEngineNode>, childOrder);
  let maxX = pad.left;
  let maxY = pad.top;
  for (const id of kids) {
    const c = nodes[id];
    if (!c) continue;
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + c.height);
  }
  return {
    width: Math.max(parent.width, maxX + pad.right),
    height: Math.max(parent.height, maxY + pad.bottom),
  };
}

/**
 * Size used for auto-layout padding guides (dashed blue inset).
 * Clipped frames always use the frame box; hug axes expand to content when not clipped.
 */
export function autoLayoutPaddingGuideSize(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Size2 {
  const parent = nodes[parentId];
  if (!parent || !isAutoLayoutContainer(asEngineNode(parent))) {
    return { width: parent?.width ?? 0, height: parent?.height ?? 0 };
  }
  if (shouldClipChildren(parent)) {
    return { width: parent.width, height: parent.height };
  }

  const extent = flowContentExtentLocal(parentId, nodes, childOrder);
  const mode = parent.layoutMode as Exclude<LayoutMode, "none">;
  const pn = asEngineNode(parent);
  let width = parent.width;
  let height = parent.height;
  if (mode === "horizontal") {
    if (parentPrimaryAxisHug(pn)) width = extent.width;
    if (parentCounterAxisHug(pn)) height = extent.height;
  } else {
    if (parentPrimaryAxisHug(pn)) height = extent.height;
    if (parentCounterAxisHug(pn)) width = extent.width;
  }
  return { width, height };
}

/** True when a parent-local point lies inside the clip/frame guide box. */
export function autoLayoutPointInsideGuide(
  localX: number,
  localY: number,
  guideSize: Size2,
  parent: EditorNode,
): boolean {
  const pad = paddingBox(asEngineNode(parent));
  const innerLeft = pad.left;
  const innerTop = pad.top;
  const innerRight = guideSize.width - pad.right;
  const innerBottom = guideSize.height - pad.bottom;
  return localX >= innerLeft && localX <= innerRight && localY >= innerTop && localY <= innerBottom;
}
