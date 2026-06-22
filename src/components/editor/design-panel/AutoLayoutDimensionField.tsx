"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeftRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  Maximize2,
  Shrink,
} from "lucide-react";
import {
  appFieldInnerClass,
  appFieldInnerClassCompact,
  appFieldShellClass,
} from "@/lib/appFieldStyles";
import {
  inspectorFieldIconSlotClass,
  inspectorIconClass,
  inspectorIconStroke,
} from "@/lib/inspectorIconStyles";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "../useAnchoredDropdown";
import { handlePanelFieldKeyDown } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";
import type { LayoutSizingMode } from "@/stores/useEditorStore";

type Axis = "horizontal" | "vertical";

const MIN_DIMENSION = 1;
const MAX_DIMENSION = 99999;

function axisLabel(axis: Axis, kind: "fixed" | "hug" | "fill" | "min" | "max"): string {
  const dim = axis === "horizontal" ? "width" : "height";
  const Dim = axis === "horizontal" ? "Width" : "Height";
  switch (kind) {
    case "fixed":
      return `Fixed ${dim}`;
    case "hug":
      return "Hug contents";
    case "fill":
      return "Fill container";
    case "min":
      return `Min ${dim}`;
    case "max":
      return `Max ${dim}`;
  }
}

function modeIcon(mode: LayoutSizingMode, axis: Axis) {
  if (mode === "hug") return Shrink;
  if (mode === "fill") return axis === "horizontal" ? ArrowLeftRight : ArrowUpDown;
  return Maximize2;
}

function modeAccent(mode: LayoutSizingMode): boolean {
  return mode === "hug" || mode === "fill";
}

