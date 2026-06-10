import type { CrossAxisAlign, LayoutMode, LayoutSizingMode, PrimaryAxisAlign } from "@/lib/layoutEngine/types";

export type LayoutDirectionOption = {
  mode: LayoutMode;
  label: string;
};

export const LAYOUT_DIRECTION_OPTIONS: LayoutDirectionOption[] = [
  { mode: "none", label: "Off" },
  { mode: "horizontal", label: "H" },
  { mode: "vertical", label: "V" },
];

export type AlignOption<T extends string> = { value: T; title: string };

export const HORIZONTAL_PRIMARY_ALIGN: AlignOption<PrimaryAxisAlign>[] = [
  { value: "start", title: "Start" },
  { value: "center", title: "Center" },
  { value: "end", title: "End" },
  { value: "space-between", title: "Space between" },
];

export const VERTICAL_PRIMARY_ALIGN: AlignOption<PrimaryAxisAlign>[] = [
  { value: "start", title: "Start" },
  { value: "center", title: "Center" },
  { value: "end", title: "End" },
  { value: "space-between", title: "Space between" },
];

export const HORIZONTAL_COUNTER_ALIGN: AlignOption<CrossAxisAlign>[] = [
  { value: "start", title: "Start" },
  { value: "center", title: "Center" },
  { value: "end", title: "End" },
  { value: "stretch", title: "Stretch" },
];

export const VERTICAL_COUNTER_ALIGN: AlignOption<CrossAxisAlign>[] = [
  { value: "start", title: "Start" },
  { value: "center", title: "Center" },
  { value: "end", title: "End" },
  { value: "stretch", title: "Stretch" },
];

export const SIZING_OPTIONS: { value: LayoutSizingMode; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "hug", label: "Hug" },
  { value: "fill", label: "Fill" },
];

export const PADDING_SIDES = ["top", "right", "bottom", "left"] as const;
export type InspectorPaddingSide = (typeof PADDING_SIDES)[number];

export function primaryAlignOptions(
  mode: Exclude<LayoutMode, "none">,
): AlignOption<PrimaryAxisAlign>[] {
  return mode === "horizontal" ? HORIZONTAL_PRIMARY_ALIGN : VERTICAL_PRIMARY_ALIGN;
}

export function counterAlignOptions(
  mode: Exclude<LayoutMode, "none">,
): AlignOption<CrossAxisAlign>[] {
  return mode === "horizontal" ? HORIZONTAL_COUNTER_ALIGN : VERTICAL_COUNTER_ALIGN;
}
