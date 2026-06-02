"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "@/components/editor/useAnchoredDropdown";

const OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

function optionForPreference(preference: ThemePreference) {
  return OPTIONS.find((o) => o.id === preference) ?? OPTIONS[2]!;
}

type ThemeToggleProps = {
  className?: string;
  /** Icon button size — default matches editor toolbar controls. */
  size?: "sm" | "md";
};

export function ThemeToggle({ className, size = "md" }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const position = useAnchoredDropdownPosition(anchorRef, open, 4, {
    viewportClamp: true,
    width: 44,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);

  useEffect(() => setMounted(true), []);

  const active = optionForPreference(preference);
  const TriggerIcon = active.icon;
  const btnSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        aria-label="Appearance"
        className="fixed z-[120] flex flex-col gap-0.5 rounded-lg border border-app-border bg-app-surface p-1 shadow-lg"
        style={anchoredMenuStyle(position)}
      >
        {OPTIONS.map(({ id, label, icon: Icon }) => {
          const selected = preference === id;
          return (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              title={label}
              aria-label={label}
              onClick={() => {
                setPreference(id);
                setOpen(false);
              }}
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                selected
                  ? "bg-app-hover text-app-fg"
                  : "text-app-muted hover:bg-app-hover hover:text-app-fg",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {selected ? (
                <Check
                  className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-accent"
                  strokeWidth={3}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <div className={cn("relative shrink-0", className)} ref={anchorRef}>
        <button
          type="button"
          aria-label="Appearance"
          aria-haspopup="menu"
          aria-expanded={open}
          title={`Appearance: ${active.label}`}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex items-center justify-center rounded-md border border-app-border bg-app-toolbar-well text-app-muted transition-colors hover:border-app-border hover:bg-app-hover hover:text-app-fg",
            open && "border-accent/40 bg-accent/10 text-app-fg",
            btnSize,
          )}
        >
          <TriggerIcon className={iconSize} strokeWidth={1.75} />
        </button>
      </div>
      {menu && mounted ? createPortal(menu, document.body) : null}
    </>
  );
}
