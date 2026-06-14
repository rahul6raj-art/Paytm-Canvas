"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { fillCss, normalizeHex } from "@/lib/color";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import { appFieldRadius } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";
import { inspectorIconClass, inspectorIconStroke } from "@/lib/inspectorIconStyles";
import type {
  StrokeSideKey,
  StrokeSidesCustom,
  StrokeSidesCustomColors,
  StrokeSidesMode,
} from "@/lib/strokeAlign";
import {
  resolveStrokeSideColor,
  resolveStrokeSideWidths,
  strokeSidesCustomFromPreset,
} from "@/lib/strokeAlign";
import { InspectorColorPickerAside } from "../InspectorColorPickerAside";
import type { ColorCommitOptions } from "../ColorInput";
import {
  adjacentPanelDialogStyle,
  useAdjacentPanelDialogPosition,
} from "../useAdjacentPanelDialogPosition";
import { useDismissAnchoredDropdown } from "../useAnchoredDropdown";
import { useDraggableFloatingPanel } from "../useDraggableFloatingPanel";

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
const MENU_WIDTH_CUSTOM = 208;

function SideColorSwatch({
  side,
  hex,
  opacity,
  disabled,
  menuRef,
  onCommit,
  onOpenChange,
}: {
  side: StrokeSideKey;
  hex: string;
  opacity: number;
  disabled: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onCommit: (hex: string, opts?: ColorCommitOptions) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const swatchRef = useRef<HTMLButtonElement>(null);
  const safe = normalizeHex(hex) ?? "#888888";

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  useDismissAnchoredDropdown(open, () => setOpen(false), swatchRef, undefined, {
    ignoreRefs: [menuRef],
  });

  return (
    <>
      <button
        ref={swatchRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          "h-5 w-5 shrink-0 rounded border border-app-border p-px disabled:cursor-not-allowed",
          open && "border-accent ring-1 ring-accent",
        )}
        style={{ background: fillCss(safe, opacity) }}
        aria-label={`${side} stroke color`}
        aria-expanded={open}
        aria-haspopup="dialog"
      />
      <InspectorColorPickerAside
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={swatchRef}
        hostRef={menuRef}
        hostSide="left"
        title={`${side} stroke color`}
        hex={safe}
        opacity={opacity}
        disabled={disabled}
        onCommitHex={onCommit}
        onCommitOpacity={() => undefined}
      />
    </>
  );
}

function SideIcon({ mode }: { mode: StrokeSidesMode }) {
  const dash = "stroke-current";
  const solid = "stroke-current";
  const box = inspectorIconClass;
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
  return <SlidersHorizontal className={inspectorIconClass} strokeWidth={inspectorIconStroke} />;
}

function activeLabel(mode: StrokeSidesMode): string {
  return PRESET_OPTIONS.find((o) => o.id === mode)?.label ?? "Custom";
}

