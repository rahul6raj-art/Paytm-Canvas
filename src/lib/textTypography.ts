import type { CSSProperties } from "react";
import { CANVAS_VIEWPORT_SELECTOR } from "@/lib/viewportZoom";
import { getNodeTransformedWorldCorners } from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";

export { TEXT_FONT_FAMILIES } from "@/lib/fonts/fontCatalog";

export const TEXT_FONT_WEIGHTS = [
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semibold", value: 600 },
  { label: "Bold", value: 700 },
] as const;

export const TEXT_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 32, 48, 64, 96] as const;

export type ResolvedTextTypo = {
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
};

export function resolveTextTypo(node: Pick<
  EditorNode,
  "textColor" | "fill" | "fontFamily" | "fontSize" | "fontWeight" | "lineHeight" | "letterSpacing"
>): ResolvedTextTypo {
  return {
    color: node.textColor ?? node.fill ?? "#111111",
    fontFamily: node.fontFamily ?? "var(--font-inter), Inter, system-ui, sans-serif",
    fontSize: node.fontSize ?? 13,
    fontWeight: node.fontWeight ?? 500,
    lineHeight: node.lineHeight ?? 1.25,
    letterSpacing: node.letterSpacing ?? 0,
  };
}

const CRISP_TEXT: CSSProperties = {
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
  textRendering: "geometricPrecision",
};

export function textTypoStyle(typo: ResolvedTextTypo): CSSProperties {
  return {
    ...CRISP_TEXT,
    color: typo.color,
    fontFamily: typo.fontFamily,
    fontSize: typo.fontSize,
    fontWeight: typo.fontWeight,
    lineHeight: typo.lineHeight,
    letterSpacing: typo.letterSpacing !== 0 ? `${typo.letterSpacing}px` : undefined,
  };
}

/** Screen-pixel styles for the in-place text editor (outside canvas zoom). */
export function textEditScreenStyle(typo: ResolvedTextTypo, zoom: number): CSSProperties {
  const z = Math.max(zoom, 0.0001);
  return {
    ...CRISP_TEXT,
    color: typo.color,
    fontFamily: typo.fontFamily,
    fontSize: typo.fontSize * z,
    fontWeight: typo.fontWeight,
    lineHeight: typo.lineHeight,
    letterSpacing: typo.letterSpacing !== 0 ? `${typo.letterSpacing * z}px` : undefined,
  };
}

export type TextNodeScreenRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function worldToClient(
  worldX: number,
  worldY: number,
  viewportRect: DOMRect,
  pan: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  const z = Math.max(zoom, 0.0001);
  return {
    x: viewportRect.left + pan.x + worldX * z,
    y: viewportRect.top + pan.y + worldY * z,
  };
}

export function getTextNodeScreenRect(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  pan: { x: number; y: number },
  zoom: number,
): TextNodeScreenRect | null {
  const node = nodes[nodeId];
  if (!node || node.type !== "text") return null;

  const viewport = document.querySelector<HTMLElement>(CANVAS_VIEWPORT_SELECTOR);
  if (!viewport) return null;
  const viewportRect = viewport.getBoundingClientRect();
  const z = Math.max(zoom, 0.0001);

  const anchor = document.querySelector<HTMLElement>(`[data-text-anchor="${nodeId}"]`);
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
  }

  const corners = getNodeTransformedWorldCorners(nodeId, nodes);
  if (!corners) return null;

  const screen = corners.map((c) => worldToClient(c.x, c.y, viewportRect, pan, z));
  const xs = screen.map((p) => p.x);
  const ys = screen.map((p) => p.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    left,
    top,
    width: Math.max(1, Math.max(...xs) - left),
    height: Math.max(1, Math.max(...ys) - top),
  };
}

export { fontFamilyLabel } from "@/lib/fonts/fontCatalog";
