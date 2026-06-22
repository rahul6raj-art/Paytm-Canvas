"use client";

import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { appFieldClass, appFieldClassCompact, inspectorSegmentedHeightClass } from "@/lib/appFieldStyles";
import {
  inspectorFieldIconButtonClass,
  inspectorHeaderActionBtnClass,
  inspectorIconClass,
  inspectorIconStroke,
  inspectorLucideProps,
} from "@/lib/inspectorIconStyles";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";

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
        inspectorSegmentedHeightClass,
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
            "h-full min-h-0 shrink-0 rounded-[5px] text-ui font-medium transition-colors disabled:opacity-40",
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

/** Inset `<select>` with a chevron (native arrow hidden via `appearance-none`). */
export function InspectorInsetSelect({
  value,
  onChange,
  disabled,
  children,
  "aria-label": ariaLabel,
  className,
  shellClassName,
  compact = true,
}: {
  value: string;
  onChange: (ev: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: ReactNode;
  "aria-label"?: string;
  className?: string;
  shellClassName?: string;
  compact?: boolean;
}) {
  const shell = compact ? appFieldClassCompact : appFieldClass;
  return (
    <div className={cn(shell, "relative", shellClassName)}>
      <select
        disabled={disabled}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        className={cn(
          "h-full w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent py-0 pl-0 pr-6 text-ui text-app-field-fg focus:outline-none disabled:cursor-not-allowed",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          inspectorIconClass,
          "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-app-muted",
        )}
        strokeWidth={inspectorIconStroke}
        aria-hidden
      />
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

/** Icon/action button with Figma-style hover hint instead of native title. */
export function InspectorHintIconButton({
  title,
  disabled,
  onClick,
  className,
  pressed,
  children,
  buttonRef,
  hintSide = "top",
  ...rest
}: {
  title: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  pressed?: boolean;
  children: ReactNode;
  buttonRef?: Ref<HTMLButtonElement>;
  hintSide?: "top" | "bottom" | "left" | "right";
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "children">) {
  return (
    <EditorHintWrap title={title} disabled={disabled} hintSide={hintSide}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={title}
        aria-pressed={pressed}
        onClick={onClick}
        className={className}
        {...rest}
      >
        {children}
      </button>
    </EditorHintWrap>
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
    <EditorHintWrap title={title} disabled={disabled}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={title}
        onClick={onClick}
        className={cn(inspectorHeaderActionBtnClass, className)}
      >
        <Plus {...inspectorLucideProps()} />
      </button>
    </EditorHintWrap>
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
          className={inspectorFieldIconButtonClass}
          aria-label={`Add ${label}`}
        >
          <Plus className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
        </button>
      </div>
    </InspectorLabelRow>
  );
}
