"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { StrokeLinecap, StrokeLinejoin } from "@/lib/stroke";
import { svgNativeLinecap } from "@/lib/stroke";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";

function IconBtn({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <EditorHintWrap title={title} disabled={disabled}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex h-6 flex-1 items-center justify-center rounded border transition-colors disabled:opacity-40",
          active
            ? "border-accent/45 bg-accent/15 text-app-fg"
            : "border-app-border text-app-muted hover:bg-app-hover hover:text-app-fg",
        )}
      >
        {children}
      </button>
    </EditorHintWrap>
  );
}

export function StrokeLinecapControl({
  value,
  disabled,
  onChange,
}: {
  value: StrokeLinecap;
  disabled?: boolean;
  onChange: (v: StrokeLinecap) => void;
}) {
  const caps: { v: StrokeLinecap; title: string }[] = [
    { v: "butt", title: "Butt cap" },
    { v: "round", title: "Round cap" },
    { v: "square", title: "Square cap" },
  ];
  return (
    <div className="flex gap-0.5">
      {caps.map(({ v, title }) => (
        <IconBtn key={v} active={value === v} disabled={disabled} title={title} onClick={() => onChange(v)}>
          <svg width="20" height="10" viewBox="0 0 20 10" aria-hidden className="text-current">
            <line
              x1="2"
              y1="5"
              x2="18"
              y2="5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap={svgNativeLinecap(v)}
            />
          </svg>
        </IconBtn>
      ))}
    </div>
  );
}

export function StrokeLinejoinControl({
  value,
  disabled,
  onChange,
}: {
  value: StrokeLinejoin;
  disabled?: boolean;
  onChange: (v: StrokeLinejoin) => void;
}) {
  const joins: { v: StrokeLinejoin; title: string; d: string }[] = [
    {
      v: "miter",
      title: "Miter join",
      d: "M4 8 L10 2 L16 8",
    },
    {
      v: "round",
      title: "Round join",
      d: "M4 8 Q10 2 16 8",
    },
    {
      v: "bevel",
      title: "Bevel join",
      d: "M4 8 L10 4 L16 8",
    },
  ];
  return (
    <div className="flex gap-0.5">
      {joins.map(({ v, title, d }) => (
        <IconBtn key={v} active={value === v} disabled={disabled} title={title} onClick={() => onChange(v)}>
          <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden className="text-current">
            <path
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin={v}
              strokeLinecap="round"
            />
          </svg>
        </IconBtn>
      ))}
    </div>
  );
}

export function StrokeWidthProfilePreview({
  flipped,
  profile = "uniform",
}: {
  flipped?: boolean;
  profile?: "uniform" | "taper";
}) {
  return (
    <svg
      width="48"
      height="12"
      viewBox="0 0 48 12"
      aria-hidden
      className={cn("text-app-fg", flipped && "scale-x-[-1]")}
    >
      {profile === "uniform" ? (
        <line x1="4" y1="6" x2="44" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path
          d="M 4 6 Q 24 2 44 6 Q 24 10 4 6 Z"
          fill="currentColor"
          stroke="none"
        />
      )}
    </svg>
  );
}
