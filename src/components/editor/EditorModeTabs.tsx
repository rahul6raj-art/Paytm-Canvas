"use client";

import { useEditorStore, type EditorMode } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";

const EDITOR_MODES: { id: EditorMode; label: string }[] = [
  { id: "design", label: "Style" },
  { id: "prototype", label: "Prototype" },
];

export function EditorModeTabs({
  className,
  stretch = false,
  variant = "pill",
}: {
  className?: string;
  /** Evenly divide tabs across the container (right panel header). */
  stretch?: boolean;
  /** `segmented` — inset pill tabs (left/right panel); `underline` — flat underline tabs; `pill` — compact toolbar. */
  variant?: "pill" | "underline" | "segmented";
}) {
  const editorMode = useEditorStore((s) => s.editorMode);
  const setEditorMode = useEditorStore((s) => s.setEditorMode);

  if (variant === "segmented") {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-1 rounded-xl bg-app-inset p-1",
          stretch && "w-full",
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
              "chrome-segmented-tab min-w-0 truncate border border-transparent",
              stretch && "text-center",
              editorMode === id
                ? "chrome-segmented-tab-active"
                : "text-app-muted hover:text-app-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

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
              "relative min-w-0 px-3.5 py-3 text-ui font-medium transition-colors",
              stretch && "flex-1 truncate text-center",
              editorMode === id
                ? "text-app-fg after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:rounded-full after:bg-app-fg"
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
              ? "bg-app-fg text-app-bg shadow-sm"
              : "text-app-muted hover:bg-app-hover hover:text-app-fg",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
