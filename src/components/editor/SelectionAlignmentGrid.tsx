"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const GRID_LABELS = [
  ["Align top left", "Align top", "Align top right"],
  ["Align left", "Align center", "Align right"],
  ["Align bottom left", "Align bottom", "Align bottom right"],
] as const;

/** Mini frame + anchor dot for this grid cell (Figma-style align picker). */
function SelectionAlignCellIcon({ row, col }: { row: number; col: number }) {
  const cx = col === 0 ? 5 : col === 1 ? 8 : 11;
  const cy = row === 0 ? 5 : row === 1 ? 8 : 11;
  const center = row === 1 && col === 1;
  if (center) {
    return (
      <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none">
        <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.25" />
        {[6, 8, 10].map((y) => (
          <rect key={y} x="5.5" y={y - 0.55} width="5" height="1.1" rx="0.55" fill="currentColor" />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none">
      <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <circle cx={cx} cy={cy} r="1.35" fill="currentColor" />
    </svg>
  );
}

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
        "grid grid-cols-3 gap-1 rounded-md border border-app-border bg-app-inset p-1",
        fullWidth ? "w-full" : "w-fit shrink-0",
      )}
      role="group"
      aria-label="Align selection"
    >
      {GRID_LABELS.map((rowLabels, row) =>
        rowLabels.map((label, col) => {
          const isActive = active?.row === row && active?.col === col;
          return (
            <button
              key={`${row}-${col}`}
              type="button"
              disabled={disabled}
              title={label}
              aria-label={label}
              aria-pressed={isActive}
              onClick={() => {
                setActive({ row, col });
                onAlign(row, col);
              }}
              className={cn(
                "group flex h-5 items-center justify-center rounded transition-colors disabled:opacity-40",
                fullWidth ? "w-full min-w-0" : "w-5",
                isActive
                  ? "bg-accent/20 text-accent"
                  : "text-app-subtle hover:bg-app-hover hover:text-app-muted",
              )}
            >
              {isActive ? (
                <SelectionAlignCellIcon row={row} col={col} />
              ) : (
                <>
                  <span className="h-1 w-1 rounded-full bg-current opacity-60 group-hover:hidden" />
                  <span className="hidden group-hover:block">
                    <SelectionAlignCellIcon row={row} col={col} />
                  </span>
                </>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
