"use client";

import { Search } from "lucide-react";
import { formatShortcutLabel } from "@/lib/commands";
import { useEditorStore } from "@/stores/useEditorStore";

export function EditorCommandSearchButton({ className }: { className?: string }) {
  const setCommandMenuOpen = useEditorStore((s) => s.setCommandMenuOpen);

  return (
    <button
      type="button"
      onClick={() => setCommandMenuOpen(true)}
      title="Search commands"
      className={
        className ??
        "flex h-6 w-full max-w-[240px] items-center gap-1.5 rounded-md border border-app-border bg-app-toolbar-well px-2 text-ui font-medium text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
      }
    >
      <Search className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} />
      <span className="min-w-0 truncate">Search commands</span>
      <span className="hidden shrink-0 text-ui tabular-nums text-app-subtle lg:inline">
        {formatShortcutLabel("⌘K")}
      </span>
    </button>
  );
}
