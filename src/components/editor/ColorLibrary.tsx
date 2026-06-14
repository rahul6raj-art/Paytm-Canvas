"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { isColorValue } from "@/lib/designTokens";
import { cn } from "@/lib/utils";
import { getColorDesignTokens } from "./LibraryColorPickerMenu";

type ColorLibraryView = "grid" | "list";

type ColorLibraryProps = {
  /** Compact grid for the inspector; roomier layout in the styles panel. */
  variant?: "compact" | "panel";
  className?: string;
};

export function ColorLibrary({ variant = "panel", className }: ColorLibraryProps) {
  const designTokens = useEditorStore((s) => s.designTokens);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const applyTokenToSelection = useEditorStore((s) => s.applyTokenToSelection);
  const [view, setView] = useState<ColorLibraryView>("grid");

  const colors = useMemo(() => getColorDesignTokens(designTokens), [designTokens]);

  const activeTokenId = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const n = nodes[selectedIds[0]!];
    return n?.fillTokenId ?? null;
  }, [selectedIds, nodes]);

  if (colors.length === 0) return null;

  const canApply = selectedIds.length > 0;
  const gridClass =
    variant === "compact"
      ? "grid grid-cols-6 gap-1"
      : "grid grid-cols-4 gap-1.5 sm:grid-cols-5";

  const applyButtonClass = (active: boolean) =>
    cn(
      canApply ? "cursor-pointer hover:bg-app-hover" : "cursor-not-allowed opacity-50",
      active && "bg-[rgba(24,160,251,0.12)] ring-1 ring-accent/40",
    );

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-ui font-medium text-app-subtle">Color library</span>
        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center rounded border border-app-border bg-app-inset p-0.5"
            role="group"
            aria-label="Color library view"
          >
            <button
              type="button"
              title="Grid view"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded transition-colors",
                view === "grid"
                  ? "bg-app-panel text-app-fg shadow-sm"
                  : "text-app-subtle hover:text-app-fg",
              )}
            >
              <LayoutGrid className="h-3 w-3" strokeWidth={2} />
            </button>
            <button
              type="button"
              title="List view with names"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded transition-colors",
                view === "list"
                  ? "bg-app-panel text-app-fg shadow-sm"
                  : "text-app-subtle hover:text-app-fg",
              )}
            >
              <List className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>
          {!canApply ? (
            <span className="text-ui text-app-subtle">Select a layer</span>
          ) : (
            <span className="text-ui text-app-subtle">Click to apply</span>
          )}
        </div>
      </div>

      {view === "grid" ? (
        <div className={gridClass}>
          {colors.map((token) => {
            const v = token.value;
            if (!isColorValue(v)) return null;
            const active = activeTokenId === token.id;
            return (
              <button
                key={token.id}
                type="button"
                disabled={!canApply}
                title={`${token.name} · ${v.hex}`}
                onClick={() => applyTokenToSelection(token.id)}
                className={cn(
                  "group relative aspect-square min-h-[28px] rounded-md border transition-all",
                  canApply ? "cursor-pointer hover:scale-105 hover:shadow-md" : "cursor-not-allowed opacity-50",
                  active
                    ? "border-accent ring-2 ring-accent/40"
                    : "border-white/[0.15] hover:border-white/30",
                )}
                style={{
                  backgroundColor: v.hex,
                  opacity: v.opacity ?? 1,
                }}
              >
                <span className="sr-only">{token.name}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <ul
          className={cn(
            "thin-scroll space-y-0.5 overflow-y-auto",
            variant === "compact" ? "max-h-52" : "max-h-64",
          )}
        >
          {colors.map((token) => {
            const v = token.value;
            if (!isColorValue(v)) return null;
            const active = activeTokenId === token.id;
            return (
              <li key={token.id}>
                <button
                  type="button"
                  disabled={!canApply}
                  title={`${token.name} · ${v.hex}`}
                  onClick={() => applyTokenToSelection(token.id)}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors",
                    applyButtonClass(active),
                  )}
                >
                  <span
                    className={cn(
                      "h-5 w-5 shrink-0 rounded border border-white/[0.15]",
                      active && "border-accent",
                    )}
                    style={{
                      backgroundColor: v.hex,
                      opacity: v.opacity ?? 1,
                    }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-ui text-app-fg">{token.name}</span>
                  <span className="shrink-0 font-mono text-ui text-app-subtle">{v.hex}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
