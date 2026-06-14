import { fillCss } from "@/lib/color";
import {
  buildBooleanRenderForGroup,
  isBooleanGroup,
  isMaskGroup,
} from "@/lib/booleanGeometry";
import {
  clipPathCssFromPathD,
  maskGroupClipId,
  maskGroupExportDefs,
} from "@/lib/mask/maskExport";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  booleanRenderFillAttr,
  booleanRenderSvgMarkup,
  booleanStrokeAttrParts,
} from "@/lib/codeExport/booleanRenderSvg";

export type CompositeExportStyle = Record<string, string | number>;

export { clipPathCssFromPathD, maskGroupClipId };

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
 * Inline SVG matching canvas boolean rendering (Clipper2 composite path).
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

export type MaskGroupClipExport = {
  clipId: string;
  clipD: string;
  clipRule: "nonzero" | "evenodd";
  clipRef: string;
  defsMarkup: string;
  usesSvgMask?: boolean;
};

/** SVG mask/clipPath defs for mask groups (export fallback uses url ref). */
export function maskGroupClipDefsMarkup(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): MaskGroupClipExport | null {
  const exported = maskGroupExportDefs(node, nodes, childOrder);
  if (!exported) return null;
  return {
    clipId: exported.clipId,
    clipD: exported.clipD,
    clipRule: exported.clipRule,
    clipRef: exported.clipRef,
    defsMarkup: exported.defsMarkup,
    usesSvgMask: exported.usesSvgMask,
  };
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
