"use client";

import { useEffect, useState } from "react";
import { appFieldInnerClass, appFieldShellClass, inspectorRowGapClass } from "@/lib/appFieldStyles";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import {
  inspectorFieldIconSlotClass,
  inspectorTransformActionBtnClass,
} from "@/lib/inspectorIconStyles";
import { cn } from "@/lib/utils";
import {
  FlipHorizontalIcon,
  FlipVerticalIcon,
  Rotate90Icon,
  RotationAngleIcon,
} from "./InspectorSettingIcons";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";

function TransformIconBtn({
  active,
  disabled,
  title,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <EditorHintWrap title={title} disabled={disabled}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          inspectorTransformActionBtnClass,
          active && "bg-accent/15 text-app-fg",
          className,
        )}
      >
        {children}
      </button>
    </EditorHintWrap>
  );
}

function normalizeRotation(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function parseRotationDraft(raw: string, fallback: number): number {
  const trimmed = raw.trim().replace(/°/g, "");
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

function formatRotation(deg: number): string {
  return `${Math.round(normalizeRotation(deg))}°`;
}

function RotationAngleInput({
  value,
  onCommit,
  disabled,
  instanceKey = "",
}: {
  value: number;
  onCommit: (deg: number) => void;
  disabled?: boolean;
  instanceKey?: string;
}) {
  const [text, setText] = useState(() => formatRotation(value));

  useEffect(() => {
    setText(formatRotation(value));
  }, [value, instanceKey]);

  const commitValue = (deg: number) => {
    const next = normalizeRotation(deg);
    onCommit(next);
    setText(formatRotation(next));
    return next;
  };

  const apply = (raw: string) => {
    const trimmed = raw.trim().replace(/°/g, "");
    if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") return false;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return false;
    commitValue(n);
    return true;
  };

  const nudge = (direction: 1 | -1, shift: boolean, alt: boolean) => {
    const delta = keyboardNudgeStep(1, 0, shift, alt) * direction;
    const current = parseRotationDraft(text, value);
    commitValue(current + delta);
  };

  return (
    <div className={cn(appFieldShellClass, "min-w-0 flex-1")}>
      <span className={inspectorFieldIconSlotClass} aria-hidden>
        <RotationAngleIcon />
      </span>
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        aria-label="Rotation"
        className={cn(appFieldInnerClass, "font-mono tabular-nums")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (!apply(text)) setText(formatRotation(value));
        }}
        onKeyDown={(e) => {
          handlePanelFieldKeyDown(e, {
            onEnter: () => {
              if (!apply(text)) setText(formatRotation(value));
              e.currentTarget.blur();
            },
            onArrowNudge: nudge,
          });
        }}
      />
    </div>
  );
}

export function TransformActions({
  flipHorizontal,
  flipVertical,
  disabled,
  onRotate90,
  onFlipHorizontal,
  onFlipVertical,
}: {
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  disabled?: boolean;
  onRotate90: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
}) {
  return (
    <div
      className={cn(appFieldShellClass, "shrink-0")}
      role="group"
      aria-label="Transform"
    >
      <TransformIconBtn
        disabled={disabled}
        title="Rotate 90°"
        onClick={onRotate90}
        className="border-r border-app-border"
      >
        <Rotate90Icon />
      </TransformIconBtn>
      <TransformIconBtn
        active={flipHorizontal}
        disabled={disabled}
        title="Flip horizontal"
        onClick={onFlipHorizontal}
        className="border-r border-app-border"
      >
        <FlipHorizontalIcon />
      </TransformIconBtn>
      <TransformIconBtn
        active={flipVertical}
        disabled={disabled}
        title="Flip vertical"
        onClick={onFlipVertical}
      >
        <FlipVerticalIcon />
      </TransformIconBtn>
    </div>
  );
}

/** Figma-style rotation field + transform action buttons. */
export function RotationTransformRow({
  rotation,
  flipHorizontal,
  flipVertical,
  disabled,
  instanceKey,
  onRotationCommit,
  onRotate90,
  onFlipHorizontal,
  onFlipVertical,
}: {
  rotation: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  disabled?: boolean;
  instanceKey?: string;
  onRotationCommit: (deg: number) => void;
  onRotate90: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
}) {
  return (
    <div>
      <div className="inspector-field-label">Rotation</div>
      <div className={cn("flex", inspectorRowGapClass)}>
        <RotationAngleInput
          value={rotation}
          disabled={disabled}
          instanceKey={instanceKey}
          onCommit={onRotationCommit}
        />
        <TransformActions
          flipHorizontal={flipHorizontal}
          flipVertical={flipVertical}
          disabled={disabled}
          onRotate90={onRotate90}
          onFlipHorizontal={onFlipHorizontal}
          onFlipVertical={onFlipVertical}
        />
      </div>
    </div>
  );
}
