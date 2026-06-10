import type { EditorNode } from "@/stores/useEditorStore";

/** Frames and groups clip only when “Clip content” is explicitly enabled. */
export function shouldClipChildren(
  node: Pick<EditorNode, "type" | "clipChildren">,
): boolean {
  if (node.type === "frame" || node.type === "group") return node.clipChildren === true;
  return false;
}

/** UI / export: clip content is opt-in when unset. */
export function isClipContentEnabled(
  node: Pick<EditorNode, "type" | "clipChildren">,
): boolean {
  return shouldClipChildren(node);
}
