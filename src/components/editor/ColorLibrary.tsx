"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { ColorLibraryPickerBody } from "./ColorLibraryPickerBody";

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

  const activeTokenId = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const n = nodes[selectedIds[0]!];
    return n?.fillTokenId ?? null;
  }, [selectedIds, nodes]);

  const hasColors = useMemo(
    () => Object.values(designTokens).some((t) => t.type === "color"),
    [designTokens],
  );

  if (!hasColors) return null;

  return (
    <div className={className}>
      <ColorLibraryPickerBody
        activeTokenId={activeTokenId}
        onPick={applyTokenToSelection}
        gridCols={variant === "compact" ? "compact" : "panel"}
        listMaxHeightClass={variant === "compact" ? "max-h-52" : "max-h-64"}
        showHeader
        showViewToggle
      />
    </div>
  );
}
