/**
 * Figma-style auto layout pipeline.
 *
 * Phases (measurement → layout → positioning):
 *
 * Pass 1 — Measure content: intrinsic sizes for text, images, and hug-sized nodes.
 * Pass 2 — Resolve HUG (bottom-up): hug axes from children + padding + gap.
 * Pass 3 — Resolve FIXED: explicit width/height on fixed axes (ignores content overflow).
 * Pass 4 — Remaining space: inner main-axis space minus fixed/hug children and gaps.
 * Pass 5 — Assign FILL: distribute remaining main-axis space by layoutGrow weights.
 * Pass 6 — Alignment: position children with primary/counter alignment and wrap.
 *
 * Rendering is separate — this module returns geometry patches only.
 */

import {
  measureNode,
  resolveFlowLayoutExtent,
  resolveHugSize,
  type MeasureContext,
  type MeasuredChild,
} from "./measure";
import { layoutChildren } from "./layoutChildren";
import { calculateRemainingMainSpace } from "./sizing";
import { resolveLayoutGap } from "./inferGap";
import { buildLayoutDebugDump } from "./layoutDebug";
import { clampDimension } from "./types";
import {
  flowChildIds,
  layoutableChildIds,
} from "./layoutGraph";
import {
  isAutoLayoutContainer,
  isFlowChild,
  LAYOUT_DEFAULTS,
  paddingBox,
  parentCounterAxisHug,
  parentPrimaryAxisHug,
  type LayoutAutoNodeResult,
  type LayoutEngineNode,
  type LayoutMode,
  type Size2,
} from "./types";

/** Maximum nesting depth — prevents layout loops on corrupted graphs. */
export const MAX_LAYOUT_DEPTH = 256;

export type LayoutPipelinePass =
  | "measure-content"
  | "resolve-hug"
  | "resolve-fixed"
  | "remaining-space"
  | "assign-fill"
  | "alignment";

export type LayoutPipelineInput = {
  parentId: string;
  nodes: Record<string, LayoutEngineNode>;
  childOrder: Record<string, string[]>;
  /** Bottom-up intrinsic sizes for nested auto-layout frames. */
  nestedSizes?: Map<string, Size2>;
};

/** Pass 1 — measure content-based sizes for each flow child. */
export function pass1MeasureFlowChildren(
  parent: LayoutEngineNode,
  childIds: string[],
  ctx: MeasureContext,
  mode: Exclude<LayoutMode, "none">,
): MeasuredChild[] {
  return childIds.map((id) => measureNode(id, ctx, mode, parent));
}

/** Pass 2 — hug container size from measured children (per-axis). */
export function pass2ResolveHugContainerSize(
  parent: LayoutEngineNode,
  measures: MeasuredChild[],
  mode: Exclude<LayoutMode, "none">,
  gap: number,
  lineCount: number,
) {
  return resolveHugSize(parent, measures, mode, gap, lineCount);
}

/** Pass 3 — combine hug-derived and fixed axes into the layout box. */
export function pass3ResolveFixedContainerSize(
  parent: LayoutEngineNode,
  hugSize: { width: number; height: number },
) {
  const mode = parent.layoutMode ?? "none";
  if (mode === "none") {
    return { width: parent.width, height: parent.height };
  }
  if (mode === "horizontal") {
    return {
      width: parentPrimaryAxisHug(parent) ? hugSize.width : parent.width,
      height: parentCounterAxisHug(parent) ? hugSize.height : parent.height,
    };
  }
  return {
    width: parentCounterAxisHug(parent) ? hugSize.width : parent.width,
    height: parentPrimaryAxisHug(parent) ? hugSize.height : parent.height,
  };
}

