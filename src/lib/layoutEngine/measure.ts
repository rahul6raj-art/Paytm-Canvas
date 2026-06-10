import { textAdvancedStyleFromNode } from "@/lib/text/textAdvancedStyle";
import { computeTextBoxSize } from "@/lib/text/textLayout";
import { resolveTextTypo } from "@/lib/textTypography";
import type { EditorNode } from "@/stores/useEditorStore";
import { inferAutoLayoutGap } from "./inferGap";
import {
  childCrossSizing,
  childMainSizing,
  clampDimension,
  flowGapForSizing,
  isAutoLayoutContainer,
  isFlowChild,
  paddingBox,
  parentCounterAxisHug,
  parentPrimaryAxisHug,
  type LayoutChildPatch,
  type LayoutEngineNode,
  type LayoutMode,
  type Size2,
  sizingMode,
} from "./types";

export type MeasureContext = {
  nodes: Record<string, LayoutEngineNode>;
  childOrder: Record<string, string[]>;
  /** Pre-layout nested auto-layout containers (id → measured size). */
  nestedSizes?: Map<string, Size2>;
};

function layoutableFlowChildIds(
  parentId: string,
  ctx: MeasureContext,
): string[] {
  return (ctx.childOrder[parentId] ?? []).filter((cid) => {
    const c = ctx.nodes[cid];
    return c && c.visible && !c.locked && isFlowChild(c);
  });
}

/** Intrinsic size for a leaf or pre-laid-out node on one axis. */
function intrinsicAxis(
  node: LayoutEngineNode,
  axis: "width" | "height",
  ctx: MeasureContext,
): number {
  const nested = ctx.nestedSizes?.get(node.id);
  if (nested) {
    return axis === "width" ? nested.width : nested.height;
  }

  if (node.type === "text") {
    const asEditor = node as unknown as EditorNode;
    const typo = resolveTextTypo(asEditor);
    const mode = node.textResizeMode ?? "auto-width";
    const size = computeTextBoxSize(
      node.content ?? "",
      typo,
      mode,
      node.width,
      node.height,
      textAdvancedStyleFromNode(asEditor),
    );
    return axis === "width" ? size.width : size.height;
  }

  if (isAutoLayoutContainer(node)) {
    const mode = node.layoutMode!;
    const mainIsWidth = mode === "horizontal";
    const hugMain =
      mainIsWidth
        ? sizingMode(node.layoutSizingHorizontal) === "hug"
        : sizingMode(node.layoutSizingVertical) === "hug";
    const hugCross =
      mainIsWidth
        ? sizingMode(node.layoutSizingVertical) === "hug"
        : sizingMode(node.layoutSizingHorizontal) === "hug";
    if ((axis === "width" && hugMain) || (axis === "height" && !mainIsWidth && hugMain)) {
      return measureHugMainAxis(node.id, ctx);
    }
    if ((axis === "height" && hugCross) || (axis === "width" && !mainIsWidth && hugCross)) {
      return measureHugCrossAxis(node.id, ctx);
    }
  }

  return axis === "width"
    ? clampDimension(node.width, node.minWidth, node.maxWidth)
    : clampDimension(node.height, node.minHeight, node.maxHeight);
}

function measureHugMainAxis(parentId: string, ctx: MeasureContext): number {
  const parent = ctx.nodes[parentId]!;
  const mode = parent.layoutMode!;
  if (mode === "none") return parent.width;
  const p = {
    top: parent.paddingTop ?? 0,
    right: parent.paddingRight ?? 0,
    bottom: parent.paddingBottom ?? 0,
    left: parent.paddingLeft ?? 0,
  };
  const kids = layoutableFlowChildIds(parentId, ctx);
  const gap = parent.layoutGapAuto
    ? inferAutoLayoutGap(ctx.nodes, kids, mode)
    : (parent.layoutGap ?? 0);
  if (kids.length === 0) {
    return mode === "horizontal"
      ? p.left + p.right + 1
      : p.top + p.bottom + 1;
  }

  let sumMain = 0;
  let maxCross = 0;
  for (const id of kids) {
    const m = measureNode(id, ctx, mode);
    sumMain += m.main;
    maxCross = Math.max(maxCross, m.cross);
  }
  sumMain += flowGapForSizing(gap, kids.length);

  if (mode === "horizontal") {
    return clampDimension(p.left + p.right + sumMain, parent.minWidth, parent.maxWidth);
  }
  return clampDimension(p.top + p.bottom + sumMain, parent.minHeight, parent.maxHeight);
}

