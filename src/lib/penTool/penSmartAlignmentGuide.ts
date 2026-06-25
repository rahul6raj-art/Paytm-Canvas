/** Screen-space alignment tolerance for pen smart guides (Figma-like). */
export const PEN_SMART_GUIDE_TOLERANCE_PX = 5;

export type PenSmartAlignmentGuideAxis = "h" | "v";

export type PenSmartAlignmentGuide = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  axis: PenSmartAlignmentGuideAxis;
  anchorIndex: number;
};

export type PenSmartAlignmentGuideInput = {
  /** World-space anchors on the active path (includes the current last anchor). */
  anchors: readonly { x: number; y: number }[];
  previewPoint: { x: number; y: number } | null;
  zoom: number;
  toleranceScreenPx?: number;
};

export function penSmartGuideToleranceWorld(
  zoom: number,
  screenPx = PEN_SMART_GUIDE_TOLERANCE_PX,
): number {
  return screenPx / zoom;
}

function guideSegmentLength(guide: PenSmartAlignmentGuide): number {
  return Math.hypot(guide.to.x - guide.from.x, guide.to.y - guide.from.y);
}

/** Figma-style smart alignment helper from a prior anchor to the preview point. */
export function resolvePenSmartAlignmentGuide(
  input: PenSmartAlignmentGuideInput,
): PenSmartAlignmentGuide | null {
  const { anchors, previewPoint, zoom } = input;
  if (!previewPoint || anchors.length < 2) return null;

  const tolerance = penSmartGuideToleranceWorld(zoom, input.toleranceScreenPx);
  const priorAnchors = anchors.slice(0, -1);

  let best: { guide: PenSmartAlignmentGuide; delta: number } | null = null;

  for (let i = 0; i < priorAnchors.length; i++) {
    const anchor = priorAnchors[i]!;
    const dy = Math.abs(anchor.y - previewPoint.y);
    const dx = Math.abs(anchor.x - previewPoint.x);

    const candidates: Array<{
      axis: PenSmartAlignmentGuideAxis;
      delta: number;
      to: { x: number; y: number };
    }> = [];

    if (dy <= tolerance) {
      candidates.push({
        axis: "h",
        delta: dy,
        to: { x: previewPoint.x, y: anchor.y },
      });
    }
    if (dx <= tolerance) {
      candidates.push({
        axis: "v",
        delta: dx,
        to: { x: anchor.x, y: previewPoint.y },
      });
    }

    for (const candidate of candidates) {
      const guide: PenSmartAlignmentGuide = {
        from: { x: anchor.x, y: anchor.y },
        to: { ...candidate.to },
        axis: candidate.axis,
        anchorIndex: i,
      };
      if (guideSegmentLength(guide) < 1e-6) continue;

      if (
        !best ||
        candidate.delta < best.delta ||
        (candidate.delta === best.delta && guideSegmentLength(guide) > guideSegmentLength(best.guide))
      ) {
        best = { guide, delta: candidate.delta };
      }
    }
  }

  return best?.guide ?? null;
}
