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
  /** `above` = default offset above point; `center` = centered on point (gap labels). */
  placement?: "above" | "center";
  background?: string;
}) {
  const { x, y, zoom, children, className, placement = "above", background } = props;
  const font = screenPxToWorld(CANVAS_SELECTION_DIMENSION_BADGE_FONT_SCREEN_PX, zoom);
  const padX = screenPxToWorld(CANVAS_SELECTION_DIMENSION_BADGE_PAD_X_SCREEN_PX, zoom);
  const padY = screenPxToWorld(CANVAS_SELECTION_DIMENSION_BADGE_PAD_Y_SCREEN_PX, zoom);
  const radius = screenPxToWorld(CANVAS_SELECTION_DIMENSION_BADGE_RADIUS_SCREEN_PX, zoom);
  const gap = screenPxToWorld(CANVAS_SELECTION_DIMENSION_BADGE_GAP_SCREEN_PX, zoom);
  const centered = placement === "center";

  return (
    <div
      data-canvas-edit-value-badge
      className={
        className ??
        "pointer-events-none absolute z-[35] whitespace-nowrap font-semibold tabular-nums text-white shadow-sm"
      }
      style={{
        left: x,
        top: centered ? y : y - gap,
        transform: centered ? "translate(-50%, -50%)" : "translate(-50%, -100%)",
        background: background ?? CANVAS_VISUAL.selection,
        fontSize: `${font}px`,
        lineHeight: `${font}px`,
        padding: `${padY}px ${padX}px`,
        borderRadius: radius,
      }}
    >
      {children}
    </div>
  );
}
