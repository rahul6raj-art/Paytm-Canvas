import { resolvePenHoverPreview } from "./placement";

export type PenShiftSnapAxis = "h" | "v" | "d";

export type PenShiftConstraintGuideInput = {
  previousAnchor: { x: number; y: number } | null;
  rawPointer: { x: number; y: number } | null;
  snappedPointer: { x: number; y: number } | null;
  shiftKey: boolean;
};

export type PenShiftConstraintGuide = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  axis: PenShiftSnapAxis;
};

/** Same snapped target used for segment preview and corner commit. */
export function resolvePenShiftSnappedPointer(
  rawPointer: { x: number; y: number } | null,
  previousAnchor: { x: number; y: number } | null,
  shiftKey: boolean,
): { x: number; y: number } | null {
  if (!rawPointer) return null;
  if (!shiftKey || !previousAnchor) return { ...rawPointer };
  return resolvePenHoverPreview(rawPointer, previousAnchor, true);
}

export function classifyPenShiftSnapAxis(
  from: { x: number; y: number },
  to: { x: number; y: number },
): PenShiftSnapAxis {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dy < 1e-6) return "h";
  if (dx < 1e-6) return "v";
  return "d";
}

export function shouldShowPenShiftConstraintGuide(input: PenShiftConstraintGuideInput): boolean {
  if (!input.shiftKey || !input.previousAnchor || !input.rawPointer || !input.snappedPointer) {
    return false;
  }
  return (
    Math.hypot(
      input.rawPointer.x - input.previousAnchor.x,
      input.rawPointer.y - input.previousAnchor.y,
    ) >= 1e-6
  );
}

/** Figma-style shift constraint segment from the previous anchor to the snapped preview point. */
export function resolvePenShiftConstraintGuide(
  input: PenShiftConstraintGuideInput,
): PenShiftConstraintGuide | null {
  if (!shouldShowPenShiftConstraintGuide(input)) return null;
  const from = input.previousAnchor!;
  const to = input.snappedPointer!;
  return {
    from: { ...from },
    to: { ...to },
    axis: classifyPenShiftSnapAxis(from, to),
  };
}
