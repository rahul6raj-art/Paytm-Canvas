import type { LayoutSizingMode } from "@/lib/layoutEngine/types";

export type FillDividerDragState = {
  startLeftMain: number;
  startRightMain: number;
  startLeftGrow: number;
  startRightGrow: number;
  leftMainSizing: LayoutSizingMode;
  rightMainSizing: LayoutSizingMode;
};

export type FillDividerDragPatch = {
  leftGrow?: number;
  rightGrow?: number;
  leftWidth?: number;
  leftHeight?: number;
  rightWidth?: number;
  rightHeight?: number;
};

const MIN_MAIN = 1;

/**
 * Compute layout patches when dragging the divider between two adjacent children.
 * Fill+fill: redistribute grow weights from pixel sizes.
 * Fill+fixed: resize the fixed child on the main axis.
 */
export function computeFillDividerDragPatch(
  delta: number,
  mode: "horizontal" | "vertical",
  state: FillDividerDragState,
): FillDividerDragPatch {
  const newLeft = Math.max(MIN_MAIN, state.startLeftMain + delta);
  const newRight = Math.max(MIN_MAIN, state.startRightMain - delta);

  const patch: FillDividerDragPatch = {};
  const leftFill = state.leftMainSizing === "fill";
  const rightFill = state.rightMainSizing === "fill";

  if (leftFill && rightFill) {
    const totalGrow = state.startLeftGrow + state.startRightGrow;
    const sum = newLeft + newRight;
    patch.leftGrow = Math.max(0.1, (totalGrow * newLeft) / sum);
    patch.rightGrow = Math.max(0.1, (totalGrow * newRight) / sum);
    return patch;
  }

  if (leftFill && !rightFill) {
    if (mode === "horizontal") patch.rightWidth = newRight;
    else patch.rightHeight = newRight;
    return patch;
  }

  if (!leftFill && rightFill) {
    if (mode === "horizontal") patch.leftWidth = newLeft;
    else patch.leftHeight = newLeft;
    return patch;
  }

  return patch;
}
