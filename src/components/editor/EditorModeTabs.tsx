"use client";

import { useEditorStore, type EditorMode } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";

const EDITOR_MODES: { id: EditorMode; label: string }[] = [
  { id: "design", label: "Design" },
  { id: "prototype", label: "Prototype" },
  { id: "inspect", label: "Inspect" },
];

export function EditorModeTabs({
  className,
  stretch = false,
  variant = "pill",
}: {
  className?: string;
  /** Evenly divide tabs across the container (right panel header). */
  stretch?: boolean;
  /** `underline` — flat tabs for the right panel; `pill` — boxed toolbar style. */
  variant?: "pill" | "underline";
}) {
  const editorMode = useEditorStore((s) => s.editorMode);
  const setEditorMode = useEditorStore((s) => s.setEditorMode);

  if (variant === "underline") {
    return (
      <div
        className={cn("flex items-stretch border-b border-app-panel-edge", stretch && "w-full", className)}
        role="tablist"
        aria-label="Editor mode"
      >
        {EDITOR_MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={editorMode === id}
            onClick={() => setEditorMode(id)}
            className={cn(
              "relative min-w-0 px-3 py-2.5 text-ui font-medium transition-colors",
              stretch && "flex-1 truncate text-center",
              editorMode === id
                ? "text-app-fg after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:rounded-full after:bg-accent"
                : "text-app-subtle hover:text-app-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-px rounded-lg border border-app-border-subtle bg-app-toolbar-well p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className,
      )}
      role="tablist"
      aria-label="Editor mode"
    >
      {EDITOR_MODES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={editorMode === id}
          onClick={() => setEditorMode(id)}
          className={cn(
            "min-w-0 rounded-[6px] px-2 py-1 text-ui font-medium transition-colors",
            stretch && "flex-1 truncate",
            editorMode === id
              ? "bg-[rgba(13,153,255,0.22)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              : "text-app-muted hover:bg-app-hover hover:text-app-fg",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
