"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  appFieldInnerClass,
  appFieldShellClass,
} from "@/lib/appFieldStyles";
import { inspectorFieldIconSlotClass, inspectorInlineSvgClass } from "@/lib/inspectorIconStyles";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import { cn } from "@/lib/utils";
import {
  isAutoLineHeight,
  lineHeightAutoPatch,
  lineHeightPercentDisplayFromNode,
  lineHeightPercentPatch,
  lineHeightPxPatch,
  lineHeightUnitFromNode,
  resolveLineHeightPxFromNode,
  type LineHeightStylePatch,
  type LineHeightUnit,
} from "@/lib/text/lineHeight";
import { TextLineHeightIcon } from "./InspectorSettingIcons";

type LineHeightInputProps = {
  fontSize: number;
  lineHeight?: number;
  lineHeightUnit?: LineHeightUnit;
  onCommit: (patch: LineHeightStylePatch) => void;
  disabled?: boolean;
  instanceKey?: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseDraftNumber(raw: string, fallback: number): number {
  const trimmed = raw.replace(/%/g, "").replace(/px/gi, "").trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

function formatDisplayValue(
  auto: boolean,
  unit: LineHeightUnit,
  pxValue: number,
  percentDisplay: number,
): string {
  if (auto) return "Auto";
  if (unit === "percent") return `${percentDisplay}%`;
  const rounded = Math.round(pxValue * 10) / 10;
  return String(rounded);
}

/** Parse Figma-style input: Auto | 23 | 23px | 150% */
export function parseLineHeightInput(raw: string): LineHeightStylePatch | null {
  const trimmed = raw.trim();
  if (!trimmed || /^auto$/i.test(trimmed)) {
    return lineHeightAutoPatch();
  }

  const percentMatch = trimmed.match(/^(-?[\d.]+)\s*%$/);
  if (percentMatch) {
    const n = Number(percentMatch[1]);
    if (!Number.isFinite(n)) return null;
    return lineHeightPercentPatch(clamp(n, 1, 999));
  }

  const pxMatch = trimmed.match(/^(-?[\d.]+)\s*px?$/i);
  if (pxMatch) {
    const n = Number(pxMatch[1]);
    if (!Number.isFinite(n)) return null;
    return lineHeightPxPatch(clamp(n, 1, 9999));
  }

  if (/^[\d.]+$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    return lineHeightPxPatch(clamp(n, 1, 9999));
  }

  return null;
}

export function LineHeightInput({
  fontSize,
  lineHeight,
  lineHeightUnit,
  onCommit,
  disabled,
  instanceKey = "",
}: LineHeightInputProps) {
  const node = useMemo(
    () => ({ fontSize, lineHeight, lineHeightUnit }),
    [fontSize, lineHeight, lineHeightUnit],
  );
  const unit = lineHeightUnitFromNode(node);
  const auto = isAutoLineHeight(node);
  const resolvedPx = resolveLineHeightPxFromNode(node);
  const percentDisplay = lineHeightPercentDisplayFromNode(node);
  const pxValue = unit === "px" ? (lineHeight ?? resolvedPx) : resolvedPx;

  const displayValue = formatDisplayValue(auto, unit, pxValue, percentDisplay);

  const [text, setText] = useState(displayValue);
  const [focused, setFocused] = useState(false);

  const commitParsed = (raw: string) => {
    const patch = parseLineHeightInput(raw);
    if (!patch) return false;
    onCommit(patch);
    const nextUnit = patch.lineHeightUnit;
    if (nextUnit === "auto") {
      setText("Auto");
    } else if (nextUnit === "percent") {
      setText(`${patch.lineHeight ?? percentDisplay}%`);
    } else {
      setText(String(Math.round(patch.lineHeight ?? pxValue)));
    }
    return true;
  };

  const scrubValue = auto ? 0 : unit === "px" ? pxValue : percentDisplay;
  const scrubMin = 1;
  const scrubMax = unit === "px" ? 9999 : 999;
  const decimals = unit === "px" ? 1 : 0;
  const baseStep = decimals > 0 ? 0.1 : 1;

  const nudge = (direction: 1 | -1, shift: boolean, alt: boolean) => {
    if (auto) return;
    const delta = keyboardNudgeStep(baseStep, decimals, shift, alt) * direction;
    const current = parseDraftNumber(text, scrubValue);
    commitParsed(String(current + delta));
  };

  const { scrubbing, scrubActiveRef, bindScrubInput } = useInspectorValueScrub({
    disabled: disabled || auto,
    value: scrubValue,
    decimals,
    step: baseStep,
    min: scrubMin,
    max: scrubMax,
    onChange: (v) => commitParsed(String(v)),
  });

  useEffect(() => {
    if (focused || scrubbing || scrubActiveRef.current) return;
    setText(displayValue);
  }, [displayValue, instanceKey, focused, scrubbing, scrubActiveRef]);

  const onBlur = () => {
    if (scrubActiveRef.current) return;
    setFocused(false);
    if (!commitParsed(text)) setText(displayValue);
  };

  return (
    <div>
      <div className="inspector-field-label">Line height</div>
      <div className={cn(appFieldShellClass, disabled && "opacity-45")}>
        <span className={inspectorFieldIconSlotClass} aria-hidden>
          <TextLineHeightIcon className={inspectorInlineSvgClass()} />
        </span>
        <input
          type="text"
          inputMode="text"
          disabled={disabled}
          aria-label="Line height"
          value={text}
          placeholder="Auto"
          onFocus={() => {
            setFocused(true);
            setText(displayValue);
          }}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setText(e.target.value);
          }}
          onBlur={onBlur}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            handlePanelFieldKeyDown(e, {
              onEnter: () => {
                if (!commitParsed(text)) setText(displayValue);
                e.currentTarget.blur();
              },
              onArrowNudge: nudge,
            });
          }}
          {...bindScrubInput(
            cn(
              appFieldInnerClass,
              "font-mono tabular-nums",
              auto && !focused && "text-app-muted",
            ),
            focused,
          )}
        />
      </div>
    </div>
  );
}
