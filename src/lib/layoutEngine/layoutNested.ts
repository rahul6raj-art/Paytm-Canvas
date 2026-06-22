/**
 * Nested Auto Layout — recursive bottom-up measure + top-down layout.
 *
 * Bottom-up: text/leaves → hug intrinsics → nested AL frames expose size to parents.
 * Top-down: parent definite size → fill assignment → position → recurse into nested AL.
 */

import { runAutoLayoutPipeline } from "./layoutPipeline";
import { measureNode, type MeasureContext } from "./measure";
import {
  applyLayoutResult,
  flowChildIds,
  layoutableChildIds,
} from "./layoutGraph";
import { resolveLayoutGap } from "./inferGap";
import { logNestedLayoutDebug } from "./layoutDebug";
import { textAdvancedStyleFromNode } from "@/lib/text/textAdvancedStyle";
import { computeTextBoxSize } from "@/lib/text/textLayout";
import { resolveTextTypo } from "@/lib/textTypography";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  clampDimension,
  isAutoLayoutContainer,
  isFlowChild,
  parentCounterAxisHug,
  parentPrimaryAxisHug,
  paddingBox,
  type LayoutAutoNodeResult,
  type LayoutEngineNode,
  type LayoutMode,
  type Size2,
} from "./types";
import { MAX_LAYOUT_DEPTH } from "./layoutPipeline";

export type NodeLayoutMetrics = {
  intrinsicWidth: number;
  intrinsicHeight: number;
  computedWidth?: number;
  computedHeight?: number;
  availableWidth?: number;
  availableHeight?: number;
};

export type NestedLayoutCache = Map<string, NodeLayoutMetrics>;

function measureLeafIntrinsic(node: LayoutEngineNode): Size2 {
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
    return {
      width: clampDimension(size.width, node.minWidth, node.maxWidth),
      height: clampDimension(size.height, node.minHeight, node.maxHeight),
    };
  }
  return {
    width: clampDimension(node.width, node.minWidth, node.maxWidth),
    height: clampDimension(node.height, node.minHeight, node.maxHeight),
  };
}

function cacheFromSize(id: string, size: Size2, cache: NestedLayoutCache): void {
  cache.set(id, {
    intrinsicWidth: size.width,
    intrinsicHeight: size.height,
    computedWidth: size.width,
    computedHeight: size.height,
  });
}

/**
 * Bottom-up pass: measure leaves, then resolve hug intrinsics for nested AL frames.
 * Populates `cache` and `nestedSizes` used by parent measure.
 */
export function measureBottomUp(
  nodeId: string,
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
  cache: NestedLayoutCache,
  nestedSizes: Map<string, Size2>,
  depth: number,
): void {
  if (depth > MAX_LAYOUT_DEPTH) return;
  const node = nodes[nodeId];
  if (!node || !node.visible || node.locked) return;

  if (!isAutoLayoutContainer(node)) {
    const leaf = measureLeafIntrinsic(node);
    cacheFromSize(nodeId, leaf, cache);
    nestedSizes.set(nodeId, leaf);
    return;
  }

  const mode = node.layoutMode as Exclude<LayoutMode, "none">;
  const kids = flowChildIds(nodeId, nodes, childOrder);

  for (const cid of kids) {
    const child = nodes[cid];
    if (!child) continue;
    if (isAutoLayoutContainer(child)) {
      measureBottomUp(cid, nodes, childOrder, cache, nestedSizes, depth + 1);
    } else {
      const leaf = measureLeafIntrinsic(child);
      cacheFromSize(cid, leaf, cache);
      nestedSizes.set(cid, leaf);
    }
  }

  if (kids.length === 0) {
    const p = paddingBox(node);
    const empty: Size2 = {
      width: clampDimension(p.left + p.right + 1, node.minWidth, node.maxWidth),
      height: clampDimension(p.top + p.bottom + 1, node.minHeight, node.maxHeight),
    };
    cacheFromSize(nodeId, empty, cache);
    nestedSizes.set(nodeId, empty);
    return;
  }

  const gap = resolveLayoutGap(node, kids, nodes, mode);
  const ctx: MeasureContext = { nodes, childOrder, nestedSizes };
  const measures = kids.map((id) => measureNode(id, ctx, mode, node));

  let intrinsicW = node.width;
  let intrinsicH = node.height;
  const p = paddingBox(node);
  const sumMain = measures.reduce((s, m) => s + m.main, 0);
  const maxCross = Math.max(...measures.map((m) => m.cross));
  const gaps = Math.max(0, gap) * Math.max(0, kids.length - 1);

  if (mode === "horizontal") {
    if (parentPrimaryAxisHug(node)) {
      intrinsicW = p.left + p.right + sumMain + gaps;
    }
    if (parentCounterAxisHug(node)) {
      intrinsicH = p.top + p.bottom + maxCross;
    }
  } else {
    if (parentPrimaryAxisHug(node)) {
      intrinsicH = p.top + p.bottom + sumMain + gaps;
    }
    if (parentCounterAxisHug(node)) {
      intrinsicW = p.left + p.right + maxCross;
    }
  }

  const size: Size2 = {
    width: clampDimension(intrinsicW, node.minWidth, node.maxWidth),
    height: clampDimension(intrinsicH, node.minHeight, node.maxHeight),
  };

  cache.set(nodeId, {
    intrinsicWidth: size.width,
    intrinsicHeight: size.height,
    computedWidth: size.width,
    computedHeight: size.height,
  });
  nestedSizes.set(nodeId, size);
}

