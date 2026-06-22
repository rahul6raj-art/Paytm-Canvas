import type { CSSProperties } from "react";
import type { EditorNode } from "@/stores/useEditorStore";
import { buildParentMapFromChildOrder, getNodeWorldInverseMatrixFromChildOrder } from "@/lib/editorGraph";
import { applyMatrixToPoint } from "@/lib/transformMath";
import { clampCornerRadii, cornerRadiiToCss, getNodeCornerRadii, type CornerRadii } from "@/lib/cornerRadius";

export type ClipChildrenNode = {
  type: string;
  clipChildren?: boolean;
};

export type ClipBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Shape-aware clip region in a clipping node's local space. */
export type ClipRegion = {
  nodeId: string;
  bounds: ClipBounds;
  cornerRadii: CornerRadii;
};

/** One level in the hierarchical clip stack (innermost last). */
export type ClipStackEntry = {
  nodeId: string;
  region: ClipRegion;
};

export type ClipDebugInfo = {
  nodeId: string;
  frameBounds: ClipBounds;
  clipBounds: ClipBounds;
  clipStack: ClipStackEntry[];
  unclippedContentBounds: ClipBounds | null;
};

/** Figma: frames clip by default; groups clip only when explicitly enabled. */
export function shouldClipChildren(node: ClipChildrenNode): boolean {
  if (node.type === "frame") return node.clipChildren !== false;
  if (node.type === "group") return node.clipChildren === true;
  return false;
}

/** UI / export: same semantics as canvas clipping. */
export function isClipContentEnabled(node: ClipChildrenNode): boolean {
  return shouldClipChildren(node);
}

export function isClipDebugEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem("craft-clip-debug") === "1";
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
  node: ClipChildrenNode & Pick<EditorNode, "cornerRadius" | "cornerRadii" | "width" | "height">,
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
  node: ClipChildrenNode & Pick<EditorNode, "cornerRadius" | "cornerRadii" | "width" | "height">,
): Record<string, string> {
  if (!shouldClipChildren(node)) return {};
  const round = clipRoundCss(node);
  return {
    overflow: "hidden",
    clipPath: round ? `inset(0 round ${round})` : "inset(0)",
  };
}

export function getClipBoundsForNode(
  node: ClipChildrenNode & Pick<EditorNode, "width" | "height">,
): ClipBounds {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, node.width),
    height: Math.max(1, node.height),
  };
}

export function getClipRegionForNode(
  nodeId: string,
  node: ClipChildrenNode & Pick<EditorNode, "width" | "height" | "cornerRadius" | "cornerRadii">,
): ClipRegion | null {
  if (!shouldClipChildren(node)) return null;
  return {
    nodeId,
    bounds: getClipBoundsForNode(node),
    cornerRadii: clampCornerRadii(getNodeCornerRadii(node), node.width, node.height),
  };
}

/** Intersect two axis-aligned clip bounds (for nested clip stacks / future scroll). */
export function intersectClipBounds(a: ClipBounds, b: ClipBounds): ClipBounds | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = right - x;
  const height = bottom - y;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

/** Shape-aware point test in a clipping node's local space. */
export function isLocalPointInsideClipRegion(
  localX: number,
  localY: number,
  region: ClipRegion,
): boolean {
  const { bounds, cornerRadii } = region;
  const w = bounds.width;
  const h = bounds.height;
  const x = localX - bounds.x;
  const y = localY - bounds.y;
  if (x < 0 || y < 0 || x > w || y > h) return false;

  const [tl, tr, br, bl] = cornerRadii;
  if (tl > 0 && x < tl && y < tl) {
    const dx = x - tl;
    const dy = y - tl;
    return dx * dx + dy * dy <= tl * tl;
  }
  if (tr > 0 && x > w - tr && y < tr) {
    const dx = x - (w - tr);
    const dy = y - tr;
    return dx * dx + dy * dy <= tr * tr;
  }
  if (br > 0 && x > w - br && y > h - br) {
    const dx = x - (w - br);
    const dy = y - (h - br);
    return dx * dx + dy * dy <= br * br;
  }
  if (bl > 0 && x < bl && y > h - bl) {
    const dx = x - bl;
    const dy = y - (h - bl);
    return dx * dx + dy * dy <= bl * bl;
  }
  return true;
}

/** @deprecated Use {@link isLocalPointInsideClipRegion} with a {@link ClipRegion}. */
export function isLocalPointInsideClipBounds(
  localX: number,
  localY: number,
  node: ClipChildrenNode & Pick<EditorNode, "width" | "height">,
): boolean {
  const region = getClipRegionForNode("?", node);
  if (!region) return true;
  return isLocalPointInsideClipRegion(localX, localY, region);
}

/** Build clip stack from outermost clipping ancestor → innermost (target's parent chain). */
export function buildClipStackForNode(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): ClipStackEntry[] {
  const parentOf = buildParentMapFromChildOrder(childOrder);
  const stack: ClipStackEntry[] = [];
  let cur: string | null = parentOf.get(nodeId) ?? null;
  while (cur) {
    const node = nodes[cur];
    if (node) {
      const region = getClipRegionForNode(cur, node);
      if (region) stack.unshift({ nodeId: cur, region });
    }
    cur = parentOf.get(cur) ?? null;
  }
  return stack;
}

/** Figma: clicks on visually clipped child pixels pass through (don’t select the child). */
export function isWorldPointVisibleThroughClipAncestors(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  for (const { nodeId: clipId, region } of buildClipStackForNode(nodeId, nodes, childOrder)) {
    const inv = getNodeWorldInverseMatrixFromChildOrder(clipId, nodes, childOrder);
    if (!inv) return false;
    const local = applyMatrixToPoint(inv, { x: worldX, y: worldY });
    if (!isLocalPointInsideClipRegion(local.x, local.y, region)) return false;
  }
  return true;
}

/** Tight parent-local bounds of visible children (layout geometry, not clipped). */
export function getUnclippedContentBoundsLocal(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): ClipBounds | null {
  const kids = childOrder[parentId] ?? [];
  if (kids.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of kids) {
    const c = nodes[id];
    if (!c || !c.visible || c.locked) continue;
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + c.height);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function buildClipDebugInfo(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): ClipDebugInfo | null {
  const node = nodes[nodeId];
  if (!node) return null;
  const frameBounds = getClipBoundsForNode(node);
  const clipRegion = getClipRegionForNode(nodeId, node);
  return {
    nodeId,
    frameBounds,
    clipBounds: clipRegion?.bounds ?? frameBounds,
    clipStack: buildClipStackForNode(nodeId, nodes, childOrder),
    unclippedContentBounds: getUnclippedContentBoundsLocal(nodeId, nodes, childOrder),
  };
}

export function logClipDebug(
  label: string,
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  if (!isClipDebugEnabled()) return;
  const info = buildClipDebugInfo(nodeId, nodes, childOrder);
  if (!info) return;
  console.log(`[clip debug] ${label}`, info);
}
