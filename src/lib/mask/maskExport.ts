import { buildMaskClipPathForGroup } from "@/lib/mask/buildExactMaskPath";
import { isMaskGroup } from "@/lib/mask/isMaskGroup";
import { resolveMaskCompositorMode, maskCompositorUsesSvgMask } from "@/lib/mask/resolveMaskMode";
import { renderAlphaMaskSvg } from "@/lib/mask/renderAlphaMask";
import { renderMaskLayerSvg } from "@/lib/mask/renderMaskLayer";
import { renderOutlineMaskSvg } from "@/lib/mask/renderOutlineMask";
import { svgSafeId } from "@/lib/svgMarkupCore";
import type { EditorNode } from "@/stores/useEditorStore";

export type MaskExportResult = {
  clipId: string;
  clipD: string;
  clipRule: "nonzero" | "evenodd";
  clipRef: string;
  defsMarkup: string;
  usesSvgMask: boolean;
};

export function maskGroupClipId(groupId: string): string {
  return `pc-mask-export-clip-${svgSafeId(groupId)}`;
}

/**
 * Export mask group as SVG defs (clipPath for OUTLINE, mask for ALPHA/LUMINANCE).
 * CSS clip-path url() is export fallback only — not the canvas compositor.
 */
export function maskGroupExportDefs(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  renderMaskShape?: (maskId: string) => string,
): MaskExportResult | null {
  if (!isMaskGroup(node) || !node.maskId) return null;
  const maskNode = nodes[node.maskId];
  if (!maskNode) return null;

  const mode = resolveMaskCompositorMode(node, maskNode);
  const clipId = maskGroupClipId(node.id);

  if (maskCompositorUsesSvgMask(mode)) {
    const maskLayer = renderMaskShape
      ? renderMaskShape(node.maskId)
      : "";
    const alpha = renderAlphaMaskSvg({
      groupId: node.id,
      maskId: node.maskId,
      maskNode,
      mode,
      maskLayerMarkup: maskLayer,
      contentMarkup: "",
      idPrefix: "pc-mask-export",
    });
    const escaped = alpha.defsMarkup;
    return {
      clipId: alpha.maskId,
      clipD: "",
      clipRule: "nonzero",
      clipRef: `url(#${alpha.maskId})`,
      defsMarkup:
        `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true"><defs>${escaped}</defs></svg>`,
      usesSvgMask: true,
    };
  }

  const clip = buildMaskClipPathForGroup(node.id, node.maskId, nodes, childOrder);
  if (!clip) return null;
  const escaped = clip.clipD.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const ruleAttr =
    clip.clipRule === "evenodd" ? ` clip-rule="evenodd"` : ` clip-rule="nonzero"`;
  const defsMarkup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true">` +
    `<defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">` +
    `<path d="${escaped}"${ruleAttr}/></clipPath></defs></svg>`;

  return {
    clipId,
    clipD: clip.clipD,
    clipRule: clip.clipRule,
    clipRef: `url(#${clipId})`,
    defsMarkup,
    usesSvgMask: false,
  };
}

/** Lightweight CSS clip-path fallback for HTML export wrappers only. */
export function clipPathCssFromPathD(
  d: string,
  fillRule: "nonzero" | "evenodd" = "nonzero",
): string {
  const escaped = d.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return fillRule === "evenodd"
    ? `path(evenodd, '${escaped}')`
    : `path('${escaped}')`;
}
