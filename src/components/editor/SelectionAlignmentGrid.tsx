"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { inspectorControlHeightClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";
import {
  LayerAlignBottomIcon,
  LayerAlignHorizontalCenterIcon,
  LayerAlignLeftIcon,
  LayerAlignRightIcon,
  LayerAlignTopIcon,
  SelectionAlignBottomLeftIcon,
  SelectionAlignBottomRightIcon,
  SelectionAlignTopLeftIcon,
  SelectionAlignTopRightIcon,
} from "./design-panel/InspectorSettingIcons";
import { EditorHintWrap } from "./EditorHoverHint";

const GRID_LABELS = [
  ["Align top left", "Align top", "Align top right"],
  ["Align left", "Align center", "Align right"],
  ["Align bottom left", "Align bottom", "Align bottom right"],
] as const;

const GRID_ICONS: readonly (readonly ComponentType<{ className?: string }>[])[] = [
  [SelectionAlignTopLeftIcon, LayerAlignTopIcon, SelectionAlignTopRightIcon],
  [LayerAlignLeftIcon, LayerAlignHorizontalCenterIcon, LayerAlignRightIcon],
  [SelectionAlignBottomLeftIcon, LayerAlignBottomIcon, SelectionAlignBottomRightIcon],
];

export function SelectionAlignmentGrid({
  disabled,
  selectionKey,
  fullWidth = false,
  onAlign,
}: {
  disabled?: boolean;
  /** Changes when selection changes — clears active cell highlight. */
  selectionKey?: string;
  /** Stretch grid to container width (inspector panel). */
  fullWidth?: boolean;
  onAlign: (row: number, col: number) => void;
}) {
  const [active, setActive] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    setActive(null);
  }, [selectionKey]);

  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-1 rounded-md border border-app-border bg-app-inset p-0.5",
        fullWidth ? "w-full" : "w-fit shrink-0",
      )}
      role="group"
      aria-label="Align selection"
    >
      {GRID_LABELS.map((rowLabels, row) =>
        rowLabels.map((label, col) => {
          const isActive = active?.row === row && active?.col === col;
          const Icon = GRID_ICONS[row]![col]!;
          return (
            <EditorHintWrap key={`${row}-${col}`} title={label} disabled={disabled}>
              <button
                type="button"
                disabled={disabled}
                aria-label={label}
                aria-pressed={isActive}
                onClick={() => {
                  setActive({ row, col });
                  onAlign(row, col);
                }}
                className={cn(
                  "flex min-w-0 items-center justify-center rounded-[5px] transition-colors disabled:opacity-40",
                  inspectorControlHeightClass,
                  fullWidth ? "w-full" : "w-7",
                  isActive
                    ? "bg-app-panel text-app-fg shadow-sm"
                    : "text-app-muted hover:bg-app-hover hover:text-app-fg",
                )}
              >
                <Icon />
              </button>
            </EditorHintWrap>
          );
        }),
      )}
    </div>
  );
}
