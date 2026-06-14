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
  variant?: "full" | "compact";
  /** When true, render nothing instead of the empty-library message (e.g. gradient stop picker). */
  hideWhenEmpty?: boolean;
};

export function LibraryColorPickerMenu({
  activeTokenId,
  onPick,
  variant = "full",
  hideWhenEmpty = false,
}: LibraryColorPickerMenuProps) {
  const designTokens = useEditorStore((s) => s.designTokens);
  const colors = useMemo(() => getColorDesignTokens(designTokens), [designTokens]);

  if (colors.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <p className="px-3 py-4 text-center text-ui leading-snug text-app-subtle">
        No colors in the library yet. Open the Library panel to add a palette or create colors.
      </p>
    );
  }

  const grid = (
    <div className={variant === "compact" ? "grid grid-cols-6 gap-1" : "grid grid-cols-5 gap-1.5"}>
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
  );

  if (variant === "compact") {
    return <div className="px-0.5">{grid}</div>;
  }

  return (
    <div className="p-2">
      <p className="mb-2 px-0.5 text-ui font-medium text-app-subtle">Choose library color</p>
      {grid}
      <ul className="thin-scroll mt-2 max-h-48 space-y-0.5 overflow-y-auto border-t border-app-border-subtle pt-2">
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
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui transition-colors hover:bg-app-hover",
                  active && "bg-accent/10 text-accent",
                )}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded border border-app-border"
                  style={{ backgroundColor: v.hex, opacity: v.opacity ?? 1 }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-medium">{token.name}</span>
                <span className="shrink-0 font-mono text-ui text-[#737373]">{v.hex}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
