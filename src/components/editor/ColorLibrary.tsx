"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { isColorValue } from "@/lib/designTokens";
import { cn } from "@/lib/utils";
import { getColorDesignTokens } from "./LibraryColorPickerMenu";

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

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[#8c8c8c]">Color library</span>
        {!canApply ? (
          <span className="text-[10px] text-[#6b6b6b]">Select a layer</span>
        ) : (
          <span className="text-[10px] text-[#6b6b6b]">Click to apply</span>
        )}
      </div>
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
      {variant === "panel" ? (
        <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto">
          {colors.slice(0, 8).map((t) => (
            <li key={t.id} className="truncate font-mono text-[10px] text-[#737373]" title={t.name}>
              {t.name}
            </li>
          ))}
          {colors.length > 8 ? (
            <li className="text-[10px] text-[#5c5c5c]">+{colors.length - 8} more in list below</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
