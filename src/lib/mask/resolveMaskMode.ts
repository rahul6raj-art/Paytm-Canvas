import { effectiveFillType } from "@/lib/fillGradient";
import type { FigMaskType, MaskCompositorMode } from "@/lib/mask/types";
import { normalizeFigMaskType } from "@/lib/mask/types";
import type { EditorNode } from "@/stores/useEditorStore";

/** Decide whether outline clip or alpha/luminance compositing is required. */
export function resolveMaskCompositorMode(
  group: EditorNode,
  maskNode: EditorNode,
): MaskCompositorMode {
  const explicit = normalizeFigMaskType(group.figMaskType);
  if (explicit === "LUMINANCE" || explicit === "ALPHA") return explicit;
  if (needsAlphaCompositor(maskNode)) return "ALPHA";
  return "OUTLINE";
}

function needsAlphaCompositor(mask: EditorNode): boolean {
  if ((mask.opacity ?? 1) < 0.999) return true;
  if ((mask.fillOpacity ?? 1) < 0.999) return true;
  if (mask.fillEnabled === false) return true;
  const ft = effectiveFillType(mask);
  return ft === "gradient" || ft === "image" || ft === "video" || ft === "pattern";
}

export function maskCompositorUsesSvgMask(mode: FigMaskType): boolean {
  return mode === "ALPHA" || mode === "LUMINANCE";
}
