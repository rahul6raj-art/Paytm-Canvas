import { fillCss } from "@/lib/color";
import {
  buildBooleanRenderForGroup,
  buildMaskClipPathDForGroup,
  isBooleanGroup,
  isMaskGroup,
} from "@/lib/booleanGeometry";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  booleanRenderFillAttr,
  booleanRenderSvgMarkup,
  booleanStrokeAttrParts,
} from "@/lib/codeExport/booleanRenderSvg";
import { svgSafeId } from "@/lib/svgMarkupCore";

export type CompositeExportStyle = Record<string, string | number>;

export function clipPathCssFromPathD(
  d: string,
  fillRule: "nonzero" | "evenodd" = "nonzero",
): string {
  const escaped = d.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return fillRule === "evenodd"
    ? `path(evenodd, '${escaped}')`
    : `path('${escaped}')`;
}

function visibleBooleanChildIds(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  return (childOrder[nodeId] ?? []).filter((cid) => {
    const c = nodes[cid];
    return c && c.visible && !c.locked;
  });
}

/**
 * Inline SVG matching canvas boolean rendering (mask/clip per operation).
 */
export function booleanGroupExportSvgMarkup(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string {
  const kids = visibleBooleanChildIds(node.id, nodes, childOrder);
  const op = node.booleanOperation ?? "union";
  const render = buildBooleanRenderForGroup(node.id, kids, nodes, op, childOrder);
  if (!render) return "";

  const fill = fillCss(node.fill, node.fillOpacity, node.fillEnabled);
  return booleanRenderSvgMarkup(
    render,
    node.id,
    node.width,
    node.height,
    booleanRenderFillAttr(fill),
    "pc-bool-export",
    node,
  );
}

export function maskGroupClipId(groupId: string): string {
  return `pc-mask-export-clip-${svgSafeId(groupId)}`;
}

export type MaskGroupClipExport = {
  clipId: string;
  clipD: string;
  clipRef: string;
  defsMarkup: string;
};

/** SVG clipPath defs matching canvas mask groups (content clips via url(#id)). */
export function maskGroupClipDefsMarkup(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): MaskGroupClipExport | null {
  if (!isMaskGroup(node) || !node.maskId) return null;
  const clipD = buildMaskClipPathDForGroup(node.id, node.maskId, nodes, childOrder);
  if (!clipD) return null;
  const clipId = maskGroupClipId(node.id);
  const escaped = clipD.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const defsMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true"><defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><path d="${escaped}"/></clipPath></defs></svg>`;
  return { clipId, clipD, defsMarkup, clipRef: `url(#${clipId})` };
}

/** Layout-only styles for boolean export wrapper (geometry is the inline SVG). */
export function booleanGroupExportStyle(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): CompositeExportStyle {
  if (!isBooleanGroup(node)) return {};
  const kids = visibleBooleanChildIds(node.id, nodes, childOrder);
  const op = node.booleanOperation ?? "union";
  const render = buildBooleanRenderForGroup(node.id, kids, nodes, op, childOrder);
  if (!render) return {};
  return {
    position: "relative",
    overflow: "hidden",
    borderRadius: 0,
    background: "transparent",
  };
}

/** Layout for mask groups — clip is applied via SVG defs + url(#id) in exported markup. */
export function maskGroupExportStyle(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder?: Record<string, string[]>,
): CompositeExportStyle {
  if (!isMaskGroup(node) || !node.maskId) return {};
  const clip = maskGroupClipDefsMarkup(node, nodes, childOrder ?? {});
  if (!clip) return {};
  return {
    position: "relative",
    overflow: "hidden",
  };
}

/** Child layers to include in HTML/JSX trees (operands / mask shape excluded). */
export function codeExportChildIds(
  node: EditorNode,
  childOrder: Record<string, string[]>,
): string[] {
  const kids = childOrder[node.id] ?? [];
  if (isBooleanGroup(node)) return [];
  if (isMaskGroup(node) && node.maskId) {
    return kids.filter((id) => id !== node.maskId);
  }
  return kids;
}

export const PC_BOOLEAN_OP_ATTR = "data-pc-boolean-op";
export const PC_MASK_GROUP_ATTR = "data-pc-mask-group";

export function compositeGroupHtmlAttrParts(node: EditorNode): string[] {
  const parts: string[] = [];
  if (isBooleanGroup(node) && node.booleanOperation) {
    parts.push(`${PC_BOOLEAN_OP_ATTR}="${node.booleanOperation}"`);
  }
  if (isMaskGroup(node)) {
    parts.push(`${PC_MASK_GROUP_ATTR}="true"`);
  }
  return parts;
}
