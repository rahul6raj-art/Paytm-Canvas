"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import type { DesignToken } from "@/lib/designTokens";
import { isColorValue } from "@/lib/designTokens";
import { cn } from "@/lib/utils";

export function getColorDesignTokens(tokens: Record<string, DesignToken>): DesignToken[] {
  return Object.values(tokens)
    .filter((t) => t.type === "color" && isColorValue(t.value))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type LibraryColorPickerMenuProps = {
  activeTokenId?: string | null;
  onPick: (tokenId: string) => void;
};

export function LibraryColorPickerMenu({ activeTokenId, onPick }: LibraryColorPickerMenuProps) {
  const designTokens = useEditorStore((s) => s.designTokens);
  const colors = useMemo(() => getColorDesignTokens(designTokens), [designTokens]);

  if (colors.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-[11px] leading-snug text-[#8c8c8c]">
        No colors in the library yet. Open the Library panel to add a palette or create colors.
      </p>
    );
  }

  return (
    <div className="p-2">
      <p className="mb-2 px-0.5 text-[11px] font-medium text-[#8c8c8c]">Choose library color</p>
      <div className="grid grid-cols-5 gap-1.5">
        {colors.map((token) => {
          const v = token.value;
          if (!isColorValue(v)) return null;
          const active = activeTokenId === token.id;
          return (
            <button
              key={token.id}
              type="button"
              title={`${token.name} · ${v.hex}`}
              onClick={() => onPick(token.id)}
              className={cn(
                "aspect-square min-h-[32px] rounded-md border transition-all hover:scale-105 hover:shadow-md",
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
      <ul className="thin-scroll mt-2 max-h-48 space-y-0.5 overflow-y-auto border-t border-white/[0.06] pt-2">
        {colors.map((token) => {
          const v = token.value;
          if (!isColorValue(v)) return null;
          const active = activeTokenId === token.id;
          return (
            <li key={token.id}>
              <button
                type="button"
                onClick={() => onPick(token.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-white/[0.06]",
                  active && "bg-accent/10 text-accent",
                )}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded border border-white/[0.12]"
                  style={{ backgroundColor: v.hex, opacity: v.opacity ?? 1 }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-medium">{token.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-[#737373]">{v.hex}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