function estimateWrapLineCount(
  mode: "horizontal" | "vertical",
  measures: MeasuredChild[],
  gap: number,
  innerMain: number,
): number {
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

/**
 * Run passes 1–6 for one auto-layout container.
 * Caller must layout nested auto-layout children first (bottom-up pass 2 at tree level).
 */
export function runAutoLayoutPipeline(input: LayoutPipelineInput): LayoutAutoNodeResult {
  const { parentId, nodes, childOrder, nestedSizes } = input;

  const parent = nodes[parentId];
  if (!parent || !isAutoLayoutContainer(parent)) {
    return { children: {} };
  }

  const mode = parent.layoutMode ?? LAYOUT_DEFAULTS.layoutMode;
  if (mode === "none") return { children: {} };

  const kids = flowChildIds(parentId, nodes, childOrder);
  const p = paddingBox(parent);

  if (kids.length === 0) {
    const emptyHug = {
      width: clampDimension(p.left + p.right + 1, parent.minWidth, parent.maxWidth),
      height: clampDimension(p.top + p.bottom + 1, parent.minHeight, parent.maxHeight),
    };
    const layoutSize = pass3ResolveFixedContainerSize(parent, emptyHug);
    const parentPatch: LayoutAutoNodeResult["parent"] = {
      computedWidth: layoutSize.width,
      computedHeight: layoutSize.height,
      layoutDirty: false,
    };
    if (parentPrimaryAxisHug(parent)) {
      if (mode === "horizontal") parentPatch.width = layoutSize.width;
      else parentPatch.height = layoutSize.height;
    }
    if (parentCounterAxisHug(parent)) {
      if (mode === "horizontal") parentPatch.height = layoutSize.height;
      else parentPatch.width = layoutSize.width;
    }
    return { children: {}, parent: parentPatch };
  }

  const gap = resolveLayoutGap(parent, kids, nodes, mode);
  const wrap = parent.layoutWrap ?? LAYOUT_DEFAULTS.layoutWrap;
  const primary = parent.primaryAxisAlign ?? LAYOUT_DEFAULTS.primaryAxisAlign;
  const cross = parent.counterAxisAlign ?? LAYOUT_DEFAULTS.counterAxisAlign;

  const ctx: MeasureContext = { nodes, childOrder, nestedSizes };

  // Pass 1
  const measures = pass1MeasureFlowChildren(parent, kids, ctx, mode);

  const provisionalInnerMain =
    mode === "horizontal"
      ? Math.max(0, parent.width - p.left - p.right)
      : Math.max(0, parent.height - p.top - p.bottom);

  const lineCount = wrap
    ? estimateWrapLineCount(mode, measures, gap, provisionalInnerMain)
    : 1;

  // Pass 2
  const hugSize = pass2ResolveHugContainerSize(parent, measures, mode, gap, lineCount);

  // Pass 3
  const layoutSize = pass3ResolveFixedContainerSize(parent, hugSize);
  const parentW = layoutSize.width;
  const parentH = layoutSize.height;

  const innerW = Math.max(0, parentW - p.left - p.right);
  const innerH = Math.max(0, parentH - p.top - p.bottom);

  // Pass 4 (remaining space is computed inside layoutChildren before fill assignment)
  const innerMain = mode === "horizontal" ? innerW : innerH;
  calculateRemainingMainSpace(innerMain, kids, measures, nodes, mode, gap);

  // Passes 5–6
  const children = layoutChildren({
    mode,
    parent,
    childIds: kids,
    measures,
    nodes,
    innerW,
    innerH,
    padLeft: p.left,
    padTop: p.top,
    gap,
    primary,
    cross,
    wrap,
  });

  for (const cid of layoutableChildIds(parentId, nodes, childOrder)) {
    const abs = nodes[cid];
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
    if (mode === "horizontal") parentPatch.width = extent.width;
    else parentPatch.height = extent.height;
  }
  if (parentCounterAxisHug(parent)) {
    if (mode === "horizontal") parentPatch.height = extent.height;
    else parentPatch.width = extent.width;
  }

  buildLayoutDebugDump(
    parentId,
    nodes,
    kids,
    measures,
    mode,
    gap,
    innerMain,
    { children, parent: parentPatch },
  );

  return { children, parent: parentPatch };
}
