"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { formatShortcutLabel } from "@/lib/commands";
import type { ResolvedMenuItem } from "@/lib/editorMenuConfig";

export function EditorMenuDropdown({
  open,
  items,
  onClose,
  align = "left",
}: {
  open: boolean;
  items: (ResolvedMenuItem | "divider")[];
  onClose: () => void;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        "absolute top-full z-[60] mt-0.5 min-w-[220px] max-h-[min(70vh,480px)] overflow-y-auto rounded-md border border-app-border bg-app-surface py-1 shadow-xl thin-scroll",
        align === "right" ? "right-0" : "left-0",
      )}
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
              "flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-[11px]",
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
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-app-subtle">{shortcut}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