export function AutoLayoutDimensionField({
  axis,
  value,
  sizingMode,
  minConstraint,
  maxConstraint,
  locked,
  allowFill,
  mixed,
  instanceKey,
  onSelectMode,
  onCommitDimension,
  onCommitMin,
  onCommitMax,
}: {
  axis: Axis;
  value: number;
  sizingMode: LayoutSizingMode;
  minConstraint?: number;
  maxConstraint?: number;
  locked: boolean;
  allowFill: boolean;
  mixed?: boolean;
  instanceKey: string;
  onSelectMode: (mode: LayoutSizingMode) => void;
  onCommitDimension: (value: number) => void;
  onCommitMin?: (value: number | undefined) => void;
  onCommitMax?: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(String(Math.round(value)));
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [minDraft, setMinDraft] = useState("");
  const [maxDraft, setMaxDraft] = useState("");
  const [editingMin, setEditingMin] = useState(false);
  const [editingMax, setEditingMax] = useState(false);
  const chevronRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const dimensionEditable = sizingMode === "fixed";
  const displayValue = mixed ? "—" : String(Math.round(value));
  const ModeIcon = modeIcon(sizingMode, axis);

  const position = useAnchoredDropdownPosition(chevronRef, menuOpen, 4, {
    viewportClamp: true,
    width: 196,
  });
  useDismissAnchoredDropdown(menuOpen, () => setMenuOpen(false), chevronRef, menuRef);

  useEffect(() => {
    if (!focused) setText(displayValue);
  }, [displayValue, instanceKey, focused]);

  useEffect(() => {
    if (!menuOpen) {
      setEditingMin(false);
      setEditingMax(false);
    }
  }, [menuOpen]);

  const commitDimension = (raw: string) => {
    const n = Number(raw.trim());
    if (!Number.isFinite(n)) return;
    const next = Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(n)));
    onCommitDimension(next);
    setText(String(next));
  };

  const pinFixed = () => {
    if (sizingMode !== "fixed") onSelectMode("fixed");
  };

  const { scrubActiveRef, bindScrubInput } = useInspectorValueScrub({
    disabled: locked || !dimensionEditable || mixed,
    value,
    decimals: 0,
    step: 1,
    min: MIN_DIMENSION,
    max: MAX_DIMENSION,
    onChange: (v) => {
      onCommitDimension(v);
      setText(String(v));
    },
  });

  const dimensionInputProps = {
    type: "text" as const,
    inputMode: "decimal" as const,
    disabled: locked || mixed,
    value: mixed ? "—" : text,
    "aria-label": axis === "horizontal" ? "Width" : "Height",
    onFocus: () => {
      setFocused(true);
      pinFixed();
    },
    onBlur: () => {
      if (scrubActiveRef.current) return;
      setFocused(false);
      if (!mixed) commitDimension(text);
    },
    onChange: (e: ChangeEvent<HTMLInputElement>) => setText(e.target.value),
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      handlePanelFieldKeyDown(e, {
        onEnter: () => {
          commitDimension(text);
          e.currentTarget.blur();
        },
        onArrowNudge: (dir, shift) => {
          const step = shift ? 10 : 1;
          const n = Number(text);
          const base = Number.isFinite(n) ? n : value;
          commitDimension(String(base + dir * step));
        },
      });
    },
  };

  const inputClass = cn(appFieldInnerClass, "font-mono tabular-nums");

  const commitConstraint = (
    raw: string,
    kind: "min" | "max",
    current: number | undefined,
    onCommit: ((v: number | undefined) => void) | undefined,
  ) => {
    if (!onCommit) return;
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "0") {
      onCommit(undefined);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return;
    const next = Math.min(MAX_DIMENSION, Math.round(n));
    if (kind === "min" && maxConstraint != null && next > maxConstraint) return;
    if (kind === "max" && minConstraint != null && next < minConstraint) return;
    onCommit(next);
  };

  const menuOptions: LayoutSizingMode[] = ["fixed", "hug", ...(allowFill ? (["fill"] as const) : [])];

  const menu =
    menuOpen && mounted ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label={axis === "horizontal" ? "Width sizing" : "Height sizing"}
        className="fixed z-[120] w-[196px] overflow-hidden editor-floating-menu"
        style={anchoredMenuStyle(position)}
      >
        {menuOptions.map((mode) => {
          const selected = sizingMode === mode;
          const Icon = modeIcon(mode, axis);
          if (mode === "fixed") {
            return (
              <button
                key={mode}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={locked}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1 text-left transition-colors hover:bg-app-hover disabled:opacity-40",
                  selected && "bg-app-hover",
                )}
                onClick={pinFixed}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {selected ? (
                    <Check className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
                  ) : null}
                </span>
                <Icon
                  className={cn(inspectorIconClass, "shrink-0 opacity-80")}
                  strokeWidth={inspectorIconStroke}
                />
                <input
                  {...dimensionInputProps}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={cn(inputClass, appFieldInnerClassCompact, "h-6 min-w-0 flex-1 px-1.5")}
                />
              </button>
            );
          }
          return (
            <button
              key={mode}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={locked}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-ui text-app-fg transition-colors hover:bg-app-hover disabled:opacity-40",
                selected && "bg-app-hover",
              )}
              onClick={() => {
                onSelectMode(mode);
                setMenuOpen(false);
              }}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {selected ? (
                  <Check className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
                ) : null}
              </span>
              <Icon
                className={cn(inspectorIconClass, "shrink-0 opacity-80")}
                strokeWidth={inspectorIconStroke}
              />
              <span>{axisLabel(axis, mode)}</span>
            </button>
          );
        })}

        <div className="my-1 border-t border-app-border" />

        {onCommitMin ? (
          editingMin || minConstraint != null ? (
            <div className="flex items-center gap-2 px-2 py-1">
              <span className="w-4 shrink-0" />
              <span className="min-w-0 flex-1 text-ui text-app-muted">{axisLabel(axis, "min")}</span>
              <input
                type="text"
                inputMode="decimal"
                disabled={locked}
                value={editingMin ? minDraft : minConstraint != null ? String(minConstraint) : ""}
                placeholder="—"
                className={cn(inputClass, appFieldInnerClassCompact, "h-6 w-[72px] px-1.5")}
                onFocus={() => {
                  setEditingMin(true);
                  setMinDraft(minConstraint != null ? String(minConstraint) : "");
                }}
                onBlur={() => {
                  setEditingMin(false);
                  commitConstraint(minDraft, "min", minConstraint, onCommitMin);
                }}
                onChange={(e) => setMinDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitConstraint(minDraft, "min", minConstraint, onCommitMin);
                    e.currentTarget.blur();
                  }
                  if (e.key === "Escape") {
                    setEditingMin(false);
                    e.currentTarget.blur();
                  }
                }}
              />
              {minConstraint != null ? (
                <button
                  type="button"
                  disabled={locked}
                  className="text-ui text-app-muted hover:text-app-fg disabled:opacity-40"
                  onClick={() => {
                    onCommitMin(undefined);
                    setMinDraft("");
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              disabled={locked}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-ui text-app-fg transition-colors hover:bg-app-hover disabled:opacity-40"
              onClick={() => {
                setEditingMin(true);
                setMinDraft("");
              }}
            >
              <span className="w-4 shrink-0" />
              <span>Add {axisLabel(axis, "min").toLowerCase()}…</span>
            </button>
          )
        ) : null}

        {onCommitMax ? (
          editingMax || maxConstraint != null ? (
            <div className="flex items-center gap-2 px-2 py-1">
              <span className="w-4 shrink-0" />
              <span className="min-w-0 flex-1 text-ui text-app-muted">{axisLabel(axis, "max")}</span>
              <input
                type="text"
                inputMode="decimal"
                disabled={locked}
                value={editingMax ? maxDraft : maxConstraint != null ? String(maxConstraint) : ""}
                placeholder="—"
                className={cn(inputClass, appFieldInnerClassCompact, "h-6 w-[72px] px-1.5")}
                onFocus={() => {
                  setEditingMax(true);
                  setMaxDraft(maxConstraint != null ? String(maxConstraint) : "");
                }}
                onBlur={() => {
                  setEditingMax(false);
                  commitConstraint(maxDraft, "max", maxConstraint, onCommitMax);
                }}
                onChange={(e) => setMaxDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitConstraint(maxDraft, "max", maxConstraint, onCommitMax);
                    e.currentTarget.blur();
                  }
                  if (e.key === "Escape") {
                    setEditingMax(false);
                    e.currentTarget.blur();
                  }
                }}
              />
              {maxConstraint != null ? (
                <button
                  type="button"
                  disabled={locked}
                  className="text-ui text-app-muted hover:text-app-fg disabled:opacity-40"
                  onClick={() => {
                    onCommitMax(undefined);
                    setMaxDraft("");
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              disabled={locked}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-ui text-app-fg transition-colors hover:bg-app-hover disabled:opacity-40"
              onClick={() => {
                setEditingMax(true);
                setMaxDraft("");
              }}
            >
              <span className="w-4 shrink-0" />
              <span>Add {axisLabel(axis, "max").toLowerCase()}…</span>
            </button>
          )
        ) : null}
      </div>
    ) : null;

  return (
    <>
      <div className={cn(appFieldShellClass, locked && "opacity-45")}>
        <div
          className={cn(
            inspectorFieldIconSlotClass,
            "h-full border-r border-app-border font-mono text-ui font-medium",
            modeAccent(sizingMode) && "text-accent",
          )}
          aria-hidden
        >
          <ModeIcon className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
        </div>
        {!dimensionEditable || mixed ? (
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center px-2 font-mono text-ui tabular-nums",
              !mixed && modeAccent(sizingMode) ? "text-app-muted" : "text-app-fg",
            )}
          >
            {mixed ? "—" : text}
          </div>
        ) : (
          <input {...dimensionInputProps} {...bindScrubInput(inputClass, focused)} />
        )}
        <EditorHintWrap
          title={axis === "horizontal" ? "Width sizing" : "Height sizing"}
          disabled={locked}
        >
          <button
            ref={chevronRef}
            type="button"
            disabled={locked}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-label={axis === "horizontal" ? "Width sizing" : "Height sizing"}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              inspectorFieldIconSlotClass,
              "border-r-0 border-l text-app-muted transition-colors",
              locked ? "opacity-45" : "hover:bg-app-hover hover:text-app-fg",
            )}
          >
            <ChevronDown
              className={cn(inspectorIconClass, "transition-transform", menuOpen && "rotate-180")}
              strokeWidth={inspectorIconStroke}
            />
          </button>
        </EditorHintWrap>
      </div>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
