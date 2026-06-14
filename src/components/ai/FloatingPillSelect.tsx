"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, type LucideIcon } from "lucide-react";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "@/components/editor/useAnchoredDropdown";
import { cn } from "@/lib/utils";

export type PillSelectOption = { value: string; label: string; hint?: string; disabled?: boolean };

export type PillSelectGroup = { label: string; options: PillSelectOption[] };

type Props = {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options?: PillSelectOption[];
  optionGroups?: PillSelectGroup[];
  menuZClass?: string;
  className?: string;
};

export function FloatingPillSelect({
  icon: Icon,
  label,
  value,
  onChange,
  disabled,
  options,
  optionGroups,
  menuZClass = "z-[500]",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const flatOptions = options ?? optionGroups?.flatMap((g) => g.options) ?? [];
  const display = flatOptions.find((o) => o.value === value)?.label ?? label;

  const position = useAnchoredDropdownPosition(buttonRef, open, 6, {
    viewportClamp: true,
    maxHeight: 320,
    width: 260,
    remeasureKey: value,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), buttonRef, menuRef);

  useEffect(() => setMounted(true), []);

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label={label}
        className={cn(
          "fixed w-[260px] overflow-y-auto overscroll-contain rounded-xl border border-app-border bg-app-panel py-1 shadow-2xl",
          menuZClass,
        )}
        style={{ ...anchoredMenuStyle(position), zIndex: 500 }}
      >
        {options
          ? options.map((o) => (
              <button
                key={o.value || "__empty"}
                type="button"
                role="option"
                aria-selected={value === o.value}
                disabled={o.disabled}
                className={cn(
                  "block w-full px-3 py-2 text-left text-ui transition-colors",
                  value === o.value ? "bg-app-hover font-medium text-app-fg" : "text-app-fg hover:bg-app-hover",
                  o.disabled && "cursor-not-allowed opacity-40",
                )}
                onClick={() => {
                  if (o.disabled) return;
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className="block truncate">{o.label}</span>
                {o.hint ? <span className="block truncate text-ui text-app-subtle">{o.hint}</span> : null}
              </button>
            ))
          : null}
        {optionGroups
          ? optionGroups.map((g) => (
              <div key={g.label}>
                <p className="px-3 pb-0.5 pt-2 section-heading">
                  {g.label}
                </p>
                {g.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={value === o.value}
                    disabled={o.disabled}
                    className={cn(
                      "block w-full px-3 py-2 text-left text-ui transition-colors",
                      value === o.value ? "bg-app-hover font-medium text-app-fg" : "text-app-fg hover:bg-app-hover",
                      o.disabled && "cursor-not-allowed opacity-40",
                    )}
                    onClick={() => {
                      if (o.disabled) return;
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <span className="block truncate">{o.label}</span>
                    {o.hint ? (
                      <span className="block truncate text-ui text-app-subtle">{o.hint}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          : null}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 rounded-full border border-app-border bg-app-panel py-1 pl-2.5 pr-1.5 text-ui font-medium text-app-fg shadow-sm transition-colors",
          "hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-accent/40 bg-app-hover",
          className,
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-app-muted" strokeWidth={2} />
        <span className="max-w-[100px] truncate">{display === label ? label : display}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-app-subtle" strokeWidth={2.5} />
      </button>
      {menu && mounted ? createPortal(menu, document.body) : null}
    </>
  );
}
