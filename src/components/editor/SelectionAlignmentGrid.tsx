"use client";

import type { ComponentType } from "react";
import type { AlignDirection } from "@/stores/useEditorStore";
import { inspectorControlHeightClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";
import {
  LayerAlignBottomIcon,
  LayerAlignHorizontalCenterIcon,
  LayerAlignLeftIcon,
  LayerAlignRightIcon,
  LayerAlignTopIcon,
  LayerAlignVerticalCenterIcon,
} from "./design-panel/InspectorSettingIcons";
import { EditorHintWrap } from "./EditorHoverHint";

type AlignItem = {
  direction: AlignDirection;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

const HORIZONTAL_ALIGN: AlignItem[] = [
  { direction: "left", label: "Align left edges", Icon: LayerAlignLeftIcon },
  { direction: "center-h", label: "Align horizontal centers", Icon: LayerAlignHorizontalCenterIcon },
  { direction: "right", label: "Align right edges", Icon: LayerAlignRightIcon },
];

const VERTICAL_ALIGN: AlignItem[] = [
  { direction: "top", label: "Align top edges", Icon: LayerAlignTopIcon },
  { direction: "center-v", label: "Align vertical centers", Icon: LayerAlignVerticalCenterIcon },
  { direction: "bottom", label: "Align bottom edges", Icon: LayerAlignBottomIcon },
];

function AlignSegmentGroup({
  items,
  disabled,
  onAlign,
  "aria-label": ariaLabel,
}: {
  items: AlignItem[];
  disabled?: boolean;
  onAlign: (direction: AlignDirection) => void;
  "aria-label": string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-stretch overflow-hidden rounded-md border border-app-border bg-app-inset",
        inspectorControlHeightClass,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {items.map(({ direction, label, Icon }, index) => (
        <EditorHintWrap key={direction} title={label} disabled={disabled}>
          <button
            type="button"
            disabled={disabled}
            aria-label={label}
            onClick={() => onAlign(direction)}
            className={cn(
              "flex min-w-0 flex-1 items-center justify-center transition-colors",
              "text-app-muted hover:bg-app-hover hover:text-app-fg",
              "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-app-muted",
              index > 0 && "border-l border-app-border",
            )}
          >
            <Icon />
          </button>
        </EditorHintWrap>
      ))}
    </div>
  );
}

/** Figma-style paired horizontal / vertical alignment segmented controls. */
export function SelectionAlignmentGrid({
  disabled,
  fullWidth = false,
  onAlign,
}: {
  disabled?: boolean;
  /** @deprecated Grid layout removed; bar always stretches in panel. */
  selectionKey?: string;
  fullWidth?: boolean;
  /** @deprecated Use embedded on parent wrapper instead. */
  embedded?: boolean;
  onAlign: (direction: AlignDirection) => void;
}) {
  return (
    <div
      className={cn("flex gap-2", fullWidth ? "w-full" : "w-fit shrink-0")}
      role="group"
      aria-label="Align selection"
    >
      <AlignSegmentGroup
        items={HORIZONTAL_ALIGN}
        disabled={disabled}
        onAlign={onAlign}
        aria-label="Align horizontally"
      />
      <AlignSegmentGroup
        items={VERTICAL_ALIGN}
        disabled={disabled}
        onAlign={onAlign}
        aria-label="Align vertically"
      />
    </div>
  );
}
