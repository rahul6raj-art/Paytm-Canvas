"use client";

import { Moon, Sun } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import type { CanvasColorMode } from "@/lib/designTokens";
import { cn } from "@/lib/utils";

const MODES: { id: CanvasColorMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

type CanvasColorModeToggleProps = {
  className?: string;
  compact?: boolean;
};

export function CanvasColorModeToggle({ className, compact = false }: CanvasColorModeToggleProps) {
  const mode = useEditorStore((s) => s.canvasColorMode);
  const setMode = useEditorStore((s) => s.setCanvasColorMode);

  return (
    <div
      className={cn(
        "flex rounded-lg border border-app-border bg-app-inset p-0.5",
        className,
      )}
      role="group"
      aria-label="Canvas color mode"
    >
      {MODES.map(({ id, label, icon: Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => setMode(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-ui font-medium transition-colors",
              compact ? "py-0.5" : "py-1",
              active
                ? "bg-app-panel text-app-fg shadow-sm"
                : "text-app-subtle hover:text-app-fg",
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
            {!compact ? <span>{label}</span> : <span className="sr-only">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
