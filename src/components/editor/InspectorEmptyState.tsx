"use client";

import { LayoutTemplate, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlignControls } from "./AlignControls";

export function InspectorEmptyState({
  multi,
  count,
  selectedCount,
  onAddAutoLayout,
  canAddAutoLayout,
}: {
  multi?: boolean;
  /** Layers that can actually be aligned (top-level, unlocked, visible). */
  count?: number;
  /** Raw selection size (may include nested picks). */
  selectedCount?: number;
  onAddAutoLayout?: () => void;
  canAddAutoLayout?: boolean;
}) {
  return (
    <div className="flex min-h-[min(70vh,520px)] min-h-0 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-app-border bg-white/[0.03] text-app-subtle">
        <MousePointer2 className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <p className="text-[12px] font-medium leading-snug text-app-muted">
        {multi && selectedCount != null
          ? `${selectedCount} layer${selectedCount === 1 ? "" : "s"} selected`
          : multi && count != null
            ? `${count} layers selected`
            : multi
              ? "Multiple layers selected"
              : "Nothing selected"}
      </p>
      <p className="max-w-[220px] text-[11px] leading-relaxed text-app-subtle">
        {multi && (selectedCount ?? 0) > (count ?? 0) && (count ?? 0) < 2
          ? "Only top-level siblings can be aligned. Deselect nested layers or pick layers that share the same parent."
          : multi
            ? "Align layers below, or wrap them in an auto-layout frame (⇧A)."
            : "Click a frame, shape, or text layer to inspect and edit layout, fill, and typography."}
      </p>
      {multi && (count ?? 0) >= 2 ? (
        <div className="mt-3 w-full max-w-[240px] rounded-md border border-app-border bg-white/[0.02] p-2.5 text-left">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-app-subtle">
            Align
          </div>
          <AlignControls variant="panel" />
        </div>
      ) : null}
      {multi && canAddAutoLayout && onAddAutoLayout ? (
        <button
          type="button"
          onClick={onAddAutoLayout}
          className={cn(
            "mt-2 flex h-7 items-center justify-center gap-1.5 rounded border px-3 text-[11px] font-medium transition-colors",
            "border-app-border bg-app-panel text-app-fg hover:bg-app-hover",
          )}
        >
          <LayoutTemplate className="h-3.5 w-3.5" strokeWidth={1.75} />
          Add auto layout
        </button>
      ) : null}
    </div>
  );
}
