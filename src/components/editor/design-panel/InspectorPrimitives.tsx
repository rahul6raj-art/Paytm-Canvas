"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { inspectorControlHeightClass } from "@/lib/appFieldStyles";
import {
  inspectorHeaderActionBtnClass,
  inspectorIconClass,
  inspectorIconStroke,
  inspectorLucideProps,
} from "@/lib/inspectorIconStyles";
import type { ReactNode, Ref } from "react";

export function InspectorSegmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  scrollable,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  /** Allow horizontal scroll when many segments (e.g. fill types). */
  scrollable?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-app-border bg-app-inset p-0.5",
        inspectorControlHeightClass,
        scrollable && "thin-scroll gap-0.5 overflow-x-auto",
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "h-6 shrink-0 rounded-[5px] text-ui font-medium transition-colors disabled:opacity-40",
            scrollable ? "min-w-[3.5rem] px-2" : "flex-1",
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
      <span className="shrink-0 inspector-field-label mb-0">{label}</span>
      <div className="min-w-0 flex-1 flex justify-end">{children}</div>
    </div>
  );
}

export function InspectorSectionAddButton({
  title,
  disabled,
  onClick,
  buttonRef,
  className,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  className?: string;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(inspectorHeaderActionBtnClass, className)}
    >
      <Plus {...inspectorLucideProps()} />
    </button>
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
        <span className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-ui text-app-muted">
          None
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="flex h-7 w-7 items-center justify-center rounded border border-app-border bg-app-panel text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
          aria-label={`Add ${label}`}
        >
          <Plus className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
        </button>
      </div>
    </InspectorLabelRow>
  );
}
