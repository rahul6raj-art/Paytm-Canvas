"use client";

import type { ReactNode } from "react";
import {
  CANVAS_SELECTION_DIMENSION_BADGE_FONT_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_GAP_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_PAD_X_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_PAD_Y_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_RADIUS_SCREEN_PX,
  CANVAS_VISUAL,
  screenPxToWorld,
} from "@/lib/canvasVisual";

/** Zoom-stable label shown while dragging shape edit handles (corner radius, etc.). */
export function CanvasEditValueBadge(props: {
  x: number;
  y: number;
  zoom: number;
  children: ReactNode;
  className?: string;
}) {
  const { x, y, zoom, children, className } = props;
  const font = screenPxToWorld(CANVAS_SELECTION_DIMENSION_BADGE_FONT_SCREEN_PX, zoom);
  const padX = screenPxToWorld(CANVAS_SELECTION_DIMENSION_BADGE_PAD_X_SCREEN_PX, zoom);
  const padY = screenPxToWorld(CANVAS_SELECTION_DIMENSION_BADGE_PAD_Y_SCREEN_PX, zoom);
  const radius = screenPxToWorld(CANVAS_SELECTION_DIMENSION_BADGE_RADIUS_SCREEN_PX, zoom);
  const gap = screenPxToWorld(CANVAS_SELECTION_DIMENSION_BADGE_GAP_SCREEN_PX, zoom);

  return (
    <div
      data-canvas-edit-value-badge
      className={
        className ??
        "pointer-events-none absolute z-[35] whitespace-nowrap font-semibold tabular-nums text-white shadow-sm"
      }
      style={{
        left: x,
        top: y - gap,
        transform: "translate(-50%, -100%)",
        background: CANVAS_VISUAL.selection,
        fontSize: font,
        lineHeight: `${font}px`,
        padding: `${padY}px ${padX}px`,
        borderRadius: radius,
      }}
    >
      {children}
    </div>
  );
}
