"use client";

import type { LucideIcon } from "lucide-react";
import {
  CANVAS_TOOL_RAIL_ICON_SIZE,
  CANVAS_TOOL_RAIL_ICON_STROKE,
} from "@/lib/canvasToolRail";

/** Lucide icon tuned for crisp 1×/2× rendering on the bottom tool rail. */
export function CanvasToolRailIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon
      size={CANVAS_TOOL_RAIL_ICON_SIZE}
      strokeWidth={CANVAS_TOOL_RAIL_ICON_STROKE}
      absoluteStrokeWidth
      aria-hidden
    />
  );
}
