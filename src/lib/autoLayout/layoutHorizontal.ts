import { layoutChildren, type LayoutChildrenInput } from "@/lib/layoutEngine/layoutChildren";

export type LayoutHorizontalInput = Omit<LayoutChildrenInput, "mode">;

/** Position children in a horizontal auto-layout flow. */
export function layoutHorizontal(input: LayoutHorizontalInput) {
  return layoutChildren({ ...input, mode: "horizontal" });
}
