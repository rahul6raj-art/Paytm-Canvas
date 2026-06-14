import type {
  CrossAxisAlign,
  LayoutMode,
  LayoutSizingMode,
  PrimaryAxisAlign,
} from "@/lib/layoutEngine/types";

export type LayoutModePatch = {
  layoutMode?: LayoutMode;
  layoutSizingHorizontal?: LayoutSizingMode;
  layoutSizingVertical?: LayoutSizingMode;
  primaryAxisAlign?: PrimaryAxisAlign;
  counterAxisAlign?: CrossAxisAlign;
};

/** Figma-style flow rotation: swap H/V sizing and primary/counter alignment. */
export function expandLayoutModePatch(
  parent: {
    layoutMode?: LayoutMode;
    layoutSizingHorizontal?: LayoutSizingMode;
    layoutSizingVertical?: LayoutSizingMode;
    primaryAxisAlign?: PrimaryAxisAlign;
    counterAxisAlign?: CrossAxisAlign;
  },
  patch: LayoutModePatch,
): LayoutModePatch {
  const next = patch.layoutMode;
  if (next !== "horizontal" && next !== "vertical") return patch;

  const prev = parent.layoutMode ?? "none";
  if (prev === "none" || prev === next) return patch;

  const expanded: LayoutModePatch = { ...patch };

  const hSizing = parent.layoutSizingHorizontal;
  const vSizing = parent.layoutSizingVertical;
  if (hSizing !== undefined || vSizing !== undefined) {
    expanded.layoutSizingHorizontal = vSizing ?? hSizing;
    expanded.layoutSizingVertical = hSizing ?? vSizing;
  }

  const primary = parent.primaryAxisAlign;
  const counter = parent.counterAxisAlign;
  if (primary !== undefined || counter !== undefined) {
    expanded.primaryAxisAlign = counter ?? primary;
    expanded.counterAxisAlign = primary ?? counter;
  }

  return expanded;
}
