"use client";

import { useEffect, useState } from "react";
import { appFieldClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";

const baseField = appFieldClass;

type PropertyNumberInputProps = {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  commitOnInput?: boolean;
  /** Bump when selection changes to reset draft */
  instanceKey?: string;
  decimals?: number;
  /** Base step for ArrowUp/ArrowDown (default: 1, or 10^-decimals when decimals > 0). */
  step?: number;
};

function parseDraftNumber(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

function keyboardStep(
  baseStep: number,
  decimals: number,
  shift: boolean,
  alt: boolean,
): number {
  let step = baseStep;
  if (shift) step *= 10;
  if (alt) step /= 10;
  if (decimals > 0) {
    const minStep = 10 ** -decimals;
    step = Math.max(minStep, step);
    return Number(step.toFixed(decimals));
  }
  return step;
}

function clampAndRound(n: number, min: number | undefined, max: number | undefined, decimals: number): number {
  let v = n;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return decimals > 0 ? Number(v.toFixed(decimals)) : Math.round(v);
}

export function PropertyNumberInput({
  label,
  value,
  onCommit,
  disabled,
  min,
  max,
  commitOnInput = true,
  instanceKey = "",
  decimals = 0,
  step: stepProp,
}: PropertyNumberInputProps) {
  const format = (n: number) =>
    decimals > 0 ? String(Number(n.toFixed(decimals))) : String(Math.round(n));

  const baseStep = stepProp ?? (decimals > 0 ? 10 ** -decimals : 1);

  const [text, setText] = useState(() => format(value));

  useEffect(() => {
    setText(format(value));
  }, [value, instanceKey, decimals]);

  const commitValue = (v: number) => {
    const next = clampAndRound(v, min, max, decimals);
    onCommit(next);
    setText(format(next));
    return next;
  };

  const apply = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
      return false;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return false;
    commitValue(n);
    return true;
  };

  const nudge = (direction: 1 | -1, shift: boolean, alt: boolean) => {
    const delta = keyboardStep(baseStep, decimals, shift, alt) * direction;
    const current = parseDraftNumber(text, value);
    commitValue(current + delta);
  };

  const onBlur = () => {
    if (!apply(text)) setText(format(value));
  };

  return (
    <div>
      <div className="mb-0.5 text-[11px] font-medium leading-4 text-app-subtle">{label}</div>
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className={cn(baseField, "font-mono tabular-nums")}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (commitOnInput) apply(next);
        }}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!apply(text)) setText(format(value));
            (e.target as HTMLInputElement).blur();
            return;
          }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            nudge(e.key === "ArrowUp" ? 1 : -1, e.shiftKey, e.altKey);
          }
        }}
      />
    </div>
  );
}

type PropertyTextInputProps = {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  monospace?: boolean;
  instanceKey?: string;
};

export function PropertyTextInput({
  label,
  value,
  onCommit,
  disabled,
  placeholder,
  monospace,
  instanceKey = "",
}: PropertyTextInputProps) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value, instanceKey]);

  const flush = () => {
    if (text !== value) onCommit(text);
  };

  return (
    <div>
      <div className="mb-0.5 text-[11px] font-medium leading-4 text-app-subtle">{label}</div>
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        className={cn(baseField, monospace && "font-mono")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={flush}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            flush();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </div>
  );
}
