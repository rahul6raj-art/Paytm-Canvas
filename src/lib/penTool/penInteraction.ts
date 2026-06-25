import { placementDragDistance, resolvePenHoverPreview } from "./placement";
import type { PenPlacement } from "./types";

export type PenDrawPhase =
  | "idle"
  | "drawing"
  | "previewingNext"
  | "draggingNewPoint"
  | "closing";

/** Whether the pen overlay should stay visible while a stroke is in progress. */
export function shouldShowPenDrawingOverlay(penDrawingNodeId: string | null): boolean {
  return Boolean(penDrawingNodeId);
}

/** Segment endpoint for live preview while hovering the next point. */
export function resolvePenSegmentPreviewTarget(
  hoverPreview: { x: number; y: number } | null,
  placement: PenPlacement | null,
  previousAnchor: { x: number; y: number } | null,
): { x: number; y: number } | null {
  if (placement) {
    const raw = placement.rawDrag ?? placement.drag;
    if (previousAnchor) {
      return resolvePenHoverPreview(raw, previousAnchor, placement.shiftKey ?? false);
    }
    return { ...placement.anchor };
  }
  return hoverPreview;
}

/** Segment endpoint for live preview: hover snap or fixed click anchor while dragging. */
export function resolvePenLivePreviewTarget(
  hoverPreview: { x: number; y: number } | null,
  placement: PenPlacement | null,
): { x: number; y: number } | null {
  if (placement) return { ...placement.anchor };
  return hoverPreview;
}

/** Corner commit uses the same segment snap as hover preview (from last raw pointer). */
export function resolvePenCommitCornerPoint(
  placement: PenPlacement,
  previousAnchor: { x: number; y: number } | null,
  shiftKey: boolean,
  rawPointer?: { x: number; y: number },
): { x: number; y: number } {
  const raw = rawPointer ?? placement.drag;
  if (!previousAnchor) return { ...placement.anchor };
  return resolvePenHoverPreview(raw, previousAnchor, shiftKey);
}

/** Commit smooth vs corner from an in-progress placement. */
export function resolvePenPointCommit(
  placement: PenPlacement,
  curveDragThresholdWorld: number,
): "smooth" | "corner" {
  return placementDragDistance(placement) >= curveDragThresholdWorld ? "smooth" : "corner";
}

export type PenEscapeAction = "cancel" | "finishOpen" | "switchToolOnly";

/** Escape while drawing: cancel single-point stub, otherwise finish open path. */
export function resolvePenEscapeAction(pointCount: number): PenEscapeAction {
  if (pointCount >= 2) return "finishOpen";
  return "cancel";
}

export type PenToolSwitchAction = "cancel" | "finishOpen" | "none";

/** Leaving pen tool while drawing: finish valid strokes, discard stubs. */
export function resolvePenToolSwitchAction(pointCount: number): PenToolSwitchAction {
  if (pointCount >= 2) return "finishOpen";
  if (pointCount >= 1) return "cancel";
  return "none";
}

/** Enter finishes an in-progress open path when at least two anchors exist. */
export function shouldPenEnterFinish(pointCount: number): boolean {
  return pointCount >= 2;
}

/** Close-path click should finish without appending another anchor. */
export function shouldClosePathInsteadOfAddingPoint(closePath: boolean): boolean {
  return closePath;
}
