import type { CSSProperties } from "react";
import type { EditorNode } from "@/stores/useEditorStore";
import { buildParentMapFromChildOrder, getNodeWorldInverseMatrixFromChildOrder } from "@/lib/editorGraph";
import { applyMatrixToPoint } from "@/lib/transformMath";
import { clampCornerRadii, cornerRadiiToCss, getNodeCornerRadii } from "@/lib/cornerRadius";

/** Figma: frames clip by default; groups clip only when explicitly enabled. */
export function shouldClipChildren(
  node: Pick<EditorNode, "type" | "clipChildren">,
): boolean {
  if (node.type === "frame") return node.clipChildren !== false;
  if (node.type === "group") return node.clipChildren === true;
  return false;
}

/** UI / export: same semantics as canvas clipping. */
export function isClipContentEnabled(
  node: Pick<EditorNode, "type" | "clipChildren">,
): boolean {
  return shouldClipChildren(node);
}

function clipRoundCss(
  node: Pick<EditorNode, "cornerRadius" | "cornerRadii" | "width" | "height">,
  borderRadiusCss?: string | number,
): string | undefined {
  if (borderRadiusCss != null && borderRadiusCss !== "") {
    return typeof borderRadiusCss === "number" ? `${borderRadiusCss}px` : borderRadiusCss;
  }
  const radii = clampCornerRadii(getNodeCornerRadii(node), node.width, node.height);
  const css = cornerRadiiToCss(radii);
  if (css === 0 || css === "0px") return undefined;
  return typeof css === "number" ? `${css}px` : css;
}

/** Canvas child layer clip — overflow + inset clip-path (works with rounded frames). */
export function clipContentContainerStyle(
  node: Pick<EditorNode, "type" | "clipChildren" | "cornerRadius" | "cornerRadii" | "width" | "height">,
  borderRadiusCss?: string | number,
): CSSProperties {
  const round = clipRoundCss(node, borderRadiusCss);
  return {
    overflow: "hidden",
    borderRadius: round,
    clipPath: round ? `inset(0 round ${round})` : "inset(0)",
    isolation: "isolate",
  };
}

/** CSS / inspect export — inner clip on frame shell (Figma “Clip content”). */
export function clipExportCssProperties(
  node: Pick<EditorNode, "type" | "clipChildren" | "cornerRadius" | "cornerRadii" | "width" | "height">,
): Record<string, string> {
  if (!shouldClipChildren(node)) return {};
  const round = clipRoundCss(node);
  return {
    overflow: "hidden",
    clipPath: round ? `inset(0 round ${round})` : "inset(0)",
  };
}

/** Parent-local point inside a clipped container’s bounds (rectangular; ignores corner radius). */
export function isLocalPointInsideClipBounds(
  localX: number,
  localY: number,
  node: Pick<EditorNode, "type" | "clipChildren" | "width" | "height">,
): boolean {
  if (!shouldClipChildren(node)) return true;
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  return localX >= 0 && localY >= 0 && localX <= w && localY <= h;
}

/** Figma: clicks on visually clipped child pixels pass through (don’t select the child). */
export function isWorldPointVisibleThroughClipAncestors(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  const parentOf = buildParentMapFromChildOrder(childOrder);
  let cur: string | null = nodeId;
  while (cur) {
    const parentId = parentOf.get(cur) ?? null;
    if (!parentId) break;
    const parent = nodes[parentId];
    if (parent && shouldClipChildren(parent)) {
      const inv = getNodeWorldInverseMatrixFromChildOrder(parentId, nodes, childOrder);
      if (!inv) return false;
      const local = applyMatrixToPoint(inv, { x: worldX, y: worldY });
      if (!isLocalPointInsideClipBounds(local.x, local.y, parent)) return false;
    }
    cur = parentId;
  }
  return true;
}
