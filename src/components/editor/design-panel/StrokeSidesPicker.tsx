"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Check, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StrokeSidesCustom, StrokeSidesMode } from "@/lib/strokeAlign";
import {
  resolveStrokeSideWidths,
  strokeSidesCustomFromPreset,
} from "@/lib/strokeAlign";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "../useAnchoredDropdown";

type SideOption = { id: StrokeSidesMode; label: string };
type CustomSide = keyof StrokeSidesCustom;

const PRESET_OPTIONS: SideOption[] = [
  { id: "all", label: "All" },
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
];

/** Figma order: left / top, right / bottom */
const CUSTOM_GRID: { side: CustomSide; mode: StrokeSidesMode }[] = [
  { side: "left", mode: "left" },
  { side: "top", mode: "top" },
  { side: "right", mode: "right" },
  { side: "bottom", mode: "bottom" },
];

const MENU_WIDTH_PRESETS = 132;
const MENU_WIDTH_CUSTOM = 168;

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

function CustomSideField({
  side,
  mode,
  value,
  disabled,
  onChange,
}: {
  side: CustomSide;
  mode: StrokeSidesMode;
  value: number;
  disabled: boolean;
  onChange: (side: CustomSide, width: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onChange(side, 0);
      setDraft("0");
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const w = Math.max(0, n);
    onChange(side, w);
    setDraft(String(w));
  };

  return (
    <div className="flex h-7 items-center gap-1.5 rounded border border-app-border bg-app-field px-1.5">
      <SideIcon mode={mode} />
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        aria-label={`${side} stroke width`}
        className="min-w-0 flex-1 border-0 bg-transparent text-right text-[12px] tabular-nums text-app-field-fg focus-visible:outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
            (e.target as HTMLInputElement).blur();
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function StrokeSidesPicker({
  disabled,
  strokeSides,
  strokeSidesCustom,
  strokeWidth,
  onChange,
}: {
  disabled: boolean;
  strokeSides: StrokeSidesMode;
  strokeSidesCustom?: StrokeSidesCustom;
  strokeWidth: number;
  onChange: (patch: { strokeSides?: StrokeSidesMode; strokeSidesCustom?: StrokeSidesCustom }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showCustomGrid, setShowCustomGrid] = useState(strokeSides === "custom");
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const showGrid = showCustomGrid || strokeSides === "custom";
  const menuWidth = showGrid ? MENU_WIDTH_CUSTOM : MENU_WIDTH_PRESETS;

  const pos = useAnchoredDropdownPosition(anchorRef, open, 4, {
    viewportClamp: true,
    width: menuWidth,
    minHeight: showGrid ? 280 : 200,
    maxHeight: showGrid ? 480 : 360,
    remeasureKey: showGrid,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (strokeSides === "custom") setShowCustomGrid(true);
  }, [strokeSides]);

  useLayoutEffect(() => {
    if (!open || !showGrid) return;
    const menu = menuRef.current;
    const grid = gridRef.current;
    if (!menu || !grid) return;
    grid.scrollIntoView({ block: "nearest" });
    menu.scrollTop = menu.scrollHeight - menu.clientHeight;
  }, [open, showGrid, strokeSidesCustom]);

  const customWidths = resolveStrokeSideWidths({
    strokeSides: "custom",
    strokeSidesCustom,
    strokeWidth,
  });

  const patchCustomSide = (side: CustomSide, width: number) => {
    const next: StrokeSidesCustom = { ...(strokeSidesCustom ?? {}) };
    next[side] = width;
    onChange({ strokeSides: "custom", strokeSidesCustom: next });
  };

  const enterCustom = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const preset =
      strokeSides === "custom"
        ? strokeSidesCustom ?? strokeSidesCustomFromPreset("all", strokeWidth)
        : strokeSidesCustomFromPreset(strokeSides, strokeWidth);
    onChange({ strokeSides: "custom", strokeSidesCustom: preset });
    setShowCustomGrid(true);
  };

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        className="fixed z-[120] overflow-y-auto rounded-md border border-app-border bg-app-panel py-1 shadow-xl"
        style={anchoredMenuStyle(pos)}
      >
        {PRESET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-app-fg hover:bg-app-hover"
            onClick={() => {
              onChange({ strokeSides: opt.id });
              setShowCustomGrid(false);
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
          onMouseDown={enterCustom}
          onClick={enterCustom}
        >
          <span className="w-4 text-app-muted">
            {strokeSides === "custom" ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : null}
          </span>
          <SideIcon mode="custom" />
          <span>Custom</span>
        </button>
        {showGrid ? (
          <div ref={gridRef} className="border-t border-app-border px-2 pb-2 pt-1.5">
            <div className="mb-1.5 px-0.5 text-[10px] font-medium uppercase tracking-wide text-app-muted">
              Side weights (px)
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {CUSTOM_GRID.map(({ side, mode }) => (
                <CustomSideField
                  key={side}
                  side={side}
                  mode={mode}
                  value={customWidths[side]}
                  disabled={disabled}
                  onChange={patchCustomSide}
                />
              ))}
            </div>
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
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next && strokeSides === "custom") setShowCustomGrid(true);
            return next;
          });
        }}
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
