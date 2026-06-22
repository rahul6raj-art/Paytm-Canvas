"use client";

import { appFieldClass } from "@/lib/appFieldStyles";
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
  min = 1,
  max = 512,
}: FontSizeInputProps) {
  const rounded = clampSize(value, min, max);
  const inPresets = TEXT_FONT_SIZES.includes(rounded as (typeof TEXT_FONT_SIZES)[number]);

  return (
    <div>
      <div className="inspector-field-label">Size</div>
      <select
        aria-label="Font size"
        disabled={disabled}
        className={cn(appFieldClass, "w-full cursor-pointer font-mono tabular-nums")}
        value={rounded}
        onChange={(e) => onCommit(clampSize(Number(e.target.value), min, max))}
      >
        {!inPresets ? <option value={rounded}>{rounded}</option> : null}
        {TEXT_FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  );
}
