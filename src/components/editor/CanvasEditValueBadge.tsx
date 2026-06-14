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
  /** When true, x/y and sizing use viewport pixels (screen overlay layer). */
  screenSpace?: boolean;
  /** Keep pill width stable while numeric value changes (avoids center-shift jitter). */
  stableWidth?: boolean;
}) {
  const {
    x,
    y,
    zoom,
    children,
    className,
    placement = "above",
    background,
    screenSpace = false,
    stableWidth = false,
  } = props;
  const toUnits = (px: number) => (screenSpace ? px : screenPxToWorld(px, zoom));
  const font = toUnits(CANVAS_SELECTION_DIMENSION_BADGE_FONT_SCREEN_PX);
  const padX = toUnits(CANVAS_SELECTION_DIMENSION_BADGE_PAD_X_SCREEN_PX);
  const padY = toUnits(CANVAS_SELECTION_DIMENSION_BADGE_PAD_Y_SCREEN_PX);
  const radius = toUnits(CANVAS_SELECTION_DIMENSION_BADGE_RADIUS_SCREEN_PX);
  const gap = toUnits(CANVAS_SELECTION_DIMENSION_BADGE_GAP_SCREEN_PX);
  const centered = placement === "center";
  const left = screenSpace ? Math.round(x) : x;
  const top = screenSpace ? Math.round(centered ? y : y - gap) : centered ? y : y - gap;

  return (
    <div
      data-canvas-edit-value-badge
      className={
        className ??
        `pointer-events-none absolute whitespace-nowrap font-semibold tabular-nums text-white${
          stableWidth ? " min-w-[2.75rem] text-center" : ""
        }`
      }
      style={{
        left,
        top,
        transform: centered ? "translate(-50%, -50%)" : "translate(-50%, -100%)",
        background: background ?? CANVAS_VISUAL.selection,
        fontSize: `${font}px`,
        lineHeight: `${font}px`,
        padding: `${padY}px ${padX}px`,
        borderRadius: radius,
        zIndex: screenSpace ? 37 : 35,
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.28), 0 2px 8px rgba(0,0,0,0.38)",
      }}
    >
      {children}
    </div>
  );
}
