"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { appFieldClass } from "@/lib/appFieldStyles";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { TEXT_FONT_SIZES } from "@/lib/textTypography";
import { cn } from "@/lib/utils";

type FontSizeInputProps = {
  value: number;
  onCommit: (size: number) => void;
  disabled?: boolean;
  instanceKey?: string;
  min?: number;
  max?: number;
};

function clampSize(n: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, n)));
}

export function FontSizeInput({
  value,
  onCommit,
  disabled,
  instanceKey = "",
  min = 1,
  max = 512,
}: FontSizeInputProps) {
  const [text, setText] = useState(() => String(Math.round(value)));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(String(Math.round(value)));
  }, [value, instanceKey]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const commit = (n: number) => {
    const next = clampSize(n, min, max);
    onCommit(next);
    setText(String(next));
    setOpen(false);
  };

  const applyDraft = () => {
    const trimmed = text.trim();
    if (trimmed === "") {
      setText(String(Math.round(value)));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setText(String(Math.round(value)));
      return;
    }
    commit(n);
  };

  const nudge = (direction: 1 | -1, shift: boolean, alt: boolean) => {
    const delta = keyboardNudgeStep(1, 0, shift, alt) * direction;
    const current = Number(text.trim());
    const base = Number.isFinite(current) ? current : value;
    commit(base + delta);
  };

  const presetSizes = (() => {
    const rounded = Math.round(value);
    if (TEXT_FONT_SIZES.includes(rounded as (typeof TEXT_FONT_SIZES)[number])) {
      return TEXT_FONT_SIZES;
    }
    return [rounded, ...TEXT_FONT_SIZES] as readonly number[];
  })();

  return (
    <div ref={wrapRef} className="relative">
      <div className="inspector-field-label">Size</div>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          aria-label="Font size"
          disabled={disabled}
          className={cn(appFieldClass, "w-full pr-7 font-mono tabular-nums")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={applyDraft}
          onKeyDown={(e) => {
            handlePanelFieldKeyDown(e, {
              onEnter: () => {
                applyDraft();
                e.currentTarget.blur();
              },
              onArrowNudge: nudge,
            });
          }}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label="Font size presets"
          aria-expanded={open}
          className={cn(
            "absolute inset-y-0 right-0 flex w-7 items-center justify-center rounded-r text-app-muted transition-colors",
            disabled ? "opacity-45" : "hover:bg-app-hover hover:text-app-fg",
          )}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && !disabled ? (
        <ul
          role="listbox"
          aria-label="Font size presets"
          className="absolute z-50 mt-0.5 max-h-52 w-full overflow-y-auto rounded-md border border-app-border bg-app-panel py-0.5 shadow-lg"
        >
          {presetSizes.map((size) => (
            <li key={size} role="option" aria-selected={size === Math.round(value)}>
              <button
                type="button"
                className={cn(
                  "flex w-full px-2 py-1 text-left text-ui font-mono tabular-nums hover:bg-app-hover",
                  size === Math.round(value) && "bg-app-hover font-medium text-app-fg",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(size)}
              >
                {size}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
