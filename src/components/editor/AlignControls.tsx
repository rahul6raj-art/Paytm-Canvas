"use client";

import type { ComponentType } from "react";
import { useEditorStore, type AlignDirection } from "@/stores/useEditorStore";
import { canAlignSelection, canDistributeSelection } from "@/lib/alignSelection";
import { inspectorControlHeightClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";
import {
  DistributeHorizontallyIcon,
  DistributeVerticalSpacingIcon,
  LayerAlignBottomIcon,
  LayerAlignHorizontalCenterIcon,
  LayerAlignLeftIcon,
  LayerAlignRightIcon,
  LayerAlignTopIcon,
  LayerAlignVerticalCenterIcon,
} from "./design-panel/InspectorSettingIcons";
import { SelectionAlignmentGrid } from "./SelectionAlignmentGrid";
import { EditorHintWrap } from "./EditorHoverHint";

const ALIGN_BUTTONS: {
  direction: AlignDirection;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { direction: "left", label: "Align left edges", Icon: LayerAlignLeftIcon },
  { direction: "center-h", label: "Align horizontal centers", Icon: LayerAlignHorizontalCenterIcon },
  { direction: "right", label: "Align right edges", Icon: LayerAlignRightIcon },
  { direction: "top", label: "Align top edges", Icon: LayerAlignTopIcon },
  { direction: "center-v", label: "Align vertical centers", Icon: LayerAlignVerticalCenterIcon },
  { direction: "bottom", label: "Align bottom edges", Icon: LayerAlignBottomIcon },
];

function DistributeSegmentGroup({
  label,
  Icon,
  disabled,
  onClick,
}: {
  label: string;
  Icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-stretch overflow-hidden rounded-md border border-app-border bg-app-inset",
        inspectorControlHeightClass,
      )}
      role="group"
      aria-label={label}
    >
      <EditorHintWrap title={label} disabled={disabled}>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "flex min-w-0 w-full items-center justify-center transition-colors",
            "text-app-muted hover:bg-app-hover hover:text-app-fg",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-app-muted",
          )}
        >
          <Icon />
        </button>
      </EditorHintWrap>
    </div>
  );
}

type AlignControlsProps = {
  variant?: "toolbar" | "panel";
  className?: string;
  onAction?: () => void;
};

export function AlignControls({ variant = "panel", className, onAction }: AlignControlsProps) {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const alignSelection = useEditorStore((s) => s.alignSelection);
  const distributeSelection = useEditorStore((s) => s.distributeSelection);

  const canAlign = canAlignSelection(selectedIds, nodes, childOrder);
  const canDistribute = canDistributeSelection(selectedIds, nodes);

  const runAlign = (d: AlignDirection) => {
    if (!canAlign) return;
    alignSelection(d);
    onAction?.();
  };

  const runDistribute = (axis: "horizontal" | "vertical") => {
    if (!canDistribute) return;
    distributeSelection(axis);
    onAction?.();
  };

  const compact = variant === "toolbar";
  const btnClass = cn(
    "flex items-center justify-center rounded transition-colors",
    compact ? "h-7 w-7" : "h-8 flex-1",
    "text-app-muted hover:bg-app-hover hover:text-app-fg",
    "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-app-muted",
  );

  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <div
          className="grid grid-cols-3 gap-0.5 rounded-md border border-app-border bg-app-toolbar-well p-0.5"
          role="toolbar"
          aria-label="Align selection"
        >
          {ALIGN_BUTTONS.map(({ direction, label, Icon }) => (
            <EditorHintWrap key={direction} title={label} disabled={!canAlign}>
              <button
                type="button"
                aria-label={label}
                disabled={!canAlign}
                className={btnClass}
                onClick={() => runAlign(direction)}
              >
                <Icon />
              </button>
            </EditorHintWrap>
          ))}
        </div>
        <div className="mt-0.5 flex gap-1">
          <EditorHintWrap title="Distribute horizontal spacing" disabled={!canDistribute}>
            <button
              type="button"
              aria-label="Distribute horizontal spacing"
              disabled={!canDistribute}
              className={cn(btnClass, "h-7 flex-1")}
              onClick={() => runDistribute("horizontal")}
            >
              <DistributeHorizontallyIcon />
            </button>
          </EditorHintWrap>
          <EditorHintWrap title="Distribute vertical spacing" disabled={!canDistribute}>
            <button
              type="button"
              aria-label="Distribute vertical spacing"
              disabled={!canDistribute}
              className={cn(btnClass, "h-7 flex-1")}
              onClick={() => runDistribute("vertical")}
            >
              <DistributeVerticalSpacingIcon />
            </button>
          </EditorHintWrap>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)} role="group" aria-label="Align and distribute selection">
      <SelectionAlignmentGrid disabled={!canAlign} fullWidth onAlign={runAlign} />
      <div className="flex gap-2" role="group" aria-label="Distribute spacing">
        <DistributeSegmentGroup
          label="Distribute horizontal spacing"
          Icon={DistributeHorizontallyIcon}
          disabled={!canDistribute}
          onClick={() => runDistribute("horizontal")}
        />
        <DistributeSegmentGroup
          label="Distribute vertical spacing"
          Icon={DistributeVerticalSpacingIcon}
          disabled={!canDistribute}
          onClick={() => runDistribute("vertical")}
        />
      </div>
    </div>
  );
}
