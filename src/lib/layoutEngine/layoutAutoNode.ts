import { MAX_LAYOUT_DEPTH } from "./layoutPipeline";
import {
  layoutAutoLayoutRecursive,
  applyLayoutSubtree,
} from "./layoutNested";
import {
  applyLayoutResult,
  flowChildIds,
  layoutableChildIds,
} from "./layoutGraph";
import {
  isAutoLayoutContainer,
  type LayoutAutoNodeResult,
  type LayoutEngineNode,
} from "./types";

export {
  applyLayoutResult,
  flowChildIds,
  layoutableChildIds,
} from "./layoutGraph";
export { sortIdsForAutoLayoutFlow } from "./flowOrder";
export {
  layoutAutoLayoutRecursive,
  measureBottomUp,
  applyLayoutSubtree,
  type NestedLayoutCache,
  type NodeLayoutMetrics,
} from "./layoutNested";

/**
 * Layout one auto-layout container and entire nested subtree.
 * Bottom-up measure → pipeline → top-down nested recurse → hug refresh.
 */
export function layoutAutoNode(
  parentId: string,
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
  depth = 0,
): LayoutAutoNodeResult {
  if (depth > MAX_LAYOUT_DEPTH) return { children: {} };
  return layoutAutoLayoutRecursive(parentId, nodes, childOrder, depth);
}

/** Deep layout: single recursive pass from root (no duplicate child relayout). */
export function layoutAutoNodeDeep(
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
  parentId: string,
): Record<string, LayoutEngineNode> {
  const result = layoutAutoLayoutRecursive(parentId, nodes, childOrder, 0);
  return applyLayoutSubtree(nodes, parentId, result);
}
