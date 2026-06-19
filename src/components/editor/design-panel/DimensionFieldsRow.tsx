"use client";

import type { ReactNode } from "react";
import { Link2, Unlink2 } from "lucide-react";
import { PropertyNumberInput } from "../PropertyInput";
import { inspectorRowGapClass } from "@/lib/appFieldStyles";
import { DimensionFieldsIconButton } from "./DimensionFieldsIconButton";
import { cn } from "@/lib/utils";
import { inspectorLucideProps } from "@/lib/inspectorIconStyles";
import { applyAspectLockedDimensions } from "@/lib/dimensionAspectLock";
import { useEditorStore } from "@/stores/useEditorStore";

export function DimensionFieldsRow({
  width,
  height,
  instanceKey,
  locked,
  widthDisabled,
  heightDisabled,
  decimals = 0,
  min = 1,
  trailingAction,
  showAspectLock = true,
  onCommitDimensions,
}: {
  width: number;
  height: number;
  instanceKey: string;
  locked: boolean;
  widthDisabled?: boolean;
  heightDisabled?: boolean;
  decimals?: number;
  min?: number;
  trailingAction?: ReactNode;
  /** When false, omit the aspect-ratio lock (e.g. text uses resize modes instead). */
  showAspectLock?: boolean;
  onCommitDimensions: (next: { width: number; height: number }) => void;
}) {
  const aspectRatioLocked = useEditorStore((s) => s.inspectorAspectRatioLocked);
  const toggleInspectorAspectRatioLocked = useEditorStore(
    (s) => s.toggleInspectorAspectRatioLocked,
  );

  const canApplyAspectLockBoth = !widthDisabled && !heightDisabled && !locked;
  const canApplyAspectLockWidth =
    !locked && !widthDisabled && heightDisabled && width > 0 && height > 0;
  const canApplyAspectLockHeight =
    !locked && widthDisabled && !heightDisabled && width > 0 && height > 0;

  const commitWidth = (value: number) => {
    if (aspectRatioLocked && canApplyAspectLockWidth) {
      const ratio = width / height;
      const nextWidth = Math.max(min, value);
      onCommitDimensions({
        width: nextWidth,
        height: Math.max(min, nextWidth / ratio),
      });
      return;
    }
    const next = applyAspectLockedDimensions(
      { width, height },
      "width",
      value,
      aspectRatioLocked && canApplyAspectLockBoth,
      min,
    );
    onCommitDimensions(next);
  };

  const commitHeight = (value: number) => {
    if (aspectRatioLocked && canApplyAspectLockHeight) {
      const ratio = width / height;
      const nextHeight = Math.max(min, value);
      onCommitDimensions({
        width: Math.max(min, nextHeight * ratio),
        height: nextHeight,
      });
      return;
    }
    const next = applyAspectLockedDimensions(
      { width, height },
      "height",
      value,
      aspectRatioLocked && canApplyAspectLockBoth,
      min,
    );
    onCommitDimensions(next);
  };

  return (
    <div
      className={cn(
        "grid items-end",
        inspectorRowGapClass,
        trailingAction && showAspectLock
          ? "grid-cols-[1fr_1fr_auto_auto]"
          : trailingAction || showAspectLock
            ? "grid-cols-[1fr_1fr_auto]"
            : "grid-cols-2",
      )}
    >
      <PropertyNumberInput
        commitOnInput={false}
        label="W"
        value={width}
        instanceKey={`${instanceKey}-w`}
        disabled={locked || widthDisabled}
        min={min}
        decimals={decimals}
        onCommit={commitWidth}
      />
      <PropertyNumberInput
        commitOnInput={false}
        label="H"
        value={height}
        instanceKey={`${instanceKey}-h`}
        disabled={locked || heightDisabled}
        min={min}
        decimals={decimals}
        onCommit={commitHeight}
      />
      {showAspectLock ? (
        <DimensionFieldsIconButton
          title={aspectRatioLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
          ariaLabel={aspectRatioLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
          pressed={aspectRatioLocked}
          active={aspectRatioLocked}
          disabled={locked}
          onClick={() => toggleInspectorAspectRatioLocked()}
        >
          {aspectRatioLocked ? (
            <Link2 {...inspectorLucideProps()} />
          ) : (
            <Unlink2 {...inspectorLucideProps()} />
          )}
        </DimensionFieldsIconButton>
      ) : null}
      {trailingAction}
    </div>
  );
}
