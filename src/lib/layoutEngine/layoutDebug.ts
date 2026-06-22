/**
 * Layout debug dump — enable with `globalThis.__CRAFT_LAYOUT_DEBUG__ = true`
 * or `localStorage.setItem('craft-layout-debug', '1')`.
 */

import type { LayoutAutoNodeResult } from "./types";
import type { LayoutEngineNode, LayoutMode } from "./types";
import { childMainSizing, childCrossSizing, sizingMode } from "./types";
import { calculateRemainingMainSpace } from "./sizing";
import type { MeasuredChild } from "./measure";
import { canFillOnMainAxis } from "./layoutConstraints";

export type LayoutDebugEntry = {
  id: string;
  parentId?: string | null;
  depth?: number;
  phase?: string;
  dirtyReason?: string;
  layoutMode: LayoutMode | undefined;
  widthMode: string;
  heightMode: string;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  availableWidth?: number;
  availableHeight?: number;
  computedWidth?: number;
  computedHeight?: number;
  x?: number;
  y?: number;
  layoutDirty?: boolean;
  remainingFillMain?: number;
  parentMainDefinite?: boolean;
};

export function isLayoutDebugEnabled(): boolean {
  if (typeof globalThis !== "undefined") {
    if ((globalThis as { __CRAFT_LAYOUT_DEBUG__?: boolean }).__CRAFT_LAYOUT_DEBUG__) return true;
  }
  if (typeof localStorage !== "undefined") {
    try {
      return localStorage.getItem("craft-layout-debug") === "1";
    } catch {
      return false;
    }
  }
  return false;
}

export function buildLayoutDebugDump(
  parentId: string,
  nodes: Record<string, LayoutEngineNode>,
  childIds: string[],
  measures: MeasuredChild[],
  mode: Exclude<LayoutMode, "none">,
  gap: number,
  innerMain: number,
  result: LayoutAutoNodeResult,
  passCount = 1,
): LayoutDebugEntry[] {
  const parent = nodes[parentId]!;
  const remaining = calculateRemainingMainSpace(
    innerMain,
    childIds,
    measures,
    nodes,
    mode,
    gap,
  );

  const entries: LayoutDebugEntry[] = [
    {
      id: parentId,
      layoutMode: parent.layoutMode,
      widthMode: sizingMode(parent.layoutSizingHorizontal),
      heightMode: sizingMode(parent.layoutSizingVertical),
      computedWidth: result.parent?.computedWidth ?? result.parent?.width,
      computedHeight: result.parent?.computedHeight ?? result.parent?.height,
      layoutDirty: parent.layoutDirty,
      remainingFillMain: remaining,
      parentMainDefinite: canFillOnMainAxis(parent, mode),
    },
  ];

  childIds.forEach((id, i) => {
    const n = nodes[id]!;
    const m = measures[i]!;
    const patch = result.children[id];
    entries.push({
      id,
      layoutMode: n.layoutMode,
      widthMode: sizingMode(n.layoutSizingHorizontal),
      heightMode: sizingMode(n.layoutSizingVertical),
      intrinsicWidth: m.width,
      intrinsicHeight: m.height,
      computedWidth: patch?.computedWidth ?? patch?.width,
      computedHeight: patch?.computedHeight ?? patch?.height,
      x: patch?.x,
      y: patch?.y,
      layoutDirty: n.layoutDirty,
    });
  });

  if (isLayoutDebugEnabled()) {
    console.groupCollapsed(`[layout] ${parentId} (${passCount} pass${passCount === 1 ? "" : "es"})`);
    console.table(entries);
    console.groupEnd();
  }

  return entries;
}

export function logNestedLayoutDebug(opts: {
  nodeId: string;
  parentId: string | null | undefined;
  depth: number;
  node: LayoutEngineNode;
  metrics?: {
    intrinsicWidth?: number;
    intrinsicHeight?: number;
    computedWidth?: number;
    computedHeight?: number;
    availableWidth?: number;
    availableHeight?: number;
  };
  dirtyReason?: string;
  phase: string;
}): void {
  if (!isLayoutDebugEnabled()) return;
  const entry: LayoutDebugEntry = {
    id: opts.nodeId,
    parentId: opts.parentId,
    depth: opts.depth,
    phase: opts.phase,
    dirtyReason: opts.dirtyReason,
    layoutMode: opts.node.layoutMode,
    widthMode: sizingMode(opts.node.layoutSizingHorizontal),
    heightMode: sizingMode(opts.node.layoutSizingVertical),
    intrinsicWidth: opts.metrics?.intrinsicWidth,
    intrinsicHeight: opts.metrics?.intrinsicHeight,
    availableWidth: opts.metrics?.availableWidth,
    availableHeight: opts.metrics?.availableHeight,
    computedWidth: opts.metrics?.computedWidth ?? opts.node.computedWidth ?? opts.node.width,
    computedHeight: opts.metrics?.computedHeight ?? opts.node.computedHeight ?? opts.node.height,
    layoutDirty: opts.node.layoutDirty,
  };
  console.log(`[layout nested] ${opts.phase}`, entry);
}
