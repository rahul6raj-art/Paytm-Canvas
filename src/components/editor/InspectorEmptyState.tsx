"use client";

import { MousePointer2 } from "lucide-react";

export function InspectorEmptyState({ multi, count }: { multi?: boolean; count?: number }) {
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
      <p className="max-w-[200px] text-[11px] leading-relaxed text-[#6b6b6b]">
        {multi
          ? "Select a single layer in the canvas or layers list to edit its properties."
          : "Click a frame, shape, or text layer to inspect and edit layout, fill, and typography."}
      </p>
    </div>
  );
}
