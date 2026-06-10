"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import { useEditorStore, type AlignDirection } from "@/stores/useEditorStore";
import { alignableSelectionIds } from "@/lib/alignSelection";
import { cn } from "@/lib/utils";

/** Lucide flex icons use web axis names — map to Figma-style edge/center align. */
const ALIGN_BUTTONS: {
  direction: AlignDirection;
  label: string;
  Icon: typeof AlignLeft;
}[] = [
  { direction: "left", label: "Align left edges", Icon: AlignLeft },
  { direction: "center-h", label: "Align horizontal centers", Icon: AlignCenterVertical },
  { direction: "right", label: "Align right edges", Icon: AlignRight },
  { direction: "top", label: "Align top edges", Icon: AlignStartHorizontal },
  { direction: "center-v", label: "Align vertical centers", Icon: AlignCenterHorizontal },
  { direction: "bottom", label: "Align bottom edges", Icon: AlignEndHorizontal },
];

type AlignControlsProps = {
  variant?: "toolbar" | "panel";
  className?: string;
  onAction?: () => void;
};

export function AlignControls({ variant = "panel", className, onAction }: AlignControlsProps) {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const alignSelection = useEditorStore((s) => s.alignSelection);
  const distributeSelection = useEditorStore((s) => s.distributeSelection);

  const tops = alignableSelectionIds(selectedIds, nodes);

  const canAlign = tops.length >= 2;
  const canDistribute = tops.length >= 3;

  const runAlign = (d: AlignDirection) => {
    if (!canAlign) return;
    alignSelection(d);
    onAction?.();
  };

  const runDistribute = (axis: "horizontal" | "vertical") => {
    if (!canDistribute) return;
    distributeSelection(axis);
    onAction?.();
  };

  const compact = variant === "toolbar";
  const btnClass = cn(
    "flex items-center justify-center rounded transition-colors",
    compact ? "h-7 w-7" : "h-8 flex-1",
    "text-app-muted hover:bg-app-hover hover:text-app-fg",
    "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-app-muted",
  );

  return (
    <div className={cn("space-y-2", className)}>
      {!compact ? (
        <p className="text-[10px] leading-snug text-[#737373]">
          {canAlign
            ? `Align ${tops.length} layers to the selection bounds (edges and centers).`
            : "Select at least 2 unlocked layers to align."}
        </p>
      ) : null}

      <div
        className={cn(
          "grid grid-cols-3 gap-0.5",
          compact ? "rounded-md border border-app-border bg-app-toolbar-well p-0.5" : "gap-1",
        )}
        role="toolbar"
        aria-label="Align selection"
      >
        {ALIGN_BUTTONS.map(({ direction, label, Icon }) => (
          <button
            key={direction}
            type="button"
            title={label}
            aria-label={label}
            disabled={!canAlign}
            className={btnClass}
            onClick={() => runAlign(direction)}
          >
            <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.75} />
          </button>
        ))}
      </div>

      <div className={cn("flex gap-1", compact && "mt-0.5")}>
        <button
          type="button"
          title="Distribute horizontal spacing"
          aria-label="Distribute horizontal spacing"
          disabled={!canDistribute}
          className={cn(btnClass, compact ? "h-7 flex-1" : "h-8 flex-1 gap-1.5 text-[11px]")}
          onClick={() => runDistribute("horizontal")}
        >
          <AlignHorizontalDistributeCenter className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {!compact ? <span>Distribute H</span> : null}
        </button>
        <button
          type="button"
          title="Distribute vertical spacing"
          aria-label="Distribute vertical spacing"
          disabled={!canDistribute}
          className={cn(btnClass, compact ? "h-7 flex-1" : "h-8 flex-1 gap-1.5 text-[11px]")}
          onClick={() => runDistribute("vertical")}
        >
          <AlignVerticalDistributeCenter className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {!compact ? <span>Distribute V</span> : null}
        </button>
      </div>

      {!compact && !canAlign ? (
        <p className="text-[10px] text-app-subtle">Distribute needs 3 or more layers.</p>
      ) : null}
    </div>
  );
}
