"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { formatShortcutLabel } from "@/lib/commands";
import {
  SHORTCUT_ALIGN,
  SHORTCUT_CANVAS,
  SHORTCUT_EDITING,
  SHORTCUT_OBJECT,
  SHORTCUT_TOOLS,
  SHORTCUT_VIEW,
  SHORTCUT_ZOOM,
  type ShortcutRow,
} from "@/lib/keyboardShortcutReference";
import { cn } from "@/lib/utils";

function Section({ title, rows }: { title: string; rows: ShortcutRow[] }) {
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-app-subtle">
        {title}
      </h3>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li
            key={`${title}-${r.keys}-${r.label}`}
            className="flex items-baseline justify-between gap-4 text-[12px] leading-snug"
          >
            <span className="min-w-0 text-app-muted">
              {r.label}
              {r.note ? (
                <span className="block text-[10px] text-app-subtle">{r.note}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-right text-[11px] tabular-nums text-app-subtle">
              {r.keys ? formatShortcutLabel(r.keys) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ShortcutOverlay() {
  const open = useEditorStore((s) => s.shortcutOverlayOpen);
  const setOpen = useEditorStore((s) => s.setShortcutOverlayOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className="max-h-[min(80vh,640px)] w-full max-w-lg overflow-y-auto rounded-lg border border-app-border bg-app-panel/95 p-4 shadow-2xl backdrop-blur-md"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-white">Keyboard shortcuts</h2>
            <p className="mt-0.5 text-[11px] text-app-subtle">
              Figma-style bindings · ⌘ = Ctrl on Windows / Linux
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={cn(
              "rounded-md border border-app-border px-2 py-1 text-[11px] font-medium text-app-muted",
              "hover:bg-app-hover hover:text-app-fg",
            )}
          >
            Close
          </button>
        </div>
        <div className="columns-1 sm:columns-2 sm:gap-6">
          <div className="break-inside-avoid">
            <Section title="Tools" rows={SHORTCUT_TOOLS} />
            <Section title="Object" rows={SHORTCUT_OBJECT} />
            <Section title="Align" rows={SHORTCUT_ALIGN} />
          </div>
          <div className="break-inside-avoid">
            <Section title="Zoom & frames" rows={SHORTCUT_ZOOM} />
            <Section title="View" rows={SHORTCUT_VIEW} />
            <Section title="Editing" rows={SHORTCUT_EDITING} />
            <Section title="Canvas" rows={SHORTCUT_CANVAS} />
          </div>
        </div>
      </div>
    </div>
  );
}
