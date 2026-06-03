import type { FigmaApiNode } from "@/integrations/figma/types";

export function figmaBoundingBox(node: FigmaApiNode): { x: number; y: number; w: number; h: number } {
  const b = node.absoluteBoundingBox;
  return {
    x: b?.x ?? 0,
    y: b?.y ?? 0,
    w: Math.max(1, b?.width ?? 1),
    h: Math.max(1, b?.height ?? 1),
  };
}

export function figmaRelativeBox(
  node: FigmaApiNode,
  parentBox: { x: number; y: number } | null,
): { x: number; y: number; w: number; h: number } {
  const b = figmaBoundingBox(node);
  if (!parentBox) return { x: 0, y: 0, w: b.w, h: b.h };
  return { x: b.x - parentBox.x, y: b.y - parentBox.y, w: b.w, h: b.h };
}
