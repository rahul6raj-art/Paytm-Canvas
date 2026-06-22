"use client";

import type { ReactNode } from "react";
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
  /** When true, ellipsize long labels in the pill (default shows full label). */
  truncateLabel?: boolean;
  /** Optional trailing control per option (e.g. “+ Add key”). */
  renderOptionTrailing?: (option: PillSelectOption) => ReactNode;
  /** Footer below options (e.g. “Manage keys”). */
  menuFooter?: ReactNode;
};

function PillSelectOptionRow({
  option,
  selected,
  onSelect,
  trailing,
}: {
  option: PillSelectOption;
  selected: boolean;
  onSelect: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1 pr-1",
        option.hint ? "items-start" : "items-center",
      )}
    >
      <button
        type="button"
        role="option"
        aria-selected={selected}
        disabled={option.disabled}
        className={cn(
          "editor-menu-dropdown-item min-w-0 flex-1 !justify-start",
          option.hint ? "!items-start" : "!items-center",
          selected && "bg-app-inset font-medium text-app-fg",
          option.disabled && "cursor-not-allowed opacity-40",
        )}
        onClick={() => {
          if (option.disabled) return;
          onSelect();
        }}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">{option.label}</span>
          {option.hint ? (
            <span className="block truncate text-ui font-normal text-app-subtle">{option.hint}</span>
          ) : null}
        </span>
      </button>
      {trailing ? <div className="shrink-0 self-center">{trailing}</div> : null}
    </div>
  );
}

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
  truncateLabel = false,
  renderOptionTrailing,
  menuFooter,
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
        data-editor-shell
        className={cn(
          "editor-floating-menu editor-menu-dropdown fixed min-w-[260px] overflow-y-auto overscroll-contain border border-app-border bg-app-surface shadow-xl thin-scroll",
          menuZClass,
        )}
        style={anchoredMenuStyle(position)}
      >
        {options
          ? options.map((o) => (
              <PillSelectOptionRow
                key={o.value || "__empty"}
                option={o}
                selected={value === o.value}
                trailing={renderOptionTrailing?.(o)}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              />
            ))
          : null}
        {optionGroups
          ? optionGroups.map((g) => (
              <div key={g.label}>
                <p className="section-heading">{g.label}</p>
                {g.options.map((o) => (
                  <PillSelectOptionRow
                    key={o.value}
                    option={o}
                    selected={value === o.value}
                    trailing={renderOptionTrailing?.(o)}
                    onSelect={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            ))
          : null}
        {menuFooter ? (
          <>
            <div className="my-1 border-t border-app-border-subtle" />
            {menuFooter}
          </>
        ) : null}
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
        aria-label={`${label}: ${display}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex min-h-[var(--pill-control-min-height,2rem)] items-center gap-2 rounded-full border border-app-border-subtle bg-app-inset py-1.5 pl-2.5 pr-2 text-ui font-medium text-app-fg transition-colors",
          truncateLabel ? "min-w-0 max-w-full" : "shrink-0",
          "hover:border-app-border hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-app-border bg-app-hover",
          className,
        )}
      >
        <Icon className="h-4 w-4 shrink-0 text-app-muted" strokeWidth={2} />
        <span className={truncateLabel ? "min-w-0 max-w-[100px] truncate" : "whitespace-nowrap"}>
          {display}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-app-subtle" strokeWidth={2.5} />
      </button>
      {menu && mounted ? createPortal(menu, document.body) : null}
    </>
  );
}
