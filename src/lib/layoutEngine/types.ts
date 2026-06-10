/**
 * Figma-style auto layout types (engine layer; independent of React/canvas).
 * App-facing fields use lowercase enums to match EditorNode conventions.
 */

export type LayoutMode = "none" | "horizontal" | "vertical";
export type LayoutSizingMode = "fixed" | "hug" | "fill";
export type LayoutPositioning = "auto" | "absolute";
export type PrimaryAxisAlign = "start" | "center" | "end" | "space-between";
export type CrossAxisAlign = "start" | "center" | "end" | "stretch";

export type Size2 = { width: number; height: number };

/** Node shape required by the layout engine (superset of LayoutNode). */
export interface LayoutEngineNode {
  id: string;
  type: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  locked: boolean;

  layoutMode?: LayoutMode;
  layoutGap?: number;
  /** When true, gap is inferred from current child positions on each layout pass. */
  layoutGapAuto?: boolean;
  layoutWrap?: boolean;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlign?: PrimaryAxisAlign;
  counterAxisAlign?: CrossAxisAlign;
  layoutSizingHorizontal?: LayoutSizingMode;
  layoutSizingVertical?: LayoutSizingMode;
  layoutPositioning?: LayoutPositioning;
  /** Flex grow weight when main-axis sizing is fill (0 = equal split with other fill children). */
  layoutGrow?: number;

  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  computedWidth?: number;
  computedHeight?: number;
  layoutDirty?: boolean;

  constraintsHorizontal?: "left" | "right" | "left-right" | "center" | "scale";
  constraintsVertical?: "top" | "bottom" | "top-bottom" | "center" | "scale";

  /** Text hug measurement */
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textResizeMode?: "auto-width" | "auto-height" | "fixed";
}

export type LayoutChildPatch = Partial<
  Pick<LayoutEngineNode, "x" | "y" | "width" | "height" | "computedWidth" | "computedHeight" | "layoutDirty">
>;

export type LayoutAutoNodeResult = {
  children: Record<string, LayoutChildPatch>;
  parent?: Partial<Pick<LayoutEngineNode, "width" | "height" | "computedWidth" | "computedHeight" | "layoutDirty">>;
};

export const LAYOUT_DEFAULTS = {
  layoutMode: "none" as LayoutMode,
  layoutGap: 0,
  layoutWrap: false,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  primaryAxisAlign: "start" as PrimaryAxisAlign,
  counterAxisAlign: "start" as CrossAxisAlign,
  layoutPositioning: "auto" as LayoutPositioning,
};

export function sizingMode(v: LayoutSizingMode | undefined): LayoutSizingMode {
  return v ?? "fixed";
}

export function isAutoLayoutContainer(n: LayoutEngineNode | undefined): boolean {
  return !!n && (n.type === "frame" || n.type === "group") && (n.layoutMode ?? "none") !== "none";
}

export function isFlowChild(n: LayoutEngineNode): boolean {
  return (n.layoutPositioning ?? "auto") !== "absolute";
}

export function clampDimension(value: number, min?: number, max?: number): number {
  let v = Math.max(1, value);
  if (min != null && Number.isFinite(min)) v = Math.max(v, min);
  if (max != null && Number.isFinite(max)) v = Math.min(v, max);
  return v;
}

/** Total gap span between `itemCount` flow children (positioning — may be negative). */
export function flowGapSpan(gap: number, itemCount: number): number {
  const gaps = Math.max(0, itemCount - 1);
  return gap * gaps;
}

/** Gap span for hug / content / fill sizing — negative gap must not shrink children or frames. */
export function flowGapForSizing(gap: number, itemCount: number): number {
  return Math.max(0, gap) * Math.max(0, itemCount - 1);
}

export function paddingBox(n: LayoutEngineNode) {
  return {
    top: n.paddingTop ?? LAYOUT_DEFAULTS.paddingTop,
    right: n.paddingRight ?? LAYOUT_DEFAULTS.paddingRight,
    bottom: n.paddingBottom ?? LAYOUT_DEFAULTS.paddingBottom,
    left: n.paddingLeft ?? LAYOUT_DEFAULTS.paddingLeft,
  };
}

/** Parent hugs along primary axis (width for H, height for V). */
export function parentPrimaryAxisHug(parent: LayoutEngineNode): boolean {
  const mode = parent.layoutMode ?? "none";
  if (mode === "none") return false;
  if (mode === "horizontal") return sizingMode(parent.layoutSizingHorizontal) === "hug";
  return sizingMode(parent.layoutSizingVertical) === "hug";
}

export function parentCounterAxisHug(parent: LayoutEngineNode): boolean {
  const mode = parent.layoutMode ?? "none";
  if (mode === "none") return false;
  if (mode === "horizontal") return sizingMode(parent.layoutSizingVertical) === "hug";
  return sizingMode(parent.layoutSizingHorizontal) === "hug";
}

/** Layout box used for child positioning — each axis hugs or stays fixed independently. */
export function resolveParentLayoutSize(
  parent: LayoutEngineNode,
  hugSize: Size2,
): Size2 {
  const mode = parent.layoutMode ?? "none";
  if (mode === "none") return { width: parent.width, height: parent.height };
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

export function childMainSizing(
  child: LayoutEngineNode,
  mode: Exclude<LayoutMode, "none">,
): LayoutSizingMode {
  return mode === "horizontal"
    ? sizingMode(child.layoutSizingHorizontal)
    : sizingMode(child.layoutSizingVertical);
}

export function childCrossSizing(
  child: LayoutEngineNode,
  mode: Exclude<LayoutMode, "none">,
): LayoutSizingMode {
  return mode === "horizontal"
    ? sizingMode(child.layoutSizingVertical)
    : sizingMode(child.layoutSizingHorizontal);
}
