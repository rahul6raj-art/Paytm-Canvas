import { layoutChildren, type LayoutChildrenInput } from "@/lib/layoutEngine/layoutChildren";

export type LayoutVerticalInput = Omit<LayoutChildrenInput, "mode">;

/** Position children in a vertical auto-layout flow. */
export function layoutVertical(input: LayoutVerticalInput) {
  return layoutChildren({ ...input, mode: "vertical" });
}