function measureHugCrossAxis(parentId: string, ctx: MeasureContext): number {
  const parent = ctx.nodes[parentId]!;
  const mode = parent.layoutMode!;
  if (mode === "none") return parent.height;
  const p = {
    top: parent.paddingTop ?? 0,
    right: parent.paddingRight ?? 0,
    bottom: parent.paddingBottom ?? 0,
    left: parent.paddingLeft ?? 0,
  };
  const kids = layoutableFlowChildIds(parentId, ctx);
  let maxCross = 0;
  for (const id of kids) {
    const m = measureNode(id, ctx, mode);
    maxCross = Math.max(maxCross, m.cross);
  }
  if (mode === "horizontal") {
    return clampDimension(p.top + p.bottom + (maxCross || 1), parent.minHeight, parent.maxHeight);
  }
  return clampDimension(p.left + p.right + (maxCross || 1), parent.minWidth, parent.maxWidth);
}

export type MeasuredChild = { main: number; cross: number; width: number; height: number };

/**
 * Measure a node along main/cross axes for its parent's flow direction.
 * Respects hug on children (uses intrinsic / nested layout size).
 */
export function measureNode(
  nodeId: string,
  ctx: MeasureContext,
  parentMode: Exclude<LayoutMode, "none">,
): MeasuredChild {
  const child = ctx.nodes[nodeId]!;
  const mainMode = childMainSizing(child, parentMode);
  const crossMode = childCrossSizing(child, parentMode);

  let main: number;
  let cross: number;

  if (mainMode === "hug") {
    main =
      parentMode === "horizontal"
        ? intrinsicAxis(child, "width", ctx)
        : intrinsicAxis(child, "height", ctx);
  } else {
    main =
      parentMode === "horizontal"
        ? clampDimension(child.width, child.minWidth, child.maxWidth)
        : clampDimension(child.height, child.minHeight, child.maxHeight);
  }

  if (crossMode === "hug") {
    cross =
      parentMode === "horizontal"
        ? intrinsicAxis(child, "height", ctx)
        : intrinsicAxis(child, "width", ctx);
  } else {
    cross =
      parentMode === "horizontal"
        ? clampDimension(child.height, child.minHeight, child.maxHeight)
        : clampDimension(child.width, child.minWidth, child.maxWidth);
  }

  main = Math.max(1, main);
  cross = Math.max(1, cross);

  const width = parentMode === "horizontal" ? main : cross;
  const height = parentMode === "horizontal" ? cross : main;
  return { main, cross, width, height };
}

/**
 * Tight frame size from laid-out child bounds (includes negative gap overlap).
 * Child width/height are unchanged — only the container shrinks/grows to fit.
 */
export function resolveFlowLayoutExtent(
  parent: LayoutEngineNode,
  childIds: string[],
  children: Record<string, LayoutChildPatch>,
): Size2 {
  const p = paddingBox(parent);
  if (childIds.length === 0) {
    return {
      width: clampDimension(p.left + p.right + 1, parent.minWidth, parent.maxWidth),
      height: clampDimension(p.top + p.bottom + 1, parent.minHeight, parent.maxHeight),
    };
  }

  let maxX = 0;
  let maxY = 0;
  for (const id of childIds) {
    const c = children[id];
    if (!c || c.x == null || c.y == null) continue;
    const w = Math.max(1, c.width ?? 1);
    const h = Math.max(1, c.height ?? 1);
    maxX = Math.max(maxX, c.x + w);
    maxY = Math.max(maxY, c.y + h);
  }

  return {
    width: clampDimension(maxX + p.right, parent.minWidth, parent.maxWidth),
    height: clampDimension(maxY + p.bottom, parent.minHeight, parent.maxHeight),
  };
}

