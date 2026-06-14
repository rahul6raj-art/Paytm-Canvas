"use client";

import { rotateGlyphArcPath, rotateGlyphArrowPaths } from "@/lib/rotateHandleGlyph";
import { cn } from "@/lib/utils";

const GLYPH_CENTER = 12;

/** On-canvas rotate affordance (top handle + corner hints). */
export function RotateHandleGlyph({
  size,
  angleDeg = 0,
  className,
}: {
  size: number;
  angleDeg?: number;
  className?: string;
}) {
  const arc = rotateGlyphArcPath();
  const arrows = rotateGlyphArrowPaths();
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className={cn("shrink-0 text-current", className)}
      fill="none"
    >
      <g transform={`rotate(${angleDeg} ${GLYPH_CENTER} ${GLYPH_CENTER})`}>
        <path
          d={arc}
          stroke="currentColor"
          strokeWidth={1.65}
          strokeLinecap="round"
        />
        <path d={arrows.start} fill="currentColor" stroke="none" />
        <path d={arrows.end} fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
