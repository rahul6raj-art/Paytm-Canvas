"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function InspectorSegmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex rounded-md border border-app-border bg-app-inset p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "h-6 flex-1 rounded-[5px] text-[11px] font-medium transition-colors disabled:opacity-40",
            value === opt.value
              ? "bg-app-panel text-app-fg shadow-sm"
              : "text-app-muted hover:text-app-fg",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function InspectorLabelRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <span className="shrink-0 text-[11px] font-medium text-app-subtle">{label}</span>
      <div className="min-w-0 flex-1 flex justify-end">{children}</div>
    </div>
  );
}

export function InspectorAddRow({
  label,
  onAdd,
  disabled,
}: {
  label: string;
  onAdd: () => void;
  disabled?: boolean;
}) {
  return (
    <InspectorLabelRow label={label}>
      <div className="flex items-center gap-1">
        <span className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-[11px] text-app-muted">
          None
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="flex h-6 w-6 items-center justify-center rounded border border-app-border bg-app-panel text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
          aria-label={`Add ${label}`}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </InspectorLabelRow>
  );
}
