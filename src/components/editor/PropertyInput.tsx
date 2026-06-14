"use client";

import { useEffect, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import { appFieldClass, appFieldRadius, inspectorControlHeightClass } from "@/lib/appFieldStyles";
import { inspectorFieldIconSlotClass } from "@/lib/inspectorIconStyles";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
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
  /** Leading icon inside the field (hides the text label, uses aria-label). */
  leadingIcon?: ReactNode;
};

function parseDraftNumber(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
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
  leadingIcon,
}: PropertyNumberInputProps) {
  const format = (n: number) => {
    if (!Number.isFinite(n)) return "0";
    return decimals > 0 ? String(Number(n.toFixed(decimals))) : String(Math.round(n));
  };

  const baseStep = stepProp ?? (decimals > 0 ? 10 ** -decimals : 1);

  const [text, setText] = useState(() => format(value));
  const [focused, setFocused] = useState(false);

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
    const delta = keyboardNudgeStep(baseStep, decimals, shift, alt) * direction;
    const current = parseDraftNumber(text, value);
    commitValue(current + delta);
  };

  const { scrubbing, scrubActiveRef, bindScrubInput } = useInspectorValueScrub({
    disabled,
    value,
    decimals,
    step: baseStep,
    min,
    max,
    onChange: commitValue,
  });

  useEffect(() => {
    if (!focused && !scrubbing && !scrubActiveRef.current) setText(format(value));
  }, [value, instanceKey, decimals, focused, scrubbing, scrubActiveRef]);

  const onBlur = () => {
    if (scrubActiveRef.current) return;
    setFocused(false);
    if (!apply(text)) setText(format(value));
  };

  const inputProps = {
    type: "text" as const,
    inputMode: "decimal" as const,
    disabled,
    value: text,
    onFocus: () => setFocused(true),
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setText(next);
      if (commitOnInput) apply(next);
    },
    onBlur,
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      handlePanelFieldKeyDown(e, {
        onEnter: () => {
          if (!apply(text)) setText(format(value));
          e.currentTarget.blur();
        },
        onArrowNudge: nudge,
      });
    },
  };

  if (leadingIcon) {
    return (
      <div>
        <div className="sr-only">{label}</div>
        <div
          className={cn(
            "flex min-w-0 items-center overflow-hidden border border-app-border bg-app-field",
            inspectorControlHeightClass,
            appFieldRadius,
            "shadow-[inset_0_1px_0_0_hsl(var(--app-inset-highlight)/var(--app-inset-highlight-opacity))]",
            disabled && "opacity-45",
          )}
        >
          <span className={inspectorFieldIconSlotClass} aria-hidden>
            {leadingIcon}
          </span>
          <input
            {...inputProps}
            aria-label={label}
            {...bindScrubInput(
              cn(
                baseField,
                "flex-1 rounded-none border-0 bg-transparent px-1.5 py-0 shadow-none",
                "font-mono tabular-nums focus-visible:ring-0",
              ),
              focused,
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="inspector-field-label">{label}</div>
      <input
        {...inputProps}
        {...bindScrubInput(cn(baseField, "font-mono tabular-nums"), focused)}
      />
    </div>
  );
}

/** 0–1 opacity as a percent field with ArrowUp/ArrowDown nudging (Shift ×10, Alt ÷10). */
export function OpacityPercentInput({
  value,
  onCommit,
  disabled,
  instanceKey = "",
  className,
  commitOnInput = true,
}: {
  /** Opacity 0–1 */
  value: number;
  onCommit: (opacity: number) => void;
  disabled?: boolean;
  instanceKey?: string;
  className?: string;
  commitOnInput?: boolean;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);

  const [text, setText] = useState(() => String(percent));
  const [focused, setFocused] = useState(false);

  const commitPercent = (n: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(n)));
    onCommit(clamped / 100);
    setText(String(clamped));
  };

  const { scrubbing, scrubActiveRef, bindScrubInput } = useInspectorValueScrub({
    disabled,
    value: percent,
    min: 0,
    max: 100,
    onChange: commitPercent,
  });

  useEffect(() => {
    if (!focused && !scrubbing && !scrubActiveRef.current) {
      setText(String(Math.round(Math.min(1, Math.max(0, value)) * 100)));
    }
  }, [value, instanceKey, focused, scrubbing, scrubActiveRef]);

  const applyDraft = (raw: string) => {
    const digits = raw.replace(/%/g, "").trim();
    if (digits === "") return false;
    const n = parseInt(digits, 10);
    if (!Number.isFinite(n)) return false;
    commitPercent(n);
    return true;
  };

  const nudge = (direction: 1 | -1, shift: boolean, alt: boolean) => {
    const step = keyboardNudgeStep(1, 0, shift, alt);
    const current = parseInt(text.replace(/%/g, ""), 10);
    const base = Number.isFinite(current) ? current : percent;
    commitPercent(base + step * direction);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      {...bindScrubInput(
        cn(
          baseField,
          "min-w-0 flex-1 text-right tabular-nums",
          className,
        ),
        focused,
      )}
      value={focused ? text : `${text}%`}
      onFocus={() => {
        setFocused(true);
        setText(String(percent));
      }}
      onChange={(e) => {
        const digits = e.target.value.replace(/%/g, "").replace(/[^\d]/g, "");
        setText(digits);
        if (commitOnInput && digits !== "") {
          const n = parseInt(digits, 10);
          if (Number.isFinite(n)) commitPercent(n);
        }
      }}
      onBlur={() => {
        if (scrubActiveRef.current) return;
        setFocused(false);
        if (!applyDraft(text)) setText(String(percent));
      }}
      onKeyDown={(e) => {
        handlePanelFieldKeyDown(e, {
          onEnter: () => {
            if (!applyDraft(text)) setText(String(percent));
            e.currentTarget.blur();
          },
          onArrowNudge: nudge,
        });
      }}
    />
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
      <div className="inspector-field-label">{label}</div>
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        className={cn(baseField, monospace && "font-mono")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={flush}
        onKeyDown={(e) => {
          handlePanelFieldKeyDown(e, {
            onEnter: () => {
              flush();
              e.currentTarget.blur();
            },
          });
        }}
      />
    </div>
  );
}
