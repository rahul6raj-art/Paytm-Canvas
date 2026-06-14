"use client";

import type { CrossAxisAlign, PrimaryAxisAlign } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";

const AXIS_STOPS = ["start", "center", "end"] as const;

function cellActive(
  primary: PrimaryAxisAlign | undefined,
  counter: CrossAxisAlign | undefined,
  row: number,
  col: number,
): boolean {
  const p = primary ?? "start";
  const c = counter ?? "start";
  if (!AXIS_STOPS.includes(p as (typeof AXIS_STOPS)[number])) return false;
  if (!AXIS_STOPS.includes(c as (typeof AXIS_STOPS)[number])) return false;
  return AXIS_STOPS[row] === c && AXIS_STOPS[col] === p;
}

/** Active alignment glyph — three bars (Figma-style center indicator). */
function ActiveAlignGlyph({ horizontal }: { horizontal: boolean }) {
  const bars = horizontal
    ? [6, 10, 14].map((y) => (
        <rect key={y} x="4.5" y={y - 0.6} width="7" height="1.2" rx="0.6" fill="currentColor" />
      ))
    : [5.5, 8, 10.5].map((x) => (
        <rect key={x} x={x - 0.6} y="4.5" width="1.2" height="7" rx="0.6" fill="currentColor" />
      ));
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none">
      {bars}
    </svg>
  );
}

export function AutoLayoutAlignmentGrid({
  layoutHorizontal,
  primaryAxisAlign,
  counterAxisAlign,
  disabled,
  onChange,
}: {
  layoutHorizontal: boolean;
  primaryAxisAlign?: PrimaryAxisAlign;
  counterAxisAlign?: CrossAxisAlign;
  disabled?: boolean;
  onChange: (primary: PrimaryAxisAlign, counter: CrossAxisAlign) => void;
}) {
  return (
    <div
      className="grid shrink-0 grid-cols-3 gap-1 rounded-md border border-app-border bg-app-inset p-1"
      role="group"
      aria-label="Alignment"
    >
      {AXIS_STOPS.map((counter, row) =>
        AXIS_STOPS.map((primary, col) => {
          const active = cellActive(primaryAxisAlign, counterAxisAlign, row, col);
          return (
            <button
              key={`${row}-${col}`}
              type="button"
              disabled={disabled}
              title={`${primary} / ${counter}`}
              aria-label={`Align ${primary} on primary axis, ${counter} on counter axis`}
              onClick={() => onChange(primary, counter)}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded transition-colors disabled:opacity-40",
                active
                  ? "bg-accent/20 text-accent"
                  : "text-app-subtle hover:bg-app-hover hover:text-app-muted",
              )}
            >
              {active ? (
                <ActiveAlignGlyph horizontal={layoutHorizontal} />
              ) : (
                <span className="h-1 w-1 rounded-full bg-current opacity-60" />
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
