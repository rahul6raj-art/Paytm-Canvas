"use client";

import { useEffect, useState } from "react";
import { normalizeHex } from "@/lib/color";
import { cn } from "@/lib/utils";

type ColorInputProps = {
  label?: string;
  hex: string;
  onCommitHex: (hex: string) => void;
  disabled?: boolean;
  instanceKey?: string;
};

export function ColorInput({
  label,
  hex,
  onCommitHex,
  disabled,
  instanceKey = "",
}: ColorInputProps) {
  const safe = normalizeHex(hex) ?? "#888888";
  const [text, setText] = useState(safe);

  useEffect(() => {
    setText(normalizeHex(hex) ?? "#888888");
  }, [hex, instanceKey]);

  const commitText = () => {
    const n = normalizeHex(text.startsWith("#") ? text : `#${text}`);
    if (n) {
      onCommitHex(n);
      setText(n);
    } else {
      setText(safe);
    }
  };

  return (
    <div>
      {label ? (
        <div className="mb-0.5 text-[11px] font-medium leading-4 text-[#8c8c8c]">{label}</div>
      ) : null}
      <div className="flex gap-1.5">
        <input
          type="color"
          value={safe}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.toLowerCase();
            onCommitHex(v);
            setText(v);
          }}
          className="h-6 w-9 shrink-0 cursor-pointer rounded border border-white/[0.1] bg-transparent p-px disabled:opacity-45"
        />
        <input
          type="text"
          disabled={disabled}
          className={cn(
            "h-6 min-h-[24px] min-w-0 flex-1 rounded border border-white/[0.1] bg-[#262626] px-1.5 py-0 font-mono text-[12px] leading-4 text-[#f5f5f5] focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-45",
          )}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>
    </div>
  );
}
