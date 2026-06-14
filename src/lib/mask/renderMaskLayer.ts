import { fillCss } from "@/lib/color";
import { effectiveFillType } from "@/lib/fillGradient";
import type { FigMaskType } from "@/lib/mask/types";
import { buildMaskClipPathForGroup } from "@/lib/mask/buildExactMaskPath";
import type { EditorNode } from "@/stores/useEditorStore";

export type MaskLayerRenderOpts = {
  /** When true, render for visible editing overlay (not mask definition). */
  editing?: boolean;
  mode?: FigMaskType;
};

/**
 * SVG markup for the mask shape layer.
 * Inside `<mask>` definitions uses white fill for alpha; outline uses exact path.
 */
export function renderMaskLayerSvg(
  maskNode: EditorNode,
  groupId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  renderShape: (nodeId: string) => string,
  opts?: MaskLayerRenderOpts,
): string {
  const mode = opts?.mode ?? "OUTLINE";
  const inner = renderShape(maskNode.id);
  if (!inner) return "";

  if (opts?.editing) {
    const op = (maskNode.opacity ?? 1) * 0.35;
    return `<g opacity="${op}">${inner}</g>`;
  }

  if (mode === "ALPHA" || mode === "LUMINANCE") {
    const fill = fillCss(maskNode.fill, maskNode.fillOpacity, maskNode.fillEnabled);
    const useWhite = mode === "LUMINANCE" || effectiveFillType(maskNode) === "solid";
    if (useWhite) {
      return inner.replace(/fill="[^"]*"/g, 'fill="white"').replace(/fill='[^']*'/g, "fill='white'");
    }
    return inner;
  }

  const clip = buildMaskClipPathForGroup(groupId, maskNode.id, nodes, childOrder);
  if (clip) {
    const rule = clip.clipRule === "evenodd" ? ' fill-rule="evenodd"' : ' fill-rule="nonzero"';
    return `<path d="${clip.clipD}" fill="white"${rule}/>`;
  }

  return inner;
}
