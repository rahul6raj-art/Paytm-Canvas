"use client";

import { LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { canAlignSelection } from "@/lib/alignSelection";
import { useEditorStore } from "@/stores/useEditorStore";
import { AlignControls } from "./AlignControls";
import { BooleanToolbarDropdown } from "./BooleanToolbarDropdown";
import { PropertiesSection } from "./PropertiesSection";
import { SelectionColorsSection } from "./SelectionColorsSection";
import { StrokeWidthToolbar } from "./StrokeWidthToolbar";

export function MultiSelectionInspector({
  selectedCount,
  canAddAutoLayout,
  onAddAutoLayout,
}: {
  selectedCount: number;
  canAddAutoLayout?: boolean;
  onAddAutoLayout?: () => void;
}) {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const canAlign = canAlignSelection(selectedIds, nodes, childOrder);

  return (
    <>
      <div className="border-b border-app-panel-edge px-3 py-3">
        <p className="text-ui font-medium text-app-muted">
          {selectedCount} layer{selectedCount === 1 ? "" : "s"} selected
        </p>
      </div>

      <SelectionColorsSection />

      <PropertiesSection title="Selection" defaultOpen>
        <div className="flex flex-wrap items-center gap-1.5">
          <BooleanToolbarDropdown />
          <StrokeWidthToolbar />
        </div>
      </PropertiesSection>

      {canAlign ? (
        <PropertiesSection title="Align" defaultOpen>
          <AlignControls variant="panel" />
        </PropertiesSection>
      ) : null}

      {canAddAutoLayout && onAddAutoLayout ? (
        <div className="px-3 py-3">
          <button
            type="button"
            onClick={onAddAutoLayout}
            className={cn(
              "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border px-3 text-ui font-medium transition-colors",
              "border-app-border bg-app-panel text-app-fg hover:bg-app-hover",
            )}
          >
            <LayoutTemplate className="h-3.5 w-3.5" strokeWidth={1.75} />
            Add auto layout
          </button>
        </div>
      ) : null}
    </>
  );
}