function resolveNodeComputedSize(
  node: LayoutEngineNode,
  cache: NestedLayoutCache,
  available?: { width?: number; height?: number },
): Size2 {
  const metrics = cache.get(node.id);
  const mode = node.layoutMode ?? "none";

  let width = node.width;
  let height = node.height;

  const sizingH = node.layoutSizingHorizontal ?? "fixed";
  const sizingV = node.layoutSizingVertical ?? "fixed";

  if (sizingH === "hug") {
    width = metrics?.intrinsicWidth ?? node.width;
  } else if (sizingH === "fill" && available?.width != null) {
    width = available.width;
  }

  if (sizingV === "hug") {
    height = metrics?.intrinsicHeight ?? node.height;
  } else if (sizingV === "fill" && available?.height != null) {
    height = available.height;
  }

  if (mode !== "none") {
    if (mode === "horizontal") {
      if (parentPrimaryAxisHug(node)) width = metrics?.intrinsicWidth ?? width;
      if (parentCounterAxisHug(node)) height = metrics?.intrinsicHeight ?? height;
    } else {
      if (parentPrimaryAxisHug(node)) height = metrics?.intrinsicHeight ?? height;
      if (parentCounterAxisHug(node)) width = metrics?.intrinsicWidth ?? width;
    }
  }

  return {
    width: clampDimension(width, node.minWidth, node.maxWidth),
    height: clampDimension(height, node.minHeight, node.maxHeight),
  };
}

function mergeChildPatches(
  base: Record<string, LayoutAutoNodeResult["children"][string]>,
  extra: LayoutAutoNodeResult["children"],
): Record<string, LayoutAutoNodeResult["children"][string]> {
  return { ...base, ...extra };
}

/** Set only definite (fixed/fill) axes before pipeline; leave hug axes stale for parentPatch delta. */
function applyDefiniteAxesBeforePipeline(
  node: LayoutEngineNode,
  computed: Size2,
): LayoutEngineNode {
  const mode = node.layoutMode ?? "none";
  let width = node.width;
  let height = node.height;

  if (mode === "horizontal") {
    if (!parentPrimaryAxisHug(node)) width = computed.width;
    if (!parentCounterAxisHug(node)) height = computed.height;
  } else if (mode === "vertical") {
    if (!parentPrimaryAxisHug(node)) height = computed.height;
    if (!parentCounterAxisHug(node)) width = computed.width;
  }

  return {
    ...node,
    width,
    height,
    computedWidth: computed.width,
    computedHeight: computed.height,
  };
}

function syncWorkingFromChildren(
  working: Record<string, LayoutEngineNode>,
  patches: LayoutAutoNodeResult["children"],
): Record<string, LayoutEngineNode> {
  let next = working;
  for (const [cid, patch] of Object.entries(patches)) {
    const cn = next[cid];
    if (!cn || cn.locked) continue;
    next = { ...next, [cid]: { ...cn, ...patch } };
  }
  return next;
}

function applyChildLayoutPatchesOnly(
  nodes: Record<string, LayoutEngineNode>,
  result: LayoutAutoNodeResult,
): Record<string, LayoutEngineNode> {
  let next = { ...nodes };
  for (const [cid, patch] of Object.entries(result.children)) {
    const cn = next[cid];
    if (!cn || cn.locked) continue;
    next[cid] = { ...cn, ...patch };
  }
  return next;
}

/**
 * Layout one auto-layout subtree: bottom-up measure, pipeline, top-down nested recurse.
 */
