/**
 * Figma-like auto layout — interaction layer + engine facades.
 * Core recursive engine: `@/lib/layoutEngine`
 */

export {
  getAutoLayoutInteractionHandles,
  type AutoLayoutInteractionHandles,
  type SpacingHandle,
  type PaddingHandle,
  type FillDividerHandle,
  type PaddingSide,
} from "./autoLayoutHandles";

export {
  beginSpacingDrag,
  beginPaddingDrag,
  beginFillDividerDrag,
  subscribeAutoLayoutDragPreview,
  getAutoLayoutDragPreview,
  type AutoLayoutDragPreview,
} from "./spacingPaddingDrag";

export { computeFillDividerDragPatch, type FillDividerDragPatch } from "./fillDividerDrag";

export { getAutoLayoutHoverContext, type AutoLayoutHoverContext } from "./autoLayoutHover";

export {
  measureAutoLayoutNode,
  resolveHugSize,
  resolveContentSize,
  type MeasureContext,
  type MeasuredChild,
} from "./measureAutoLayoutNode";

export {
  layoutAutoLayoutNode,
  layoutAutoLayoutNodeDeep,
  layoutableChildIds,
  flowChildIds,
  sortIdsForAutoLayoutFlow,
  applyLayoutResult,
} from "./layoutAutoLayoutNode";

export { layoutHorizontal, type LayoutHorizontalInput } from "./layoutHorizontal";
export { layoutVertical, type LayoutVerticalInput } from "./layoutVertical";
export { buildFlowLines, type FlowLine } from "./layoutWrap";
export { resolveChildSize, sizingMode, childMainSizing, childCrossSizing } from "./resolveSizing";
export { resolveFillSize, calculateFillSpace } from "./resolveFillChildren";
export { calculateHugSize } from "./calculateHugSize";
export {
  PRIMARY_AXIS_ALIGNMENTS,
  COUNTER_AXIS_ALIGNMENTS,
  type PrimaryAxisAlign,
  type CrossAxisAlign,
} from "./applyAlignment";

export {
  insertIndexInAutoLayout,
  reorderChildByPointer,
  getAutoLayoutReorderContext,
  computeAutoLayoutInsertIndicator,
  pointerInsideAutoLayoutContent,
  type AutoLayoutReorderContext,
  type AutoLayoutInsertIndicator,
} from "./reorderByPointer";

export {
  LAYOUT_DIRECTION_OPTIONS,
  HORIZONTAL_PRIMARY_ALIGN,
  VERTICAL_PRIMARY_ALIGN,
  HORIZONTAL_COUNTER_ALIGN,
  VERTICAL_COUNTER_ALIGN,
  SIZING_OPTIONS,
  primaryAlignOptions,
  counterAlignOptions,
} from "./autoLayoutInspector";

export { relayoutDirtyTree, markLayoutDirty } from "@/lib/layoutEngine/dirty";
export { layoutChildren } from "@/lib/layoutEngine/layoutChildren";

// Legacy aliases used across the editor
export { layoutAutoLayoutNode as layoutAutoNode, layoutAutoLayoutNodeDeep as layoutAutoNodeDeep } from "./layoutAutoLayoutNode";
export { measureAutoLayoutNode as measureNode } from "./measureAutoLayoutNode";
