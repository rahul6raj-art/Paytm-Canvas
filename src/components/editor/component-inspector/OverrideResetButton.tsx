"use client";

import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  visible: boolean;
  label?: string;
  disabled?: boolean;
  onReset: () => void;
  className?: string;
};

/** Figma-style per-property override reset (diamond/reset icon). */
export function OverrideResetButton({
  visible,
  label = "Reset override",
  disabled,
  onReset,
  className,
}: Props) {
  if (!visible) return null;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onReset();
      }}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-amber-300/90 hover:bg-amber-500/15 hover:text-amber-200 disabled:opacity-40",
        className,
      )}
    >
      <RotateCcw className="h-3 w-3" strokeWidth={2} />
    </button>
  );
}
