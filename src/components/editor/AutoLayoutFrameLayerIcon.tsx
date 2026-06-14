import type { LayoutMode } from "@/lib/layoutEngine/types";
import { cn } from "@/lib/utils";

const STROKE = 1.25;

/** Auto-layout frame glyph for the layers panel (frame shell + stacked children). */
export function AutoLayoutFrameLayerIcon({
  mode,
  className,
}: {
  mode: Exclude<LayoutMode, "none">;
  className?: string;
}) {
  const horizontal = mode === "horizontal";

  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn("h-3.5 w-3.5 shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="1.25"
        y="1.25"
        width="13.5"
        height="13.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth={STROKE}
      />
      {horizontal ? (
        <>
          <rect x="3.75" y="5" width="2.75" height="6" rx="0.4" fill="currentColor" />
          <rect x="8.5" y="4.25" width="2.75" height="7.5" rx="0.4" fill="currentColor" />
        </>
      ) : (
        <>
          <rect x="5" y="3.75" width="6" height="2.75" rx="0.4" fill="currentColor" />
          <rect x="4.25" y="8.5" width="7.5" height="2.75" rx="0.4" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
