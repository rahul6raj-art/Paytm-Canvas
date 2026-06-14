"use client";

import {
  CANVAS_SELECTION_DIMENSION_BADGE_FONT_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_GAP_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_PAD_X_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_PAD_Y_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_RADIUS_SCREEN_PX,
  CANVAS_VISUAL,
  formatSelectionDimensions,
} from "@/lib/canvasVisual";
import {
  shapeDrawPreviewBoxBounds,
  shapeDrawPreviewKind,
  shapeDrawPreviewLineEndpoints,
} from "@/lib/shapeDrawPreview";
import { screenPxToOverlay, worldPointToOverlay, worldRectToOverlay } from "@/lib/canvasOverlaySpace";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";

/** Figma-style dashed rubber-band while dragging a new shape, frame, or text box. */
export function ShapeDrawPreview() {
  const shapeSession = useEditorStore((s) => s.shapeDrawingSession);
  const frameSession = useEditorStore((s) => s.frameDrawingSession);
  const textSession = useEditorStore((s) => s.textDrawingSession);
  const session = shapeSession ?? frameSession ?? textSession;
  const node = useEditorStore((s) => (session ? s.nodes[session.nodeId] : undefined));
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const overlay = useCanvasOverlaySpace();

  if (!session || !node) return null;

  const kind = shapeDrawPreviewKind(node);
  if (kind === "none") return null;

  const border = screenPxToOverlay(1, overlay);
  const badgeFont = screenPxToOverlay(CANVAS_SELECTION_DIMENSION_BADGE_FONT_SCREEN_PX, overlay);
  const badgePadX = screenPxToOverlay(CANVAS_SELECTION_DIMENSION_BADGE_PAD_X_SCREEN_PX, overlay);
  const badgePadY = screenPxToOverlay(CANVAS_SELECTION_DIMENSION_BADGE_PAD_Y_SCREEN_PX, overlay);
  const badgeGap = screenPxToOverlay(CANVAS_SELECTION_DIMENSION_BADGE_GAP_SCREEN_PX, overlay);
  const badgeRadius = screenPxToOverlay(CANVAS_SELECTION_DIMENSION_BADGE_RADIUS_SCREEN_PX, overlay);

  if (kind === "line") {
    const ep = shapeDrawPreviewLineEndpoints(node, nodes, childOrder, session.nodeId);
    if (!ep) return null;
    const a = worldPointToOverlay(ep.x1, ep.y1, overlay);
    const b = worldPointToOverlay(ep.x2, ep.y2, overlay);
    const len = Math.round(Math.hypot(ep.x2 - ep.x1, ep.y2 - ep.y1));
    const mid = worldPointToOverlay((ep.x1 + ep.x2) / 2, (ep.y1 + ep.y2) / 2, overlay);
    return (
      <svg
        className="pointer-events-none absolute inset-0 z-[13] h-full w-full overflow-visible"
        aria-hidden
        data-shape-draw-preview
      >
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={CANVAS_VISUAL.selection}
          strokeWidth={2}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={mid.x}
          y={mid.y - screenPxToOverlay(8, overlay)}
          textAnchor="middle"
          fill={CANVAS_VISUAL.selection}
          fontSize={badgeFont}
          fontWeight={600}
        >
          {len}
        </text>
      </svg>
    );
  }

  const bounds = shapeDrawPreviewBoxBounds(session.nodeId, nodes, childOrder);
  if (!bounds) return null;
  const rect = worldRectToOverlay(bounds, overlay);
  const label = formatSelectionDimensions(bounds.width, bounds.height);

  return (
    <>
      <div
        className="pointer-events-none absolute z-[13] box-border border-dashed"
        data-shape-draw-preview
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          borderWidth: border,
          borderColor: CANVAS_VISUAL.selection,
          background: "rgba(24, 160, 251, 0.06)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute z-[14] whitespace-nowrap font-semibold tabular-nums text-white"
        style={{
          left: rect.x + rect.width / 2,
          top: rect.y + rect.height + badgeGap,
          transform: "translateX(-50%)",
          fontSize: badgeFont,
          padding: `${badgePadY}px ${badgePadX}px`,
          borderRadius: badgeRadius,
          background: CANVAS_VISUAL.selection,
        }}
        aria-hidden
      >
        {label}
      </div>
    </>
  );
}
