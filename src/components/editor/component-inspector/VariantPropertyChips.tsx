"use client";

import { cn } from "@/lib/utils";

type Props = {
  axes: string[];
  className?: string;
};

/** Figma-style property axis chips shown in variant inspector sections. */
export function VariantPropertyChips({ axes, className }: Props) {
  if (axes.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)} data-testid="variant-property-chips">
      {axes.map((axis) => (
        <span
          key={axis}
          className="rounded-md border border-violet-300/30 bg-violet-300/12 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-100"
        >
          {axis}
        </span>
      ))}
    </div>
  );
}
