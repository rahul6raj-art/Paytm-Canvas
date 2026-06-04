"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StrokeSidesCustom, StrokeSidesMode } from "@/lib/strokeAlign";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "../useAnchoredDropdown";

type SideOption = { id: StrokeSidesMode; label: string };

const PRESET_OPTIONS: SideOption[] = [
  { id: "all", label: "All" },
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
];

function SideIcon({ mode }: { mode: StrokeSidesMode }) {
  const dash = "stroke-current";
  const solid = "stroke-current";
  const box = "h-3.5 w-3.5 shrink-0";
  if (mode === "all") {
    return (
      <svg className={box} viewBox="0 0 14 14" aria-hidden>
        <rect x={1.5} y={1.5} width={11} height={11} fill="none" className={solid} strokeWidth={1.5} />
      </svg>
    );
  }
  if (mode === "top") {
    return (
      <svg className={box} viewBox="0 0 14 14" aria-hidden>
        <rect x={1.5} y={1.5} width={11} height={11} fill="none" className={dash} strokeWidth={1} strokeDasharray="2 1.5" />
        <line x1={1.5} y1={1.5} x2={12.5} y2={1.5} className={solid} strokeWidth={1.75} />
      </svg>
    );
  }
  if (mode === "bottom") {
    return (
      <svg className={box} viewBox="0 0 14 14" aria-hidden>
        <rect x={1.5} y={1.5} width={11} height={11} fill="none" className={dash} strokeWidth={1} strokeDasharray="2 1.5" />
        <line x1={1.5} y1={12.5} x2={12.5} y2={12.5} className={solid} strokeWidth={1.75} />
      </svg>
    );
  }
  if (mode === "left") {
    return (
      <svg className={box} viewBox="0 0 14 14" aria-hidden>
        <rect x={1.5} y={1.5} width={11} height={11} fill="none" className={dash} strokeWidth={1} strokeDasharray="2 1.5" />
        <line x1={1.5} y1={1.5} x2={1.5} y2={12.5} className={solid} strokeWidth={1.75} />
      </svg>
    );
  }
  if (mode === "right") {
    return (
      <svg className={box} viewBox="0 0 14 14" aria-hidden>
        <rect x={1.5} y={1.5} width={11} height={11} fill="none" className={dash} strokeWidth={1} strokeDasharray="2 1.5" />
        <line x1={12.5} y1={1.5} x2={12.5} y2={12.5} className={solid} strokeWidth={1.75} />
      </svg>
    );
  }
  return <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />;
}

function activeLabel(mode: StrokeSidesMode): string {
  return PRESET_OPTIONS.find((o) => o.id === mode)?.label ?? "Custom";
}

export function StrokeSidesPicker({
  disabled,
  strokeSides,
  strokeSidesCustom,
  onChange,
}: {
  disabled: boolean;
  strokeSides: StrokeSidesMode;
  strokeSidesCustom?: StrokeSidesCustom;
  onChange: (patch: { strokeSides?: StrokeSidesMode; strokeSidesCustom?: StrokeSidesCustom }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pos = useAnchoredDropdownPosition(anchorRef, open, 4, { viewportClamp: true, width: 168 });
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);

  useEffect(() => setMounted(true), []);

  const custom = strokeSidesCustom ?? {};
  const customFlags = {
    top: custom.top !== false,
    right: custom.right !== false,
    bottom: custom.bottom !== false,
    left: custom.left !== false,
  };

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        className="fixed z-[120] overflow-hidden rounded-md border border-app-border bg-app-panel py-1 shadow-xl"
        style={anchoredMenuStyle(pos)}
      >
        {PRESET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-app-fg hover:bg-app-hover"
            onClick={() => {
              onChange({ strokeSides: opt.id });
              setOpen(false);
            }}
          >
            <span className="w-4 text-app-muted">
              {strokeSides === opt.id ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : null}
            </span>
            <SideIcon mode={opt.id} />
            <span>{opt.label}</span>
          </button>
        ))}
        <div className="my-1 border-t border-app-border" />
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-app-fg hover:bg-app-hover"
          onClick={() => {
            onChange({
              strokeSides: "custom",
              strokeSidesCustom: customFlags,
            });
            setOpen(false);
          }}
        >
          <span className="w-4 text-app-muted">
            {strokeSides === "custom" ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : null}
          </span>
          <SideIcon mode="custom" />
          <span>Custom</span>
        </button>
        {strokeSides === "custom" ? (
          <div className="border-t border-app-border px-2.5 py-1.5">
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <label
                key={side}
                className="flex cursor-pointer items-center gap-2 py-0.5 text-[11px] capitalize text-app-muted"
              >
                <input
                  type="checkbox"
                  checked={customFlags[side]}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({
                      strokeSides: "custom",
                      strokeSidesCustom: { ...customFlags, [side]: e.target.checked },
                    })
                  }
                  className="rounded border-app-border"
                />
                {side}
              </label>
            ))}
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        title={`Stroke sides: ${activeLabel(strokeSides)}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded border border-app-border bg-app-panel text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-40",
          open && "border-accent bg-accent/10 text-accent",
        )}
      >
        <SideIcon mode={strokeSides === "custom" ? "custom" : strokeSides} />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
