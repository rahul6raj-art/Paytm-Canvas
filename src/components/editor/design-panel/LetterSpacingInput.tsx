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
  letterSpacingPercentFromNode,
  letterSpacingPercentPatch,
  letterSpacingPxPatch,
  letterSpacingUnitFromNode,
  type LetterSpacingStylePatch,
} from "@/lib/text/letterSpacing";
import { TextLetterSpacingIcon } from "./InspectorSettingIcons";

type LetterSpacingInputProps = {
  fontSize: number;
  letterSpacing?: number;
  letterSpacingUnit?: import("@/lib/text/letterSpacing").LetterSpacingUnit;
  onCommit: (patch: LetterSpacingStylePatch) => void;
  disabled?: boolean;
  instanceKey?: string;
  min?: number;
  max?: number;
  decimals?: number;
};

function clampAndRound(n: number, min: number, max: number, decimals: number): number {
  let v = Math.max(min, Math.min(max, n));
  return decimals > 0 ? Number(v.toFixed(decimals)) : Math.round(v);
}

function parseDraftNumber(raw: string, fallback: number): number {
  const trimmed = raw.replace(/%/g, "").replace(/px/gi, "").trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

function format(n: number, d: number): string {
  if (!Number.isFinite(n)) return "0";
  return d > 0 ? String(Number(n.toFixed(d))) : String(Math.round(n));
}

/** Parse Figma-style input: 0% | 2% | 2 | 2px */
export function parseLetterSpacingInput(
  raw: string,
  min: number,
  max: number,
  decimals: number,
): LetterSpacingStylePatch | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return letterSpacingPercentPatch(0);
  }

  const percentMatch = trimmed.match(/^(-?[\d.]+)\s*%$/);
  if (percentMatch) {
    const n = Number(percentMatch[1]);
    if (!Number.isFinite(n)) return null;
    return letterSpacingPercentPatch(clampAndRound(n, min, max, decimals));
  }

  const pxMatch = trimmed.match(/^(-?[\d.]+)\s*px?$/i);
  if (pxMatch) {
    const n = Number(pxMatch[1]);
    if (!Number.isFinite(n)) return null;
    return letterSpacingPxPatch(clampAndRound(n, min, max, decimals));
  }

  if (/^-?[\d.]+$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    return letterSpacingPxPatch(clampAndRound(n, min, max, decimals));
  }

  return null;
}

export function LetterSpacingInput({
  fontSize,
  letterSpacing,
  letterSpacingUnit,
  onCommit,
  disabled,
  instanceKey = "",
  min = -20,
  max = 100,
  decimals = 1,
}: LetterSpacingInputProps) {
  const node = useMemo(
    () => ({ fontSize, letterSpacing, letterSpacingUnit }),
    [fontSize, letterSpacing, letterSpacingUnit],
  );
  const unit = letterSpacingUnitFromNode(node);
  const percent = letterSpacingPercentFromNode(node);
  const pxStored = unit === "px" ? (letterSpacing ?? 0) : percent;

  const displayValue =
    unit === "percent" ? `${format(percent, decimals)}%` : format(pxStored, decimals);

  const baseStep = decimals > 0 ? 10 ** -decimals : 1;
  const [text, setText] = useState(() => displayValue);
  const [focused, setFocused] = useState(false);

  const scrubValue = unit === "px" ? pxStored : percent;

  const commitParsed = (raw: string) => {
    const patch = parseLetterSpacingInput(raw, min, max, decimals);
    if (!patch) return false;
    onCommit(patch);
    if (patch.letterSpacingUnit === "percent") {
      setText(`${format(patch.letterSpacing, decimals)}%`);
    } else {
      setText(format(patch.letterSpacing, decimals));
    }
    return true;
  };

  const nudge = (direction: 1 | -1, shift: boolean, alt: boolean) => {
    const delta = keyboardNudgeStep(baseStep, decimals, shift, alt) * direction;
    const current = parseDraftNumber(text, scrubValue);
    commitParsed(String(current + delta));
  };

  const { scrubbing, scrubActiveRef, bindScrubInput } = useInspectorValueScrub({
    disabled,
    value: scrubValue,
    decimals,
    step: baseStep,
    min,
    max,
    onChange: (v) => commitParsed(String(v)),
  });

  useEffect(() => {
    if (focused || scrubbing || scrubActiveRef.current) return;
    setText(displayValue);
  }, [displayValue, instanceKey, decimals, focused, scrubbing, scrubActiveRef]);

  const onBlur = () => {
    if (scrubActiveRef.current) return;
    setFocused(false);
    if (!commitParsed(text)) setText(displayValue);
  };

  return (
    <div>
      <div className="inspector-field-label">Letter spacing</div>
      <div className={cn(appFieldShellClass, disabled && "opacity-45")}>
        <span className={inspectorFieldIconSlotClass} aria-hidden>
          <TextLetterSpacingIcon className={inspectorInlineSvgClass()} />
        </span>
        <input
          type="text"
          inputMode="decimal"
          disabled={disabled}
          aria-label="Letter spacing"
          value={focused ? text : displayValue}
          onFocus={() => {
            setFocused(true);
            setText(unit === "percent" ? format(percent, decimals) : format(pxStored, decimals));
          }}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setText(e.target.value.replace(/%/g, ""));
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
            cn(appFieldInnerClass, "font-mono tabular-nums"),
            focused,
          )}
        />
      </div>
    </div>
  );
}
