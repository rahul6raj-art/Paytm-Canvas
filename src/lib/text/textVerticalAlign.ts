import type { EditorNode } from "@/stores/useEditorStore";

export type VerticalAlign = "top" | "middle" | "bottom";

export function normalizeVerticalAlign(value: unknown): VerticalAlign {
  if (value === "middle" || value === "center") return "middle";
  if (value === "bottom") return "bottom";
  return "top";
}

export function verticalContentOffsetY(
  contentHeight: number,
  innerHeight: number,
  align?: EditorNode["verticalAlign"] | VerticalAlign,
): number {
  const a = normalizeVerticalAlign(align);
  const slack = Math.max(0, innerHeight - contentHeight);
  if (a === "middle") return slack / 2;
  if (a === "bottom") return slack;
  return 0;
}
