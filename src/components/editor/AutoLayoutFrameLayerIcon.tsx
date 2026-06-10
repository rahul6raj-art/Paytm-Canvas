import type { LayoutMode } from "@/lib/layoutEngine/types";
import { cn } from "@/lib/utils";

/** Auto-layout frame glyph for the layers panel (stacked or side-by-side children). */
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
      viewBox="0 0 17 17"
      aria-hidden
      className={cn("h-3.5 w-3.5 shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {horizontal ? (
        <>
          <rect x="3.5" y="0.5" width="4" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.75" />
          <rect x="9.5" y="0.5" width="4" height="16" rx="0.5" stroke="currentColor" strokeWidth="1.75" />
        </>
      ) : (
        <>
          <rect x="0.5" y="3.5" width="10" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.75" />
          <rect x="0.5" y="9.5" width="16" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.75" />
        </>
      )}
    </svg>
  );
}
