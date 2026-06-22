import {
  isAutoLayoutContainer,
  isFlowChild,
  sizingMode,
  type LayoutAutoNodeResult,
  type LayoutEngineNode,
} from "./types";

export function layoutableChildIds(
  parentId: string,
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
): string[] {
  return (childOrder[parentId] ?? []).filter((cid) => {
    const c = nodes[cid];
    return c && c.visible && !c.locked;
  });
}

export function flowChildIds(
  parentId: string,
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
): string[] {
  return layoutableChildIds(parentId, nodes, childOrder).filter((id) =>
    isFlowChild(nodes[id]!),
  );
}

export { sortIdsForAutoLayoutFlow } from "./flowOrder";

export function applyLayoutResult(
  nodes: Record<string, LayoutEngineNode>,
  parentId: string,
  result: LayoutAutoNodeResult,
): Record<string, LayoutEngineNode> {
  let next = { ...nodes };
  if (result.parent) {
    const pn = next[parentId];
    if (pn) {
      const parentPatch = { ...result.parent };
      const mode = pn.layoutMode ?? "none";
      if (mode === "horizontal") {
        if (sizingMode(pn.layoutSizingHorizontal) === "fixed") delete parentPatch.width;
        if (sizingMode(pn.layoutSizingVertical) === "fixed") delete parentPatch.height;
      } else if (mode === "vertical") {
        if (sizingMode(pn.layoutSizingVertical) === "fixed") delete parentPatch.height;
        if (sizingMode(pn.layoutSizingHorizontal) === "fixed") delete parentPatch.width;
      }
      next[parentId] = { ...pn, ...parentPatch };
    }
  }
  for (const [cid, patch] of Object.entries(result.children)) {
    const cn = next[cid];
    if (!cn || cn.locked) continue;
    next[cid] = { ...cn, ...patch };
  }
  return next;
}
