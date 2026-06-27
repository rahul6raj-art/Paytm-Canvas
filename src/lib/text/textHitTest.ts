import type { EditorNode } from "@/stores/useEditorStore";
import { getNodeWorldInverseMatrixFromChildOrder } from "@/lib/editorGraph";
import { applyMatrixToPoint } from "@/lib/transformMath";
import { textLayoutForEditorNode } from "@/lib/text/canonicalTextLayout";
import {
  MIN_TEXT_BOX,
  normalizeTextResizeMode,
  textInnerHeight,
  textInnerWidth,
} from "@/lib/text/textNodeModel";
import { resolveTextTypo } from "@/lib/textTypography";
import { verticalContentOffsetY } from "@/lib/text/textVerticalAlign";
import type { TextLayout } from "@/lib/text/textMeasure";

/** Hit test in node-local coordinates (unrotated box). */
export function hitTestTextLocal(
  localX: number,
  localY: number,
  node: Pick<
    EditorNode,
    "width" | "height" | "content" | "textResizeMode" | "verticalAlign" | "autoResize"
  > &
    Parameters<typeof resolveTextTypo>[0],
): boolean {
  const w = Math.max(MIN_TEXT_BOX, node.width);
  const h = Math.max(MIN_TEXT_BOX, node.height);
  if (localX < 0 || localY < 0 || localX > w || localY > h) return false;

  const mode = normalizeTextResizeMode(node.textResizeMode, node.autoResize);
  const prepared = textLayoutForEditorNode(node as EditorNode);
  const layout = prepared?.layout;
  if (!layout) return localX >= 0 && localX <= w && localY >= 0 && localY <= h;
  const innerH = textInnerHeight(h, mode);
  const offsetY = verticalContentOffsetY(layout.height, innerH, node.verticalAlign);
  const contentTop = offsetY;
  const contentBottom = offsetY + layout.height;
  if (localY < contentTop - 2 || localY > contentBottom + 2) {
    return localY >= 0 && localY <= h;
  }
  return true;
}

export function hitTestTextWorld(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  const n = nodes[nodeId];
  if (!n || n.type !== "text" || !n.visible) return false;
  const inv = getNodeWorldInverseMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (!inv) {
    return (
      worldX >= n.x &&
      worldX <= n.x + n.width &&
      worldY >= n.y &&
      worldY <= n.y + n.height
    );
  }
  const local = applyMatrixToPoint(inv, { x: worldX, y: worldY });
  return hitTestTextLocal(local.x, local.y, n);
}

export function getTextContentBounds(
  layout: TextLayout,
  boxWidth: number,
  boxHeight: number,
  verticalAlign?: EditorNode["verticalAlign"],
): { x: number; y: number; width: number; height: number } {
  const innerW = textInnerWidth(boxWidth);
  const innerH = textInnerHeight(boxHeight);
  const offsetY = verticalContentOffsetY(layout.height, innerH, verticalAlign);
  return {
    x: 0,
    y: offsetY,
    width: innerW,
    height: layout.height,
  };
}
