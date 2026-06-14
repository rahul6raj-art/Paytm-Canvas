import { layerPanelChildIds } from "@/lib/editorGraph";
import {
  isMaskGroup,
  maskGroupContentChildIds,
  shouldShowMaskLayer,
} from "@/lib/mask/isMaskGroup";
import { logMaskDiagnostic } from "@/lib/mask/maskDiagnostics";
import { resolveMaskCompositorMode, maskCompositorUsesSvgMask } from "@/lib/mask/resolveMaskMode";
import { renderAlphaMaskSvg } from "@/lib/mask/renderAlphaMask";
import { renderMaskLayerSvg } from "@/lib/mask/renderMaskLayer";
import { renderOutlineMaskSvg } from "@/lib/mask/renderOutlineMask";
import { composeSvgTransform } from "@/lib/transformMath";
import { wrapSvgNodeFilter } from "@/lib/svgMarkupCore";
import type { EditorNode } from "@/stores/useEditorStore";

export type MaskGroupRenderCtx = {
  groupId: string;
  node: EditorNode;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  objectEditModeNodeId?: string | null;
  selectedIds?: string[];
  registerDef: (markup: string) => void;
  renderChild: (childId: string) => string;
  filterRef?: string;
};

export type MaskGroupRenderResult = {
  bodyMarkup: string;
  mode: ReturnType<typeof resolveMaskCompositorMode>;
};

/**
 * Figma-like mask group compositor for SVG scene rendering.
 * Outline → clipPath; Alpha/Luminance → SVG mask (with canvas fallback available).
 */
export function renderMaskGroupSvg(ctx: MaskGroupRenderCtx): MaskGroupRenderResult | null {
  const { groupId, node, nodes, childOrder } = ctx;
  if (!isMaskGroup(node) || !node.maskId) return null;

  const maskId = node.maskId;
  const maskNode = nodes[maskId];
  if (!maskNode?.visible) return null;

  const childIds = layerPanelChildIds(groupId, nodes, childOrder);
  const contentIds = maskGroupContentChildIds(groupId, childIds, nodes);

  let contentMarkup = "";
  for (const cid of contentIds) {
    const c = nodes[cid];
    if (!c?.visible || c.locked) continue;
    const inner = ctx.renderChild(cid);
    if (inner) {
      const blend = "";
      contentMarkup += `<g transform="${composeSvgTransform(c)}"${blend}>${inner}</g>`;
    }
  }

  const mode = resolveMaskCompositorMode(node, maskNode);
  logMaskDiagnostic("render", { groupId, maskId, mode, contentCount: contentIds.length });

  if (maskCompositorUsesSvgMask(mode)) {
    const maskLayer = renderMaskLayerSvg(
      maskNode,
      groupId,
      nodes,
      childOrder,
      ctx.renderChild,
      { mode },
    );
    const alpha = renderAlphaMaskSvg({
      groupId,
      maskId,
      maskNode,
      mode,
      maskLayerMarkup: maskLayer,
      contentMarkup,
    });
    ctx.registerDef(alpha.defsMarkup);
    let body = wrapSvgNodeFilter(alpha.bodyMarkup, ctx.filterRef);
    if (
      shouldShowMaskLayer(node, {
        objectEditModeNodeId: ctx.objectEditModeNodeId,
        selectedIds: ctx.selectedIds,
      })
    ) {
      const editLayer = renderMaskLayerSvg(
        maskNode,
        groupId,
        nodes,
        childOrder,
        ctx.renderChild,
        { editing: true },
      );
      body += `<g transform="${composeSvgTransform(maskNode)}" pointer-events="none">${editLayer}</g>`;
    }
    return { bodyMarkup: body, mode };
  }

  const outline = renderOutlineMaskSvg({
    groupId,
    maskId,
    nodes,
    childOrder,
    contentMarkup,
  });
  if (!outline) return null;

  ctx.registerDef(outline.defsMarkup);
  let body = wrapSvgNodeFilter(outline.bodyMarkup, ctx.filterRef);
  if (
    shouldShowMaskLayer(node, {
      objectEditModeNodeId: ctx.objectEditModeNodeId,
      selectedIds: ctx.selectedIds,
    })
  ) {
    const editLayer = renderMaskLayerSvg(
      maskNode,
      groupId,
      nodes,
      childOrder,
      ctx.renderChild,
      { editing: true },
    );
    body += `<g transform="${composeSvgTransform(maskNode)}" data-mask-shape="1">${editLayer}</g>`;
  }
  return { bodyMarkup: body, mode: "OUTLINE" };
}