function CustomSideField({
  side,
  mode,
  value,
  color,
  strokeOpacity,
  disabled,
  menuRef,
  onChange,
  onColorChange,
  onScrubActiveChange,
  onColorPickerOpenChange,
}: {
  side: CustomSide;
  mode: StrokeSidesMode;
  value: number;
  color: string;
  strokeOpacity: number;
  disabled: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onChange: (side: CustomSide, width: number) => void;
  onColorChange: (side: CustomSide, hex: string, opts?: ColorCommitOptions) => void;
  onScrubActiveChange?: (active: boolean) => void;
  onColorPickerOpenChange?: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  const commitWidth = (n: number) => {
    const w = Math.min(256, Math.max(0, n));
    onChange(side, w);
    setDraft(String(w));
  };

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      commitWidth(0);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    commitWidth(n);
  };

  const scrub = useInspectorValueScrub({
    disabled,
    value,
    min: 0,
    max: 256,
    onChange: commitWidth,
  });
  const { scrubbing, scrubActiveRef, bindScrubInput } = scrub;

  useEffect(() => {
    onScrubActiveChange?.(scrubbing);
  }, [onScrubActiveChange, scrubbing]);

  useEffect(() => {
    if (!focused && !scrubbing && !scrubActiveRef.current) setDraft(String(value));
  }, [value, focused, scrubbing, scrubActiveRef]);

  return (
    <div
      className={cn(
        "flex h-7 items-center gap-1 border border-app-border bg-app-field px-1",
        appFieldRadius,
      )}
    >
      <SideColorSwatch
        side={side}
        hex={color}
        opacity={strokeOpacity}
        disabled={disabled}
        menuRef={menuRef}
        onCommit={(hex, opts) => onColorChange(side, hex, opts)}
        onOpenChange={onColorPickerOpenChange}
      />
      <SideIcon mode={mode} />
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        aria-label={`${side} stroke width`}
        {...bindScrubInput(
          "min-w-0 flex-1 border-0 bg-transparent text-right text-ui tabular-nums text-app-field-fg focus-visible:outline-none disabled:cursor-not-allowed",
          focused,
        )}
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (scrubActiveRef.current) return;
          setFocused(false);
          commit(draft);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          handlePanelFieldKeyDown(e, {
            onEnter: () => {
              commit(draft);
              e.currentTarget.blur();
            },
            onArrowNudge: (dir, shift, alt) => {
              const step = keyboardNudgeStep(1, 0, shift, alt) * dir;
              const n = Number(draft.trim());
              const base = Number.isFinite(n) ? n : value;
              commit(String(Math.max(0, base + step)));
            },
          });
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function StrokeSidesPicker({
  disabled,
  strokeSides,
  strokeSidesCustom,
  strokeSidesCustomColors,
  strokeColor,
  strokeOpacity = 1,
  strokeWidth,
  instanceKey,
  onChange,
}: {
  disabled: boolean;
  strokeSides: StrokeSidesMode;
  strokeSidesCustom?: StrokeSidesCustom;
  strokeSidesCustomColors?: StrokeSidesCustomColors;
  strokeColor: string;
  strokeOpacity?: number;
  strokeWidth: number;
  instanceKey: string;
  onChange: (patch: {
    strokeSides?: StrokeSidesMode;
    strokeSidesCustom?: StrokeSidesCustom;
    strokeSidesCustomColors?: StrokeSidesCustomColors;
    strokeWidth?: number;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showCustomGrid, setShowCustomGrid] = useState(strokeSides === "custom");
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const blockDismissRef = useRef(false);
  const colorPickerOpenRef = useRef(false);
  const scrubActiveRef = useRef(false);

  const setSideScrubActive = (active: boolean) => {
    scrubActiveRef.current = active;
    blockDismissRef.current = active || colorPickerOpenRef.current;
  };

  const setSideColorPickerOpen = (pickerOpen: boolean) => {
    colorPickerOpenRef.current = pickerOpen;
    blockDismissRef.current = pickerOpen || scrubActiveRef.current;
  };

  const showGrid = showCustomGrid || strokeSides === "custom";
  const menuWidth = showGrid ? MENU_WIDTH_CUSTOM : MENU_WIDTH_PRESETS;

  const basePosition = useAdjacentPanelDialogPosition(anchorRef, open, {
    width: menuWidth,
    maxHeight: showGrid ? 480 : 360,
    remeasureKey: showGrid,
  });
  const { position: dragPosition, onHeaderPointerDown, isDragging } = useDraggableFloatingPanel(
    open,
    basePosition,
  );
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef, {
    blockDismissRef,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

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
  }, [open, showGrid]);

  const customWidths = resolveStrokeSideWidths({
    strokeSides: "custom",
    strokeSidesCustom,
    strokeWidth,
  });

  const patchCustomSide = (side: CustomSide, width: number) => {
    const next: StrokeSidesCustom = { ...(strokeSidesCustom ?? {}) };
    next[side] = Math.max(0, width);
    onChange({ strokeSides: "custom", strokeSidesCustom: next });
    setShowCustomGrid(true);
  };

  const patchCustomSideColor = (side: CustomSide, hex: string) => {
    const next: StrokeSidesCustomColors = { ...(strokeSidesCustomColors ?? {}) };
    next[side] = hex;
    onChange({ strokeSides: "custom", strokeSidesCustomColors: next });
    setShowCustomGrid(true);
  };

  const resetCustomSides = () => {
    onChange({
      strokeSides: "custom",
      strokeSidesCustom: { top: 0, right: 0, bottom: 0, left: 0 },
      strokeSidesCustomColors: undefined,
      strokeWidth: 0,
    });
  };

  const colorNode = {
    strokeColor,
    strokeSidesCustomColors,
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
        role="dialog"
        aria-label="Stroke sides"
        aria-modal="false"
        className="fixed z-[120] flex flex-col overflow-hidden rounded-md border border-app-border bg-app-panel shadow-xl"
        style={adjacentPanelDialogStyle(dragPosition)}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-between gap-2 border-b border-app-border px-2.5 py-2",
            "cursor-grab select-none touch-none active:cursor-grabbing",
            isDragging && "cursor-grabbing",
          )}
          onPointerDown={onHeaderPointerDown}
        >
          <div className="inspector-field-label pointer-events-none">Stroke sides</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-app-muted hover:bg-app-hover hover:text-app-fg"
            aria-label="Close stroke sides"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto py-1">
        {PRESET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
            onClick={() => {
              onChange({ strokeSides: opt.id });
              setShowCustomGrid(false);
              setOpen(false);
            }}
          >
            <span className="w-4 text-app-muted">
              {strokeSides === opt.id ? <Check className={inspectorIconClass} strokeWidth={inspectorIconStroke} /> : null}
            </span>
            <SideIcon mode={opt.id} />
            <span>{opt.label}</span>
          </button>
        ))}
        <div className="my-1 border-t border-app-border" />
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
          onMouseDown={enterCustom}
          onClick={enterCustom}
        >
          <span className="w-4 text-app-muted">
            {strokeSides === "custom" ? <Check className={inspectorIconClass} strokeWidth={inspectorIconStroke} /> : null}
          </span>
          <SideIcon mode="custom" />
          <span>Custom</span>
        </button>
        {showGrid ? (
          <div ref={gridRef} className="border-t border-app-border px-2 pb-2 pt-1.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-ui font-medium text-app-muted">Side weights (px)</div>
              <button
                type="button"
                disabled={disabled}
                title="Reset side weights and colors"
                aria-label="Reset side weights and colors"
                onClick={(e) => {
                  e.stopPropagation();
                  resetCustomSides();
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-muted hover:bg-app-hover hover:text-app-fg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {CUSTOM_GRID.map(({ side, mode }) => (
                <CustomSideField
                  key={`${instanceKey}-${side}`}
                  side={side}
                  mode={mode}
                  value={customWidths[side]}
                  color={resolveStrokeSideColor(colorNode, side)}
                  strokeOpacity={strokeOpacity}
                  disabled={disabled}
                  menuRef={menuRef}
                  onChange={patchCustomSide}
                  onColorChange={patchCustomSideColor}
                  onScrubActiveChange={setSideScrubActive}
                  onColorPickerOpenChange={setSideColorPickerOpen}
                />
              ))}
            </div>
          </div>
        ) : null}
        </div>
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
