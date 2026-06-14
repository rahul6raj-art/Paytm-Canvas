import { normalizeHex } from "@/lib/color";
import { DEFAULT_FRAME_FILL, DEFAULT_SHAPE_FILL } from "@/lib/shapes/shapeModel";
import type { EditorNode } from "@/stores/useEditorStore";

/** Layers whose solid fill / text color can be edited from the multi-select toolbar. */
export function nodeSupportsFillColor(
  node: Pick<EditorNode, "type" | "isBooleanGroup"> | null | undefined,
): boolean {
  if (!node) return false;
  return (
    node.type === "rectangle" ||
    node.type === "frame" ||
    node.type === "ellipse" ||
    node.type === "polygon" ||
    node.type === "path" ||
    node.type === "text" ||
    Boolean(node.isBooleanGroup)
  );
}

export function nodeFillDisplayHex(node: EditorNode): string {
  if (node.type === "text") {
    return normalizeHex(node.textColor ?? node.fill ?? "#000000") ?? "#000000";
  }
  const fallback = node.type === "frame" ? DEFAULT_FRAME_FILL : DEFAULT_SHAPE_FILL;
  return normalizeHex(node.fill ?? fallback) ?? fallback;
}
