"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import {
  STROKE_ENDPOINT_ARROW_OPTIONS,
  STROKE_ENDPOINT_CAP_OPTIONS,
  strokeEndpointLabel,
  type StrokeEndpoint,
} from "@/lib/strokeEndpoints";
import { appFieldShellClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "../useAnchoredDropdown";
import { EndpointPreviewIcon } from "./StrokeEndpointIcons";

export function StrokeEndpointPicker({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: StrokeEndpoint;
  disabled?: boolean;
  onChange: (v: StrokeEndpoint) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useAnchoredDropdownPosition(anchorRef, open, 4, {
    viewportClamp: true,
    width: 200,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  const menu = open && mounted ? (
    <div
      ref={menuRef}
      role="listbox"
      className="fixed z-[120] overflow-hidden editor-floating-menu"
      style={anchoredMenuStyle(position)}
    >
      {STROKE_ENDPOINT_CAP_OPTIONS.map((opt) => (
        <EndpointMenuItem
          key={opt.value}
          option={opt}
          selected={value === opt.value}
          disabled={disabled}
          onPick={() => {
            onChange(opt.value);
            setOpen(false);
          }}
        />
      ))}
      <div className="my-1 border-t border-app-border-subtle" />
      {STROKE_ENDPOINT_ARROW_OPTIONS.map((opt) => (
        <EndpointMenuItem
          key={opt.value}
          option={opt}
          selected={value === opt.value}
          disabled={disabled}
          onPick={() => {
            onChange(opt.value);
            setOpen(false);
          }}
        />
      ))}
    </div>
  ) : null;

  return (
    <div className="min-w-0 flex-1">
      <div className="inspector-field-label">{label}</div>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          appFieldShellClass,
          "w-full gap-2 px-1.5 text-left hover:bg-app-hover disabled:opacity-40",
          open && "border-app-panel-edge ring-1 ring-app-panel-edge",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <EndpointPreviewIcon endpoint={value} className="shrink-0 text-app-muted" />
        <span className="min-w-0 flex-1 truncate">{strokeEndpointLabel(value)}</span>
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

function EndpointMenuItem({
  option,
  selected,
  disabled,
  onPick,
}: {
  option: { value: StrokeEndpoint; label: string };
  selected: boolean;
  disabled?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2 px-2 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover disabled:opacity-40",
        selected && "bg-app-inset",
      )}
    >
      <span className="flex w-4 shrink-0 justify-center">
        {selected ? <Check className="h-3.5 w-3.5 text-app-fg" strokeWidth={2} /> : null}
      </span>
      <EndpointPreviewIcon endpoint={option.value} className="shrink-0 text-app-muted" />
      <span>{option.label}</span>
    </button>
  );
}
