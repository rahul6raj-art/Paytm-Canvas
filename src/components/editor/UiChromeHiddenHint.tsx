"use client";

import { formatShortcutLabel } from "@/lib/commands";

/** Shown when UI chrome is hidden so users can discover the restore shortcut. */
export function UiChromeHiddenHint() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2">
      <div className="rounded-full border border-app-border bg-app-panel/90 px-3 py-1 text-ui font-medium text-app-muted shadow-lg backdrop-blur-sm">
        Press{" "}
        <kbd className="rounded border border-app-border bg-app-toolbar-well px-1 font-mono text-ui text-white">
          {formatShortcutLabel("⌘.")}
        </kbd>{" "}
        to show UI
      </div>
    </div>
  );
}
