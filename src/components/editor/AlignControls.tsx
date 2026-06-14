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
import { canAlignSelection, canDistributeSelection } from "@/lib/alignSelection";
import { cn } from "@/lib/utils";
import { inspectorIconClass, inspectorIconStroke } from "@/lib/inspectorIconStyles";
import { SelectionAlignmentGrid } from "./SelectionAlignmentGrid";

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
  const childOrder = useEditorStore((s) => s.childOrder);
  const alignSelection = useEditorStore((s) => s.alignSelection);
  const alignSelectionToGrid = useEditorStore((s) => s.alignSelectionToGrid);
  const distributeSelection = useEditorStore((s) => s.distributeSelection);

  const canAlign = canAlignSelection(selectedIds, nodes, childOrder);
  const canDistribute = canDistributeSelection(selectedIds, nodes);

  const runAlign = (d: AlignDirection) => {
    if (!canAlign) return;
    alignSelection(d);
    onAction?.();
  };

  const runAlignGrid = (row: number, col: number) => {
    if (!canAlign) return;
    alignSelectionToGrid(row, col);
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
      {compact ? (
        <div
          className="grid grid-cols-3 gap-0.5 rounded-md border border-app-border bg-app-toolbar-well p-0.5"
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
              <Icon className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
            </button>
          ))}
        </div>
      ) : (
        <SelectionAlignmentGrid
          disabled={!canAlign}
          fullWidth
          selectionKey={selectedIds.join("\u0000")}
          onAlign={runAlignGrid}
        />
      )}

      <div className={cn("flex gap-1", compact && "mt-0.5")}>
        <button
          type="button"
          title="Distribute horizontal spacing"
          aria-label="Distribute horizontal spacing"
          disabled={!canDistribute}
          className={cn(btnClass, compact ? "h-7 flex-1" : "h-8 flex-1 gap-1.5 text-ui")}
          onClick={() => runDistribute("horizontal")}
        >
          <AlignHorizontalDistributeCenter className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
          {!compact ? <span>Distribute H</span> : null}
        </button>
        <button
          type="button"
          title="Distribute vertical spacing"
          aria-label="Distribute vertical spacing"
          disabled={!canDistribute}
          className={cn(btnClass, compact ? "h-7 flex-1" : "h-8 flex-1 gap-1.5 text-ui")}
          onClick={() => runDistribute("vertical")}
        >
          <AlignVerticalDistributeCenter className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
          {!compact ? <span>Distribute V</span> : null}
        </button>
      </div>
    </div>
  );
}
