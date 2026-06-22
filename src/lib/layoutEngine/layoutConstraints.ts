/**
 * Figma-style sizing constraints and circular-dependency guards.
 */

import {
  childMainSizing,
  clampDimension,
  parentCounterAxisHug,
  parentPrimaryAxisHug,
  type LayoutEngineNode,
  type LayoutMode,
  type LayoutSizingMode,
} from "./types";

/** Parent has a definite main-axis size (fixed on primary axis — fill is valid). */
export function parentMainAxisDefinite(
  parent: LayoutEngineNode,
  mode: Exclude<LayoutMode, "none">,
): boolean {
  return !parentPrimaryAxisHug(parent);
}

/** Fill on main axis is only valid when the parent primary axis is not Hug. */
export function canFillOnMainAxis(
  parent: LayoutEngineNode,
  mode: Exclude<LayoutMode, "none">,
): boolean {
  return parentMainAxisDefinite(parent, mode);
}

/** Fill on cross axis requires parent counter axis to be definite (not hug). */
export function canFillOnCrossAxis(
  parent: LayoutEngineNode,
  _mode: Exclude<LayoutMode, "none">,
): boolean {
  return !parentCounterAxisHug(parent);
}

export function canFillOnAxis(
  parent: LayoutEngineNode,
  axis: "horizontal" | "vertical",
): boolean {
  const mode = parent.layoutMode ?? "none";
  if (mode === "none") return false;
  if (mode === "horizontal") {
    return axis === "horizontal"
      ? canFillOnMainAxis(parent, mode)
      : canFillOnCrossAxis(parent, mode);
  }
  return axis === "vertical"
    ? canFillOnMainAxis(parent, mode)
    : canFillOnCrossAxis(parent, mode);
}

/**
 * Case 3: Hug parent + Fill child on main axis → treat fill as fixed/intrinsic minimum.
 */
export function fillMainMeasureWhenParentHugs(
  child: LayoutEngineNode,
  parentMode: Exclude<LayoutMode, "none">,
): number {
  return parentMode === "horizontal"
    ? clampDimension(child.width, child.minWidth, child.maxWidth)
    : clampDimension(child.height, child.minHeight, child.maxHeight);
}

export function clampLayoutWidth(node: LayoutEngineNode, width: number): number {
  return clampDimension(width, node.minWidth, node.maxWidth);
}

export function clampLayoutHeight(node: LayoutEngineNode, height: number): number {
  return clampDimension(height, node.minHeight, node.maxHeight);
}

export function clampLayoutSize(
  node: LayoutEngineNode,
  width: number,
  height: number,
): { width: number; height: number } {
  return {
    width: clampLayoutWidth(node, width),
    height: clampLayoutHeight(node, height),
  };
}

export function clampMainAxisSize(
  node: LayoutEngineNode,
  mode: Exclude<LayoutMode, "none">,
  main: number,
): number {
  if (mode === "horizontal") return clampLayoutWidth(node, main);
  return clampLayoutHeight(node, main);
}

export function clampCrossAxisSize(
  node: LayoutEngineNode,
  mode: Exclude<LayoutMode, "none">,
  cross: number,
): number {
  if (mode === "horizontal") return clampLayoutHeight(node, cross);
  return clampLayoutWidth(node, cross);
}

export function effectiveMainSizingMode(
  child: LayoutEngineNode,
  parent: LayoutEngineNode,
  mode: Exclude<LayoutMode, "none">,
): LayoutSizingMode {
  const main = childMainSizing(child, mode);
  if (main === "fill" && !canFillOnMainAxis(parent, mode)) {
    return "fixed";
  }
  return main;
}
