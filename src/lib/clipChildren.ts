import type { CSSProperties } from "react";
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

/** Canvas child layer clip — overflow + inset clip-path (works with rounded frames). */
export function clipContentContainerStyle(
  node: Pick<EditorNode, "type" | "clipChildren">,
  borderRadiusCss?: string | number,
): CSSProperties {
  const round =
    borderRadiusCss == null || borderRadiusCss === ""
      ? undefined
      : typeof borderRadiusCss === "number"
        ? `${borderRadiusCss}px`
        : borderRadiusCss;
  return {
    overflow: "hidden",
    borderRadius: round,
    clipPath: round ? `inset(0 round ${round})` : "inset(0)",
    isolation: "isolate",
  };
}
