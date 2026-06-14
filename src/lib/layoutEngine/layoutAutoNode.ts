import {
  measureNode,
  resolveFlowLayoutExtent,
  resolveHugSize,
  type MeasureContext,
} from "./measure";
import { layoutChildren } from "./layoutChildren";
import { resolveLayoutGap } from "./inferGap";
import {
  isAutoLayoutContainer,
  isFlowChild,
  LAYOUT_DEFAULTS,
  paddingBox,
  parentCounterAxisHug,
  parentPrimaryAxisHug,
  resolveParentLayoutSize,
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

/**
 * Layout one auto-layout container and its descendants (nested AL first).
 * Independent of canvas rendering — returns geometry patches only.
 */
export function layoutAutoNode(
  parentId: string,
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
): LayoutAutoNodeResult {
  const parent = nodes[parentId];
  if (!parent || !isAutoLayoutContainer(parent)) {
    return { children: {} };
  }

  const mode = parent.layoutMode ?? LAYOUT_DEFAULTS.layoutMode;
  if (mode === "none") return { children: {} };

  let working = { ...nodes };

  // Bottom-up: layout nested auto-layout children first
  const allKids = layoutableChildIds(parentId, working, childOrder);
  for (const cid of allKids) {
    const c = working[cid];
    if (c && isAutoLayoutContainer(c)) {
      const nested = layoutAutoNode(cid, working, childOrder);
      working = applyLayoutResult(working, cid, nested);
    }
  }

  // Child list order is authoritative for flow (reorder updates canvas via relayout).
  const kids = flowChildIds(parentId, working, childOrder);
  if (kids.length === 0) {
    return { children: {}, parent: { layoutDirty: false } };
  }

  const p = paddingBox(parent);
  const gap = resolveLayoutGap(parent, kids, working, mode);
  const wrap = parent.layoutWrap ?? LAYOUT_DEFAULTS.layoutWrap;
  const primary = parent.primaryAxisAlign ?? LAYOUT_DEFAULTS.primaryAxisAlign;
  const cross = parent.counterAxisAlign ?? LAYOUT_DEFAULTS.counterAxisAlign;

  const ctx: MeasureContext = { nodes: working, childOrder };
  const measures = kids.map((id) => measureNode(id, ctx, mode));

  const lineCount = wrap
    ? buildLineCountEstimate(mode, measures, gap, parent.width - p.left - p.right, parent.height - p.top - p.bottom)
    : 1;

  const hugSize = resolveHugSize(parent, measures, mode, gap, lineCount);
  const layoutSize = resolveParentLayoutSize(parent, hugSize);
  const parentW = layoutSize.width;
  const parentH = layoutSize.height;

  const innerW = Math.max(0, parentW - p.left - p.right);
  const innerH = Math.max(0, parentH - p.top - p.bottom);

  const children = layoutChildren({
    mode,
    parent,
    childIds: kids,
    measures,
    nodes: working,
    innerW,
    innerH,
    padLeft: p.left,
    padTop: p.top,
    gap,
    primary,
    cross,
    wrap,
  });

  // Absolute children keep manual x/y; clear dirty only
  for (const cid of layoutableChildIds(parentId, working, childOrder)) {
    const abs = working[cid];
    if (abs && !isFlowChild(abs)) {
      children[cid] = {
        x: abs.x,
        y: abs.y,
        width: abs.width,
        height: abs.height,
        computedWidth: abs.width,
        computedHeight: abs.height,
        layoutDirty: false,
      };
    }
  }

  const extent = resolveFlowLayoutExtent(parent, kids, children);

  const parentPatch: LayoutAutoNodeResult["parent"] = {
    computedWidth: extent.width,
    computedHeight: extent.height,
    layoutDirty: false,
  };
  if (parent.layoutGapAuto) {
    parentPatch.layoutGap = gap;
  }
  if (parentPrimaryAxisHug(parent)) {
    const target =
      mode === "horizontal" ? extent.width : extent.height;
    const current = mode === "horizontal" ? parent.width : parent.height;
    if (Math.abs(target - current) > 0.01) {
      if (mode === "horizontal") parentPatch.width = extent.width;
      else parentPatch.height = extent.height;
    }
  }
  if (parentCounterAxisHug(parent)) {
    const target =
      mode === "horizontal" ? extent.height : extent.width;
    const current = mode === "horizontal" ? parent.height : parent.width;
    if (Math.abs(target - current) > 0.01) {
      if (mode === "horizontal") parentPatch.height = extent.height;
      else parentPatch.width = extent.width;
    }
  }

  return { children, parent: parentPatch };
}

function buildLineCountEstimate(
  mode: "horizontal" | "vertical",
  measures: { main: number }[],
  gap: number,
  innerW: number,
  innerH: number,
): number {
  const innerMain = mode === "horizontal" ? innerW : innerH;
  let lines = 1;
  let cur = 0;
  for (let i = 0; i < measures.length; i++) {
    const m = measures[i]!.main;
    const add = (i > 0 ? gap : 0) + m;
    if (i > 0 && cur + add > innerMain + 0.5) {
      lines++;
      cur = m;
    } else {
      cur += add;
    }
  }
  return lines;
}

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

/** Deep layout: parent then nested auto-layout children. */
export function layoutAutoNodeDeep(
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
  parentId: string,
): Record<string, LayoutEngineNode> {
  let next = nodes;
  const result = layoutAutoNode(parentId, next, childOrder);
  next = applyLayoutResult(next, parentId, result);
  const parent = next[parentId];
  if (!parent || !isAutoLayoutContainer(parent)) return next;
  for (const cid of childOrder[parentId] ?? []) {
    const c = next[cid];
    if (c && isAutoLayoutContainer(c)) {
      next = layoutAutoNodeDeep(next, childOrder, cid);
    }
  }
  return next;
}
