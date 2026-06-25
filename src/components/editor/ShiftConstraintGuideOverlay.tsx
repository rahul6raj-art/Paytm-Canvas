"use client";

import { worldPointToOverlay, type OverlaySpace } from "@/lib/canvasOverlaySpace";
import { CANVAS_GUIDE_LINE_SCREEN_PX, CANVAS_VISUAL } from "@/lib/canvasVisual";
import {
  resolvePenShiftConstraintGuide,
  type PenShiftConstraintGuideInput,
} from "@/lib/penTool/shiftConstraintGuide";
import type { ComponentProps } from "react";
import { useCanvasOverlaySpace } from "@/components/editor/useCanvasOverlaySpace";

export function ShiftConstraintGuideOverlay({
  previousAnchor,
  rawPointer,
  snappedPointer,
  shiftKey,
  overlay,
}: PenShiftConstraintGuideInput & { overlay: OverlaySpace }) {
  const guide = resolvePenShiftConstraintGuide({
    previousAnchor,
    rawPointer,
    snappedPointer,
    shiftKey,
  });
  if (!guide) return null;

  const from = worldPointToOverlay(guide.from.x, guide.from.y, overlay);
  const to = worldPointToOverlay(guide.to.x, guide.to.y, overlay);

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[17] h-full w-full overflow-visible"
      aria-hidden
      data-pen-shift-constraint-guide
      data-pen-shift-constraint-axis={guide.axis}
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={CANVAS_VISUAL.guide}
        strokeWidth={CANVAS_GUIDE_LINE_SCREEN_PX}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function ShiftConstraintGuideOverlayHost(
  props: Omit<ComponentProps<typeof ShiftConstraintGuideOverlay>, "overlay">,
) {
  const overlay = useCanvasOverlaySpace();
  return <ShiftConstraintGuideOverlay {...props} overlay={overlay} />;
}
