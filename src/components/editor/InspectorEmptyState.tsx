"use client";

import { LayoutTemplate, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { canAlignSelection } from "@/lib/alignSelection";
import { useEditorStore } from "@/stores/useEditorStore";
import { AlignControls } from "./AlignControls";
import { SelectionInspectorTools } from "./SelectionInspectorTools";

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
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const canAlign = canAlignSelection(selectedIds, nodes, childOrder);
  return (
    <div className="flex min-h-[min(70vh,520px)] min-h-0 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-app-border bg-white/[0.03] text-app-subtle">
        <MousePointer2 className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <p className="text-ui font-medium leading-snug text-app-muted">
        {multi && selectedCount != null
          ? `${selectedCount} layer${selectedCount === 1 ? "" : "s"} selected`
          : multi && count != null
            ? `${count} layers selected`
            : multi
              ? "Multiple layers selected"
              : "Nothing selected"}
      </p>

      {multi ? (
        <div className="mt-3 w-full max-w-[280px]">
          <SelectionInspectorTools />
        </div>
      ) : null}
      {multi && canAlign ? (
        <div className="mt-4 w-full max-w-[240px] rounded-md border border-app-border bg-white/[0.02] p-3 text-left">
          <div className="mb-2.5 text-ui font-medium text-app-subtle">Align</div>
          <AlignControls variant="panel" />
        </div>
      ) : null}
      {multi && canAddAutoLayout && onAddAutoLayout ? (
        <button
          type="button"
          onClick={onAddAutoLayout}
          className={cn(
            "mt-2 flex h-7 items-center justify-center gap-1.5 rounded-md border px-3 text-ui font-medium transition-colors",
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