/** Content size from children + gap + padding (ignores fixed/hug sizing). */
export function resolveContentSize(
  parent: LayoutEngineNode,
  childMeasures: MeasuredChild[],
  mode: Exclude<LayoutMode, "none">,
  gap: number,
  lineCount = 1,
): Size2 {
  const p = {
    top: parent.paddingTop ?? 0,
    right: parent.paddingRight ?? 0,
    bottom: parent.paddingBottom ?? 0,
    left: parent.paddingLeft ?? 0,
  };
  if (childMeasures.length === 0) {
    return {
      width: clampDimension(p.left + p.right + 1, parent.minWidth, parent.maxWidth),
      height: clampDimension(p.top + p.bottom + 1, parent.minHeight, parent.maxHeight),
    };
  }

  const sumMain = childMeasures.reduce((s, m) => s + m.main, 0);
  const maxCross = Math.max(...childMeasures.map((m) => m.cross));
  const gaps = flowGapForSizing(gap, childMeasures.length);
  const lineGaps = flowGapForSizing(gap, lineCount);

  if (mode === "horizontal") {
    return {
      width: clampDimension(p.left + p.right + sumMain + gaps, parent.minWidth, parent.maxWidth),
      height: clampDimension(
        p.top + p.bottom + maxCross * lineCount + lineGaps,
        parent.minHeight,
        parent.maxHeight,
      ),
    };
  }
  return {
    width: clampDimension(
      p.left + p.right + maxCross * lineCount + lineGaps,
      parent.minWidth,
      parent.maxWidth,
    ),
    height: clampDimension(p.top + p.bottom + sumMain + gaps, parent.minHeight, parent.maxHeight),
  };
}

/** Hug size for a container on width/height (after children measured). */
export function resolveHugSize(
  parent: LayoutEngineNode,
  childMeasures: MeasuredChild[],
  mode: Exclude<LayoutMode, "none">,
  gap: number,
  lineCount = 1,
): Size2 {
  const p = {
    top: parent.paddingTop ?? 0,
    right: parent.paddingRight ?? 0,
    bottom: parent.paddingBottom ?? 0,
    left: parent.paddingLeft ?? 0,
  };
  if (childMeasures.length === 0) {
    return {
      width: clampDimension(p.left + p.right + 1, parent.minWidth, parent.maxWidth),
      height: clampDimension(p.top + p.bottom + 1, parent.minHeight, parent.maxHeight),
    };
  }

  const sumMain = childMeasures.reduce((s, m) => s + m.main, 0);
  const maxCross = Math.max(...childMeasures.map((m) => m.cross));
  const gaps = flowGapForSizing(gap, childMeasures.length);
  const lineGaps = flowGapForSizing(gap, lineCount);

  let width = parent.width;
  let height = parent.height;

  if (mode === "horizontal") {
    if (parentPrimaryAxisHug(parent)) width = p.left + p.right + sumMain + gaps;
    if (parentCounterAxisHug(parent)) height = p.top + p.bottom + maxCross * lineCount + lineGaps;
  } else {
    if (parentPrimaryAxisHug(parent)) height = p.top + p.bottom + sumMain + gaps;
    if (parentCounterAxisHug(parent)) width = p.left + p.right + maxCross * lineCount + lineGaps;
  }

  return {
    width: clampDimension(width, parent.minWidth, parent.maxWidth),
    height: clampDimension(height, parent.minHeight, parent.maxHeight),
  };
}
