"use client";

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { inspectorControlHeightClass } from "@/lib/appFieldStyles";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";
import {
  TextAlignCenterIcon,
  TextAlignJustifyIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextVerticalAlignBottomIcon,
  TextVerticalAlignMiddleIcon,
  TextVerticalAlignTopIcon,
} from "./InspectorSettingIcons";
import { LineHeightInput } from "./LineHeightInput";
import { LetterSpacingInput } from "./LetterSpacingInput";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";
import type { LineHeightStylePatch } from "@/lib/text/lineHeight";
import type { LetterSpacingStylePatch } from "@/lib/text/letterSpacing";
import type { TextAlign } from "@/lib/text/textNodeModel";
import type { VerticalAlign } from "@/lib/text/textVerticalAlign";

function IconToggleGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly {
    value: T;
    label: string;
    title: string;
    Icon: ComponentType<{ className?: string }>;
  }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-stretch rounded-md border border-app-border bg-app-inset p-0.5",
        inspectorControlHeightClass,
      )}
      role="group"
    >
      {options.map(({ value: optValue, label, title, Icon }) => (
        <EditorHintWrap key={optValue} title={title} disabled={disabled}>
          <button
            type="button"
            aria-label={label}
            aria-pressed={value === optValue}
            disabled={disabled}
            onClick={() => onChange(optValue)}
            className={cn(
              "flex min-h-0 min-w-0 flex-1 items-center justify-center rounded-[5px] text-app-muted transition-colors disabled:opacity-40",
              value === optValue
                ? "bg-app-panel text-app-fg shadow-sm"
                : "hover:bg-app-hover hover:text-app-fg",
            )}
          >
            <Icon />
          </button>
        </EditorHintWrap>
      ))}
    </div>
  );
}

const H_ALIGN = [
  { value: "left" as const, label: "Align left", title: "Align left", Icon: TextAlignLeftIcon },
  { value: "center" as const, label: "Align center", title: "Align center", Icon: TextAlignCenterIcon },
  { value: "right" as const, label: "Align right", title: "Align right", Icon: TextAlignRightIcon },
  { value: "justify" as const, label: "Justify", title: "Justify", Icon: TextAlignJustifyIcon },
] as const;

const V_ALIGN = [
  { value: "top" as const, label: "Align top", title: "Align top", Icon: TextVerticalAlignTopIcon },
  { value: "middle" as const, label: "Align middle", title: "Align middle", Icon: TextVerticalAlignMiddleIcon },
  { value: "bottom" as const, label: "Align bottom", title: "Align bottom", Icon: TextVerticalAlignBottomIcon },
] as const;

export function TypographyLineSpacingFields({
  display,
  instanceKey,
  locked,
  onCommitLineHeight,
  onCommitLetterSpacing,
}: {
  display: EditorNode;
  instanceKey: string;
  locked: boolean;
  onCommitLineHeight: (patch: LineHeightStylePatch) => void;
  onCommitLetterSpacing: (patch: LetterSpacingStylePatch) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
      <LineHeightInput
        fontSize={display.fontSize ?? 14}
        lineHeight={display.lineHeight}
        lineHeightUnit={display.lineHeightUnit}
        instanceKey={`${instanceKey}-lh`}
        disabled={locked}
        onCommit={onCommitLineHeight}
      />
      <LetterSpacingInput
        fontSize={display.fontSize ?? 14}
        letterSpacing={display.letterSpacing}
        letterSpacingUnit={display.letterSpacingUnit}
        instanceKey={`${instanceKey}-ls`}
        disabled={locked}
        onCommit={onCommitLetterSpacing}
      />
    </div>
  );
}

export function TypographyAlignmentFields({
  node,
  locked,
  onStyle,
}: {
  node: EditorNode;
  locked: boolean;
  onStyle: (p: NodeStylePatch) => void;
}) {
  return (
    <div>
      <div className="inspector-field-label mb-1">Alignment</div>
      <div className="flex w-full items-center gap-1.5">
        <div className="min-w-0 flex-[3]">
          <IconToggleGroup
            options={H_ALIGN}
            value={(node.textAlign ?? "left") as TextAlign}
            onChange={(v) => onStyle({ textAlign: v })}
            disabled={locked}
          />
        </div>
        <div className="min-w-0 flex-[2]">
          <IconToggleGroup
            options={V_ALIGN}
            value={(node.verticalAlign ?? "top") as VerticalAlign}
            onChange={(v) => onStyle({ verticalAlign: v })}
            disabled={locked}
          />
        </div>
      </div>
    </div>
  );
}
