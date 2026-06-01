"use client";

import { formatShortcutLabel } from "@/lib/commands";

/** Shown when UI chrome is hidden so users can discover the restore shortcut. */
export function UiChromeHiddenHint() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2">
      <div className="rounded-full border border-white/[0.12] bg-[#2c2c2c]/90 px-3 py-1 text-[11px] font-medium text-[#c4c4c4] shadow-lg backdrop-blur-sm">
        Press{" "}
        <kbd className="rounded border border-white/[0.12] bg-black/30 px-1 font-mono text-[10px] text-white">
          {formatShortcutLabel("⌘.")}
        </kbd>{" "}
        to show UI
      </div>
    </div>
  );
}
