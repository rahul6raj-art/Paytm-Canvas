"use client";

import {
  CANVAS_TOOL_RAIL_ICON_SIZE,
  CANVAS_TOOL_RAIL_ICON_STROKE,
} from "@/lib/canvasToolRail";
import { cn } from "@/lib/utils";

/** Penpot `pentool.svg` — vector pen with anchor point (Figma-parity tool rail). */
export function PenToolIcon({
  size = CANVAS_TOOL_RAIL_ICON_SIZE,
  strokeWidth = CANVAS_TOOL_RAIL_ICON_STROKE,
  className,
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={cn("block shrink-0", className)}
    >
      <path
        d="m12.101 1.138c-.26-.26-.681-.256-.974-.034-1.724 1.308-4.125 1.403-5.183 1.372-.314-.009-.608.182-.707.48l-3.482 10.446c-.174.521.322 1.017.843.843l10.446-3.482c.298-.099.489-.393.48-.707-.031-1.058.064-3.459 1.372-5.183.222-.293.226-.714-.034-.974zm-2.62 6.492c0 .613-.497 1.111-1.111 1.111-.613 0-1.111-.498-1.111-1.111 0-.614.498-1.111 1.111-1.111.614 0 1.111.497 1.111 1.111zm-2.221 1.11-5.26 5.26"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
