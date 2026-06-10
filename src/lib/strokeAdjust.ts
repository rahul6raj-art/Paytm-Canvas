import type { EditorNode } from "@/stores/useEditorStore";

export const STROKE_WIDTH_MIN = 0;
export const STROKE_WIDTH_MAX = 256;
export const DEFAULT_PENCIL_STROKE_WIDTH = 2;

export function clampStrokeWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_PENCIL_STROKE_WIDTH;
  return Math.min(STROKE_WIDTH_MAX, Math.max(STROKE_WIDTH_MIN, width));
}

/** Layers whose stroke weight can be edited from the toolbar or [ ] shortcuts. */
export function nodeSupportsStrokeWidth(
  node: Pick<EditorNode, "type" | "isBooleanGroup"> | null | undefined,
): boolean {
  if (!node) return false;
  return (
    node.type === "path" ||
    node.type === "polygon" ||
    node.type === "rectangle" ||
    node.type === "frame" ||
    node.type === "ellipse" ||
    node.type === "line" ||
    node.type === "arrow" ||
    Boolean(node.isBooleanGroup)
  );
}

/** Open path created with the freehand (pencil) tool — not pen, star, or polygon. */
export function isFreehandPathNode(
  node: Pick<EditorNode, "type" | "pathClosed" | "starPoints" | "polygonSides"> | null | undefined,
): boolean {
  if (!node || node.type !== "path") return false;
  if (node.pathClosed) return false;
  if (node.starPoints != null) return false;
  if (node.polygonSides != null) return false;
  return true;
}
