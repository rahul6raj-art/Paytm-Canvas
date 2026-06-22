/**
 * Layout dirty invalidation — maps editor events to relayout scope.
 * Rendering never reads these; they drive when {@link relayoutDirtyTree} runs.
 */

import { markLayoutDirty } from "./dirty";
import { isAutoLayoutContainer, type LayoutEngineNode } from "./types";
import { childMainSizing, childCrossSizing } from "./types";
import type { LayoutMode } from "./types";

export type LayoutDirtyReason =
  | "text-change"
  | "font-style-change"
  | "child-size-change"
  | "parent-size-change"
  | "padding-gap-align-change"
  | "visibility-change"
  | "sizing-mode-change"
  | "absolute-position-change"
  | "manual";

/** Text / font changes: mark node + all Hug ancestors. */
export function invalidateTextLayout(
  nodes: Record<string, LayoutEngineNode>,
  nodeId: string,
): Record<string, LayoutEngineNode> {
  return markLayoutDirty(nodes, nodeId);
}

/** Padding, gap, alignment, wrap, layout mode. */
export function invalidateContainerLayout(
  nodes: Record<string, LayoutEngineNode>,
  containerId: string,
): Record<string, LayoutEngineNode> {
  let next = { ...nodes };
  const n = next[containerId];
  if (n) next[containerId] = { ...n, layoutDirty: true };
  return markLayoutDirty(next, containerId);
}

/** Parent fixed-axis resize: mark fill descendants on affected axes. */
export function invalidateFillDescendants(
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
  parentId: string,
): Record<string, LayoutEngineNode> {
  const parent = nodes[parentId];
  if (!parent || !isAutoLayoutContainer(parent)) return nodes;
  const mode = parent.layoutMode as Exclude<LayoutMode, "none">;
  let next = { ...nodes };

  const walk = (id: string) => {
    for (const cid of childOrder[id] ?? []) {
      const c = next[cid];
      if (!c || !c.visible || c.locked) continue;
      const mainFill = childMainSizing(c, mode) === "fill";
      const crossFill = childCrossSizing(c, mode) === "fill";
      if (mainFill || crossFill) {
        next[cid] = { ...c, layoutDirty: true };
      }
      if (isAutoLayoutContainer(c)) walk(cid);
    }
  };
  walk(parentId);
  return next;
}

/** Visibility toggle: parent must relayout. */
export function invalidateVisibilityChange(
  nodes: Record<string, LayoutEngineNode>,
  nodeId: string,
): Record<string, LayoutEngineNode> {
  const n = nodes[nodeId];
  if (!n?.parentId) return nodes;
  return invalidateContainerLayout(nodes, n.parentId);
}
