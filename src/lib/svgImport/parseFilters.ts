import type { NodeEffect } from "@/lib/nodeEffects";
import { newNodeEffectId } from "@/lib/nodeEffects";
import type { SvgElement } from "@/lib/svgImport/parseSvg";

/** Parse simple `feGaussianBlur` from a filter def (v1: layer blur only). */
export function parseFilterBlurEffect(filterEl: SvgElement): NodeEffect | null {
  for (const child of filterEl.childElements()) {
    const tag = child.tagLower;
    if (tag === "fegaussianblur") {
      const raw = child.getAttr("stdDeviation") ?? "0";
      const blur = parseFloat(raw.split(/[\s,]+/)[0] ?? "0");
      if (!Number.isFinite(blur) || blur <= 0) return null;
      return {
        id: newNodeEffectId(),
        type: "layer-blur",
        visible: true,
        blur: Math.min(64, blur * 2),
      };
    }
  }
  return null;
}
