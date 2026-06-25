"use client";

import { getRenderedWorldTopLeft } from "@/lib/editorGraph";
import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import type { OverlaySpace } from "@/lib/canvasOverlaySpace";
import { worldPointToOverlay } from "@/lib/canvasOverlaySpace";
import {
  buildPenPreviewPoints,
  canClosePathAt,
  overlayHandleLines,
  overlayPenPathD,
  overlayPreviewSegmentD,
  overlayScreenSize,
  pathPointsToWorld,
  placementHandleVectors,
  resolvePenLivePreviewTarget,
  resolvePenSegmentPreviewTarget,
  shouldShowCurvePlacement,
  resolvePenShiftSnappedPointer,
  type PenPlacement,
} from "@/lib/penTool";
import { ShiftConstraintGuideOverlay } from "@/components/editor/ShiftConstraintGuideOverlay";
import { PenSmartAlignmentGuideOverlay } from "@/components/editor/PenSmartAlignmentGuideOverlay";
import type { EditorNode } from "@/stores/useEditorStore";
import type { ComponentProps } from "react";
import type { PathPoint } from "@/lib/pathGeometry";
import { useCanvasOverlaySpace } from "@/components/editor/useCanvasOverlaySpace";

export function PenDrawingOverlay({
  drawId,
  hoverPreview,
  hoverRaw,
  placement,
  shiftKey,
  nodes,
  childOrder,
  zoom,
  overlay,
}: {
  drawId: string;
  hoverPreview: { x: number; y: number } | null;
  hoverRaw: { x: number; y: number } | null;
  placement: PenPlacement | null;
  shiftKey: boolean;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  zoom: number;
  overlay: OverlaySpace;
}) {
  const n = nodes[drawId];
  const pts = n?.pathPoints ?? [];
  if (!pts.length) return null;

  const origin = getRenderedWorldTopLeft(drawId, nodes, childOrder);
  const worldPts = pathPointsToWorld(pts, origin);
  const curvePlacement = placement && shouldShowCurvePlacement(placement, zoom) ? placement : null;
  const committedD = overlayPenPathD(worldPts, overlay);

  const d = curvePlacement
    ? overlayPenPathD(buildPenPreviewPoints(worldPts, curvePlacement.anchor, curvePlacement.drag), overlay)
    : committedD;

  const last = worldPts[worldPts.length - 1]!;
  const segmentPreviewTarget = resolvePenSegmentPreviewTarget(hoverPreview, placement, last);
  const previewTarget = curvePlacement
    ? resolvePenLivePreviewTarget(hoverPreview, placement)
    : segmentPreviewTarget;
  const first = worldPts[0]!;
  const closeProbe = placement?.drag ?? hoverRaw ?? hoverPreview;
  const canClose =
    !placement && closeProbe != null && canClosePathAt(closeProbe, first, pts.length, zoom);

  const liveSeg =
    previewTarget != null
      ? overlayPreviewSegmentD(last, previewTarget, curvePlacement, overlay)
      : null;
  const rawPointer = placement?.rawDrag ?? hoverRaw;
  const activeShiftKey = placement?.shiftKey ?? shiftKey;
  const snappedPointer = resolvePenShiftSnappedPointer(rawPointer, last, activeShiftKey);
  const handleLines =
    curvePlacement && worldPts.length > 0 ? overlayHandleLines(last, curvePlacement, overlay) : [];

  const anchorR = overlayScreenSize(overlay, 4);
  const anchorSelectedR = overlayScreenSize(overlay, 5);
  const handleHalf = overlayScreenSize(overlay, 4) / 2;
  const ring = overlayScreenSize(overlay, 2);
  const stroke = overlayScreenSize(overlay, 2);
  const hairline = overlayScreenSize(overlay, 1);
  const closeR = overlayScreenSize(overlay, 10);

  const firstOverlay = worldPointToOverlay(first.x, first.y, overlay);

  return (
    <>
      <PenSmartAlignmentGuideOverlay
        anchors={worldPts}
        previewPoint={segmentPreviewTarget}
        zoom={zoom}
        overlay={overlay}
      />
      <ShiftConstraintGuideOverlay
        previousAnchor={last}
        rawPointer={rawPointer}
        snappedPointer={snappedPointer}
        shiftKey={activeShiftKey}
        overlay={overlay}
      />
      <svg
        className="pointer-events-none absolute inset-0 z-[18] h-full w-full overflow-visible"
        aria-hidden
        data-pen-drawing-overlay
      >
      {d ? (
        <path
          d={d}
          fill="none"
          stroke={CANVAS_VISUAL.selection}
          strokeWidth={stroke}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {liveSeg ? (
        <path
          d={liveSeg.path}
          fill="none"
          stroke={canClose ? "#22c55e" : CANVAS_VISUAL.selection}
          strokeWidth={stroke}
          strokeDasharray={liveSeg.isCurve || curvePlacement ? undefined : "6 4"}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {handleLines.map((line) => (
        <line
          key={line.key}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={CANVAS_VISUAL.selection}
          strokeWidth={hairline}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {worldPts.map((pt, i) => {
        const pos = worldPointToOverlay(pt.x, pt.y, overlay);
        const selected = i === worldPts.length - 1 && !placement;
        return (
          <PenAnchorDot
            key={pts[i]?.id ?? i}
            x={pos.x}
            y={pos.y}
            r={selected ? anchorSelectedR : anchorR}
            ring={selected ? ring : 0}
          />
        );
      })}

      {curvePlacement ? (
        <>
          {(() => {
            const { hx, hy } = placementHandleVectors(curvePlacement.anchor, curvePlacement.drag, last);
            return (
              <>
                <PenHandleDot
                  half={handleHalf}
                  {...worldPointToOverlay(
                    curvePlacement.anchor.x + hx,
                    curvePlacement.anchor.y + hy,
                    overlay,
                  )}
                />
                <PenHandleDot
                  half={handleHalf}
                  {...worldPointToOverlay(
                    curvePlacement.anchor.x - hx,
                    curvePlacement.anchor.y - hy,
                    overlay,
                  )}
                />
              </>
            );
          })()}
          <PenAnchorDot
            {...worldPointToOverlay(curvePlacement.anchor.x, curvePlacement.anchor.y, overlay)}
            r={anchorSelectedR}
            ring={ring}
          />
        </>
      ) : placement ? (
        <PenAnchorDot
          {...worldPointToOverlay(placement.anchor.x, placement.anchor.y, overlay)}
          r={anchorSelectedR}
          ring={ring}
        />
      ) : null}

      {canClose ? (
        <circle
          cx={firstOverlay.x}
          cy={firstOverlay.y}
          r={closeR}
          fill="none"
          stroke="#22c55e"
          strokeWidth={stroke}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
    </>
  );
}

function PenAnchorDot({
  x,
  y,
  r,
  ring = 0,
}: {
  x: number;
  y: number;
  r: number;
  ring?: number;
}) {
  return (
    <circle
      cx={x}
      cy={y}
      r={r}
      fill="#18a0fb"
      stroke={ring > 0 ? "#ffffff" : "none"}
      strokeWidth={ring}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function PenHandleDot({ x, y, half }: { x: number; y: number; half: number }) {
  return (
    <rect
      x={x - half}
      y={y - half}
      width={half * 2}
      height={half * 2}
      fill="#ffffff"
      stroke="#18a0fb"
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
      transform={`rotate(45 ${x} ${y})`}
    />
  );
}

export function penPreviousWorldAnchor(
  pts: PathPoint[],
  origin: { x: number; y: number },
): { x: number; y: number } | null {
  if (pts.length === 0) return null;
  const last = pts[pts.length - 1]!;
  return { x: origin.x + last.x, y: origin.y + last.y };
}

export function PenDrawingOverlayHost(
  props: Omit<ComponentProps<typeof PenDrawingOverlay>, "overlay">,
) {
  const overlay = useCanvasOverlaySpace();
  return <PenDrawingOverlay {...props} overlay={overlay} />;
}
