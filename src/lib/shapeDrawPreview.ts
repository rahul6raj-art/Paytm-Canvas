import type { EditorNode } from "@/stores/useEditorStore";
import { getRenderedWorldBounds } from "@/lib/editorGraph";
import { lineEndpointsFromNode } from "@/lib/shapes/lineGeometry";
import { isZeroAreaDraftNode } from "@/lib/shapes/shapeDraft";

export type ShapeDrawPreviewKind = "none" | "box" | "line";

export function shapeDrawPreviewKind(
  node: Pick<EditorNode, "type" | "width" | "height" | "lineX1" | "lineY1" | "lineX2" | "lineY2">,
): ShapeDrawPreviewKind {
  if (isZeroAreaDraftNode(node)) return "none";
  if (node.type === "line" || node.type === "arrow") return "line";
  return "box";
}

export function shapeDrawPreviewBoxBounds(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number; width: number; height: number } | null {
  const b = getRenderedWorldBounds(nodeId, nodes, childOrder);
  if (b.width < 0.5 && b.height < 0.5) return null;
  return b;
}

export function shapeDrawPreviewLineEndpoints(
  node: Pick<EditorNode, "type" | "lineX1" | "lineY1" | "lineX2" | "lineY2" | "x" | "y" | "width" | "height">,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeId: string,
): { x1: number; y1: number; x2: number; y2: number } | null {
  if (node.type !== "line" && node.type !== "arrow") return null;
  const local = lineEndpointsFromNode(node);
  const b = getRenderedWorldBounds(nodeId, nodes, childOrder);
  return {
    x1: b.x + local.x1,
    y1: b.y + local.y1,
    x2: b.x + local.x2,
    y2: b.y + local.y2,
  };
}
