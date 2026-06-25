"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import {
  STROKE_ENDPOINT_ARROW_OPTIONS,
  STROKE_ENDPOINT_CAP_OPTIONS,
  strokeEndpointLabel,
  type StrokeEndpoint,
} from "@/lib/strokeEndpoints";
import { appFieldShellClass } from "@/lib/appFieldStyles";
import {
  editorMenuDividerClass,
  editorMenuItemClass,
  editorMenuPanelScrollClass,
} from "@/lib/editorMenuChrome";
import {
  inspectorFieldIconSlotClass,
  inspectorIconClass,
  inspectorIconStroke,
} from "@/lib/inspectorIconStyles";
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
    maxHeight: 420,
    width: 200,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pick = (next: StrokeEndpoint) => {
    onChange(next);
    setOpen(false);
  };

  const menu = open && mounted ? (
    <div
      ref={menuRef}
      role="listbox"
      aria-label={label}
      data-editor-shell
      className={cn(
        editorMenuPanelScrollClass,
        "pointer-events-auto z-[120] min-w-[200px] border border-app-border bg-app-surface py-1 shadow-xl thin-scroll",
      )}
      style={anchoredMenuStyle(position)}
    >
      {STROKE_ENDPOINT_CAP_OPTIONS.map((opt) => (
        <EndpointMenuItem
          key={opt.value}
          option={opt}
          selected={value === opt.value}
          disabled={disabled}
          onPick={() => pick(opt.value)}
        />
      ))}
      <div className={editorMenuDividerClass} role="separator" />
      {STROKE_ENDPOINT_ARROW_OPTIONS.map((opt) => (
        <EndpointMenuItem
          key={opt.value}
          option={opt}
          selected={value === opt.value}
          disabled={disabled}
          onPick={() => pick(opt.value)}
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
          "w-full gap-1.5 px-1.5 text-left hover:bg-app-hover disabled:opacity-40",
          open && "border-app-panel-edge ring-1 ring-app-panel-edge",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={cn(inspectorFieldIconSlotClass, "border-r border-app-border px-1")}>
          <EndpointPreviewIcon endpoint={value} className="shrink-0 text-app-muted" />
        </span>
        <span className="min-w-0 flex-1 truncate text-app-fg">{strokeEndpointLabel(value)}</span>
        <ChevronDown
          className={cn(
            inspectorIconClass,
            "mr-0.5 shrink-0 text-app-muted transition-transform",
            open && "rotate-180",
          )}
          strokeWidth={inspectorIconStroke}
          aria-hidden
        />
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
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onPick();
      }}
      className={cn(
        editorMenuItemClass,
        "!justify-start gap-2.5 px-2.5 py-1.5",
        selected && "bg-app-inset font-medium text-app-fg",
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {selected ? (
          <Check className={cn(inspectorIconClass, "text-app-fg")} strokeWidth={inspectorIconStroke} />
        ) : null}
      </span>
      <EndpointPreviewIcon endpoint={option.value} className="shrink-0 text-app-muted" />
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
    </button>
  );
}
