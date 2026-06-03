import type { EditorNode } from "@/stores/useEditorStore";

/** Figma “Clip content” — frames clip by default; groups only when explicitly enabled. */
export function shouldClipChildren(
  node: Pick<EditorNode, "type" | "clipChildren">,
): boolean {
  if (node.type === "frame") return node.clipChildren !== false;
  if (node.type === "group") return node.clipChildren === true;
  return false;
}

/** UI / export: frames default to clipped when unset. */
export function isClipContentEnabled(
  node: Pick<EditorNode, "type" | "clipChildren">,
): boolean {
  return shouldClipChildren(node);
}
