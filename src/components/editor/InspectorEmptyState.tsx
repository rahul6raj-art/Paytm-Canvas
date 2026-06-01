"use client";

import { LayoutTemplate, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function InspectorEmptyState({
  multi,
  count,
  onAddAutoLayout,
  canAddAutoLayout,
}: {
  multi?: boolean;
  count?: number;
  onAddAutoLayout?: () => void;
  canAddAutoLayout?: boolean;
}) {
  return (
    <div className="flex min-h-[min(70vh,520px)] min-h-0 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#6b6b6b]">
        <MousePointer2 className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <p className="text-[12px] font-medium leading-snug text-[#c4c4c4]">
        {multi && count != null
          ? `${count} layers selected`
          : multi
            ? "Multiple layers selected"
            : "Nothing selected"}
      </p>
      <p className="max-w-[220px] text-[11px] leading-relaxed text-[#6b6b6b]">
        {multi
          ? "Use auto layout to frame and stack shapes, text, and other layers (Figma ⇧A)."
          : "Click a frame, shape, or text layer to inspect and edit layout, fill, and typography."}
      </p>
      {multi && canAddAutoLayout && onAddAutoLayout ? (
        <button
          type="button"
          onClick={onAddAutoLayout}
          className={cn(
            "mt-2 flex h-7 items-center justify-center gap-1.5 rounded border px-3 text-[11px] font-medium transition-colors",
            "border-white/[0.1] bg-[#2c2c2c] text-[#e6e6e6] hover:bg-white/[0.06]",
          )}
        >
          <LayoutTemplate className="h-3.5 w-3.5" strokeWidth={1.75} />
          Add auto layout
        </button>
      ) : null}
    </div>
  );
}