export function layoutAutoLayoutRecursive(
  parentId: string,
  nodes: Record<string, LayoutEngineNode>,
  childOrder: Record<string, string[]>,
  depth = 0,
  available?: { width?: number; height?: number },
  dirtyReason = "relayout",
): LayoutAutoNodeResult {
  if (depth > MAX_LAYOUT_DEPTH) return { children: {} };

  const parent = nodes[parentId];
  if (!parent || !isAutoLayoutContainer(parent)) {
    return { children: {} };
  }

  const cache: NestedLayoutCache = new Map();
  const nestedSizes = new Map<string, Size2>();

  measureBottomUp(parentId, nodes, childOrder, cache, nestedSizes, depth);

  let working = { ...nodes };
  const computed = resolveNodeComputedSize(parent, cache, available);
  const metrics = cache.get(parentId);
  if (metrics) {
    cache.set(parentId, {
      ...metrics,
      availableWidth: available?.width,
      availableHeight: available?.height,
      computedWidth: computed.width,
      computedHeight: computed.height,
    });
  }

  working[parentId] = applyDefiniteAxesBeforePipeline(parent, computed);

  logNestedLayoutDebug({
    nodeId: parentId,
    parentId: parent.parentId,
    depth,
    node: working[parentId]!,
    metrics: cache.get(parentId),
    dirtyReason,
    phase: "after-measure",
  });

  let result = runAutoLayoutPipeline({
    parentId,
    nodes: working,
    childOrder,
    nestedSizes,
  });

  working = applyChildLayoutPatchesOnly(working, result);

  const kids = flowChildIds(parentId, working, childOrder);
  let allChildren = { ...result.children };

  for (const cid of kids) {
    const child = working[cid];
    if (!child || !isAutoLayoutContainer(child)) continue;

    const patch = result.children[cid];
    const assignedW = patch?.width ?? child.width;
    const assignedH = patch?.height ?? child.height;

    working[cid] = {
      ...child,
      width: assignedW,
      height: assignedH,
      computedWidth: assignedW,
      computedHeight: assignedH,
    };

    const childAvailable = {
      width: Math.max(0, assignedW - (child.paddingLeft ?? 0) - (child.paddingRight ?? 0)),
      height: Math.max(0, assignedH - (child.paddingTop ?? 0) - (child.paddingBottom ?? 0)),
    };

    const nested = layoutAutoLayoutRecursive(
      cid,
      working,
      childOrder,
      depth + 1,
      childAvailable,
      "nested-top-down",
    );

    working = applyLayoutResult(working, cid, nested);
    allChildren = mergeChildPatches(allChildren, nested.children);

    logNestedLayoutDebug({
      nodeId: cid,
      parentId,
      depth: depth + 1,
      node: working[cid]!,
      metrics: cache.get(cid),
      dirtyReason: "nested-top-down",
      phase: "after-nested-layout",
    });
  }

  if (parentPrimaryAxisHug(parent) || parentCounterAxisHug(parent)) {
    working = syncWorkingFromChildren(working, allChildren);
    measureBottomUp(parentId, working, childOrder, cache, nestedSizes, depth);
    const refresh = runAutoLayoutPipeline({
      parentId,
      nodes: working,
      childOrder,
      nestedSizes,
    });
    result = {
      children: mergeChildPatches(allChildren, refresh.children),
      parent: refresh.parent,
    };
    allChildren = result.children;
  } else {
    result = { children: allChildren, parent: result.parent };
  }

  for (const cid of layoutableChildIds(parentId, working, childOrder)) {
    const abs = working[cid];
    if (abs && !isFlowChild(abs) && !result.children[cid]) {
      result.children[cid] = {
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

  logNestedLayoutDebug({
    nodeId: parentId,
    parentId: parent.parentId,
    depth,
    node: working[parentId]!,
    metrics: cache.get(parentId),
    dirtyReason,
    phase: "complete",
  });

  return result;
}

/** Apply layout patches for a full subtree (flat children map includes descendants). */
export function applyLayoutSubtree(
  nodes: Record<string, LayoutEngineNode>,
  rootId: string,
  result: LayoutAutoNodeResult,
): Record<string, LayoutEngineNode> {
  let next = applyLayoutResult(nodes, rootId, result);
  for (const [cid, patch] of Object.entries(result.children)) {
    if (cid === rootId) continue;
    const cn = next[cid];
    if (!cn || cn.locked) continue;
    next[cid] = { ...cn, ...patch };
  }
  return next;
}
