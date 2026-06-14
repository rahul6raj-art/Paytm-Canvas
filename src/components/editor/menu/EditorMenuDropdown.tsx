"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { formatShortcutLabel } from "@/lib/commands";
import type { ResolvedMenuItem } from "@/lib/editorMenuConfig";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "../useAnchoredDropdown";

export function EditorMenuDropdown({
  open,
  items,
  onClose,
  anchorRef,
}: {
  open: boolean;
  items: (ResolvedMenuItem | "divider")[];
  onClose: () => void;
  anchorRef: RefObject<HTMLButtonElement | null>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useAnchoredDropdownPosition(anchorRef, open, 2, {
    viewportClamp: true,
    maxHeight: 480,
    width: 240,
    remeasureKey: items.length,
  });
  useDismissAnchoredDropdown(open, onClose, anchorRef, menuRef);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={cn(
        "fixed z-[120] min-w-[220px] overflow-y-auto rounded-md border border-app-border bg-app-surface py-1 shadow-xl thin-scroll",
      )}
      style={anchoredMenuStyle(position)}
    >
      {items.map((item, i) => {
        if (item === "divider") {
          return <div key={`d-${i}`} className="my-1 border-t border-app-border" role="separator" />;
        }
        const shortcut = item.shortcut ? formatShortcutLabel(item.shortcut) : "";
        return (
          <button
            key={`${item.label}-${i}`}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={cn(
              "flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-ui",
              item.disabled
                ? "cursor-not-allowed text-app-subtle"
                : "text-app-fg hover:bg-app-hover",
            )}
            onClick={() => {
              if (item.disabled) return;
              item.run();
              onClose();
            }}
          >
            <span>{item.label}</span>
            {shortcut ? (
              <span className="shrink-0 font-mono text-ui tabular-nums text-app-subtle">{shortcut}</span>
            ) : null}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
