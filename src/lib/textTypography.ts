import type { CSSProperties } from "react";
import { resolveSolidFillCss } from "@/lib/gradient/cssPaint";
import { CANVAS_FOREGROUND_DARK, defaultCanvasForegroundColor } from "@/lib/canvasForeground";
import { textNodeAsFillPaint } from "@/lib/text/textFillPaint";
import { CANVAS_VIEWPORT_SELECTOR } from "@/lib/viewportZoom";
import { getNodeTransformedWorldCorners } from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  effectiveLineHeightMultiplier,
  lineHeightUnitFromNode,
  resolveLineHeightPxFromNode,
} from "@/lib/text/lineHeight";
import type { LineHeightUnit } from "@/lib/text/lineHeight";
import {
  resolveLetterSpacingPxFromNode,
} from "@/lib/text/letterSpacing";

export { TEXT_FONT_FAMILIES } from "@/lib/fonts/fontCatalog";

export const TEXT_FONT_WEIGHTS = [
  { label: "Thin", value: 100 },
  { label: "Extra Light", value: 200 },
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semibold", value: 600 },
  { label: "Bold", value: 700 },
  { label: "Extra Bold", value: 800 },
  { label: "Black", value: 900 },
] as const;

export const TEXT_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 32, 48, 64, 96] as const;

export const DEFAULT_TEXT_FONT_FAMILY =
  "var(--font-inter), Inter, system-ui, sans-serif";
export const DEFAULT_TEXT_FONT_SIZE = 14;
export const DEFAULT_TEXT_COLOR = CANVAS_FOREGROUND_DARK;

export type ResolvedTextTypo = {
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  /** Unitless multiplier (lineHeightPx / fontSize) for CSS fallback paths. */
  lineHeight: number;
  lineHeightUnit: LineHeightUnit;
  /** Resolved px line height (auto uses rounded fontSize × 1.2). */
  lineHeightPx: number;
  letterSpacing: number;
};

export function resolveTextTypo(node: Pick<
  EditorNode,
  | "textColor"
  | "fill"
  | "fillOpacity"
  | "fillEnabled"
  | "fillType"
  | "fillGradient"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "lineHeight"
  | "lineHeightUnit"
  | "letterSpacing"
  | "letterSpacingUnit"
>): ResolvedTextTypo {
  const paint = textNodeAsFillPaint(node);
  const color =
    node.textColor ||
    resolveSolidFillCss(paint) ||
    node.fill ||
    defaultCanvasForegroundColor();
  const lineHeightPx = resolveLineHeightPxFromNode(node);
  const fontSize = node.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
  return {
    color,
    fontFamily: node.fontFamily ?? DEFAULT_TEXT_FONT_FAMILY,
    fontSize,
    fontWeight: node.fontWeight ?? 500,
    lineHeight: effectiveLineHeightMultiplier(node),
    lineHeightUnit: lineHeightUnitFromNode(node),
    lineHeightPx,
    letterSpacing: resolveLetterSpacingPxFromNode(node),
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
    lineHeight:
      typo.lineHeightUnit === "auto"
        ? "normal"
        : typo.lineHeightUnit === "px"
          ? `${typo.lineHeightPx}px`
          : typo.lineHeight,
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
    lineHeight:
      typo.lineHeightUnit === "auto"
        ? "normal"
        : typo.lineHeightUnit === "px"
          ? `${typo.lineHeightPx}px`
          : typo.lineHeight,
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
