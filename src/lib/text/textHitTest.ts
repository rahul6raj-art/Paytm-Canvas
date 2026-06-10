import type { EditorNode } from "@/stores/useEditorStore";
import { getNodeWorldInverseMatrixFromChildOrder } from "@/lib/editorGraph";
import { applyMatrixToPoint } from "@/lib/transformMath";
import { resolveTextTypo } from "@/lib/textTypography";
import { layoutDisplayText } from "@/lib/text/textAdvancedStyle";
import type { TextLayout } from "@/lib/text/textMeasure";
import {
  MIN_TEXT_BOX,
  normalizeTextResizeMode,
  textInnerHeight,
  textInnerWidth,
  wrapWidthForResizeMode,
} from "@/lib/text/textNodeModel";
import { verticalContentOffsetY } from "@/lib/text/textVerticalAlign";

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
  const typo = resolveTextTypo(node);
  const wrapWidth = wrapWidthForResizeMode(w, mode);
  const { layout } = layoutDisplayText(node.content ?? "", wrapWidth, node as EditorNode);
  const innerH = textInnerHeight(h);
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
