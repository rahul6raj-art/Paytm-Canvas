import { screenPxToOverlay, worldPointToOverlay, type OverlaySpace } from "@/lib/canvasOverlaySpace";
import {
  buildLivePreviewSegment,
  buildPlacementPreviewPoints,
  cubicPathD,
  placementHandleVectors,
  type CubicPoint,
} from "./bezierGeometry";
import type { PenPlacement } from "./types";
import type { WorldPathPoint } from "./coordinates";

/** Map world anchor + relative handle → overlay anchor + relative handle (non-linear under zoom). */
function mapWorldCubicPoint(p: CubicPoint, overlay: OverlaySpace): CubicPoint {
  const a = worldPointToOverlay(p.x, p.y, overlay);
  const mapHandle = (h: { x: number; y: number } | null | undefined) => {
    if (!h) return h;
    const tip = worldPointToOverlay(p.x + h.x, p.y + h.y, overlay);
    return { x: tip.x - a.x, y: tip.y - a.y };
  };
  return {
    x: a.x,
    y: a.y,
    handleIn: mapHandle(p.handleIn),
    handleOut: mapHandle(p.handleOut),
  };
}

/** Build SVG path `d` in viewport overlay space from world-space path points. */
export function overlayPenPathD(points: readonly WorldPathPoint[], overlay: OverlaySpace): string {
  return cubicPathD(points.map((p) => mapWorldCubicPoint(p, overlay)));
}

export function overlayPreviewSegmentD(
  last: WorldPathPoint,
  targetWorld: { x: number; y: number },
  placement: PenPlacement | null,
  overlay: OverlaySpace,
): { path: string; isCurve: boolean } {
  const lastO = mapWorldCubicPoint(last, overlay);
  if (placement) {
    const { hx, hy } = placementHandleVectors(placement.anchor, placement.drag, last);
    const anchorO = worldPointToOverlay(placement.anchor.x, placement.anchor.y, overlay);
    const dragO = worldPointToOverlay(placement.anchor.x + hx, placement.anchor.y + hy, overlay);
    return buildLivePreviewSegment(lastO, targetWorld, {
      anchor: anchorO,
      drag: dragO,
    });
  }
  const targetO = worldPointToOverlay(targetWorld.x, targetWorld.y, overlay);
  return buildLivePreviewSegment(lastO, targetO, null);
}

export function overlayHandleLines(
  last: WorldPathPoint,
  placement: PenPlacement,
  overlay: OverlaySpace,
): Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> {
  const { hx, hy } = placementHandleVectors(placement.anchor, placement.drag, last);
  const a = worldPointToOverlay(last.x, last.y, overlay);
  const out = worldPointToOverlay(last.x + hx, last.y + hy, overlay);
  const anchor = worldPointToOverlay(placement.anchor.x, placement.anchor.y, overlay);
  const inPt = worldPointToOverlay(placement.anchor.x - hx, placement.anchor.y - hy, overlay);
  const outTip = worldPointToOverlay(placement.anchor.x + hx, placement.anchor.y + hy, overlay);
  return [
    { key: "prev-out", x1: a.x, y1: a.y, x2: out.x, y2: out.y },
    { key: "new-out", x1: anchor.x, y1: anchor.y, x2: outTip.x, y2: outTip.y },
    { key: "new-in", x1: anchor.x, y1: anchor.y, x2: inPt.x, y2: inPt.y },
  ];
}

export function overlayPlacementPreviewPoints(
  committed: readonly WorldPathPoint[],
  placement: PenPlacement,
  overlay: OverlaySpace,
): CubicPoint[] {
  const preview = buildPlacementPreviewPoints(committed, placement.anchor, placement.drag);
  return preview.map((p) => mapWorldCubicPoint(p, overlay));
}

export function overlayScreenSize(overlay: OverlaySpace, screenPx: number): number {
  return screenPxToOverlay(screenPx, overlay);
}
