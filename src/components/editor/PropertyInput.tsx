"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const baseField =
  "h-6 min-h-[24px] w-full rounded border border-white/[0.1] bg-[#262626] px-1.5 py-0 text-[12px] leading-4 text-[#f5f5f5] placeholder:text-[#6b6b6b] focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-45";

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
};

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
}: PropertyNumberInputProps) {
  const format = (n: number) =>
    decimals > 0 ? String(Number(n.toFixed(decimals))) : String(Math.round(n));

  const [text, setText] = useState(() => format(value));

  useEffect(() => {
    setText(format(value));
  }, [value, instanceKey, decimals]);

  const apply = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
      return false;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return false;
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onCommit(v);
    setText(format(v));
    return true;
  };

  const onBlur = () => {
    if (!apply(text)) setText(format(value));
  };

  return (
    <div>
      <div className="mb-0.5 text-[11px] font-medium leading-4 text-[#8c8c8c]">{label}</div>
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
            (e.target as HTMLInputElement).blur();
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
      <div className="mb-0.5 text-[11px] font-medium leading-4 text-[#8c8c8c]">{label}</div>
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
