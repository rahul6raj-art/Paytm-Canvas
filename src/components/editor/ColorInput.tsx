"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Eye, EyeOff, Minus } from "lucide-react";
import { normalizeHex, parseHexInputLive, fillCss } from "@/lib/color";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import { appFieldRadius, inspectorControlHeightClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";
import {
  inspectorIconClass,
  inspectorIconStroke,
  inspectorLucideProps,
  inspectorRowActionBtnClass,
} from "@/lib/inspectorIconStyles";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";
import { InspectorColorPickerAside } from "./InspectorColorPickerAside";
import { LibraryColorPickerMenu } from "./LibraryColorPickerMenu";

export type ColorCommitOptions = { skipHistory?: boolean };

type ColorInputProps = {
  variant?: "default" | "inspectorRow";
  label?: string;
  /** Design-system / library style name when this color is linked to a token */
  libraryName?: string;
  /** Token id for the linked library color — enables picker on name click */
  libraryTokenId?: string;
  hex: string;
  opacity?: number;
  onCommitHex: (hex: string, opts?: ColorCommitOptions) => void;
  onCommitOpacity?: (opacity: number, opts?: ColorCommitOptions) => void;
  pickerTitle?: string;
  disabled?: boolean;
  instanceKey?: string;
  /** Figma-style row: layer visibility */
  visible?: boolean;
  onToggleVisible?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  /** When true and hex field is not focused, show "Mixed" instead of the hex value. */
  hexMixed?: boolean;
};

export function ColorInput({
  variant = "default",
  label,
  libraryName,
  libraryTokenId,
  hex,
  opacity = 1,
  onCommitHex,
  onCommitOpacity,
  pickerTitle,
  disabled,
  instanceKey = "",
  visible = true,
  onToggleVisible,
  onRemove,
  removeLabel = "Remove color",
  hexMixed = false,
}: ColorInputProps) {
  const safe = normalizeHex(hex) ?? "#888888";
  const [text, setText] = useState(() =>
    variant === "inspectorRow" ? safe.replace("#", "").toUpperCase() : safe,
  );
  const [focused, setFocused] = useState(false);
  const [opacityFocused, setOpacityFocused] = useState(false);
  const [opacityText, setOpacityText] = useState(() =>
    String(Math.round(Math.min(1, Math.max(0, opacity)) * 100)),
  );
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastAppliedRef = useRef(safe);
  const dirtyLiveRef = useRef(false);
  const libraryAnchorRef = useRef<HTMLButtonElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);
  const libraryMenuRef = useRef<HTMLDivElement>(null);
  const applyTokenToSelection = useEditorStore((s) => s.applyTokenToSelection);

  const canPickLibrary = Boolean(libraryName && libraryTokenId && !disabled);

  const libraryPosition = useAnchoredDropdownPosition(libraryAnchorRef, libraryPickerOpen, 4, {
    viewportClamp: true,
    maxHeight: 360,
    width: 240,
  });
  useDismissAnchoredDropdown(
    libraryPickerOpen,
    () => setLibraryPickerOpen(false),
    libraryAnchorRef,
    libraryMenuRef,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (focused) return;
    const n = normalizeHex(hex) ?? "#888888";
    setText(variant === "inspectorRow" ? n.replace("#", "").toUpperCase() : n);
    lastAppliedRef.current = n;
    dirtyLiveRef.current = false;
  }, [hex, instanceKey, focused, variant]);

  useEffect(() => {
    if (!canPickLibrary) setLibraryPickerOpen(false);
  }, [canPickLibrary]);

  const previewHex = (focused ? parseHexInputLive(text) : null) ?? safe;

  const applyHex = (n: string, opts?: ColorCommitOptions) => {
    if (n === lastAppliedRef.current) return;
    onCommitHex(n, opts);
    lastAppliedRef.current = n;
    if (opts?.skipHistory) dirtyLiveRef.current = true;
  };

  const handleTextChange = (raw: string) => {
    if (variant === "inspectorRow") {
      const cleaned = raw.replace(/#/g, "").replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
      setText(cleaned.toUpperCase());
      const n = parseHexInputLive(cleaned);
      if (n) applyHex(n, { skipHistory: true });
      return;
    }
    setText(raw);
    const n = parseHexInputLive(raw);
    if (n) applyHex(n, { skipHistory: true });
  };

  const finishEditing = () => {
    setFocused(false);
    const n =
      variant === "inspectorRow"
        ? parseHexInputLive(text) ?? normalizeHex(`#${text}`)
        : parseHexInputLive(text) ?? normalizeHex(text.startsWith("#") ? text : `#${text}`);
    if (n) {
      applyHex(n, { skipHistory: true });
      setText(variant === "inspectorRow" ? n.replace("#", "").toUpperCase() : n);
    } else {
      setText(
        variant === "inspectorRow" ? safe.replace("#", "").toUpperCase() : safe,
      );
      lastAppliedRef.current = safe;
    }
    if (dirtyLiveRef.current) {
      useEditorStore.getState().pushHistory();
      dirtyLiveRef.current = false;
    }
  };

  const commitOpacityPercent = (n: number) => {
    if (!onCommitOpacity) return;
    const clamped = Math.min(100, Math.max(0, Math.round(n)));
    onCommitOpacity(clamped / 100);
    setOpacityText(String(clamped));
  };

  const applyOpacityDraft = (raw: string) => {
    const digits = raw.replace(/%/g, "").trim();
    if (digits === "") return false;
    const n = parseInt(digits, 10);
    if (!Number.isFinite(n)) return false;
    commitOpacityPercent(n);
    return true;
  };

  const {
    scrubbing: opacityScrubbing,
    scrubActiveRef: opacityScrubActiveRef,
    bindScrubInput: bindOpacityScrub,
  } = useInspectorValueScrub({
    disabled: disabled || !onCommitOpacity,
    value: Math.round(Math.min(1, Math.max(0, opacity)) * 100),
    min: 0,
    max: 100,
    onChange: commitOpacityPercent,
  });

  useEffect(() => {
    if (opacityFocused || opacityScrubbing || opacityScrubActiveRef.current) return;
    setOpacityText(String(Math.round(Math.min(1, Math.max(0, opacity)) * 100)));
  }, [opacity, instanceKey, opacityFocused, opacityScrubbing, opacityScrubActiveRef]);

  const pickLibraryColor = (tokenId: string) => {
    applyTokenToSelection(tokenId);
    setLibraryPickerOpen(false);
  };

  const pickerTitleText = pickerTitle ?? (label ? `${label} color` : "Color");

  const libraryMenu =
    libraryPickerOpen && mounted && canPickLibrary ? (
      <div
        ref={libraryMenuRef}
        role="dialog"
        aria-label="Choose library color"
        className="fixed z-[120] w-[min(240px,calc(100vw-16px))] overflow-hidden rounded-md border border-app-border bg-app-panel shadow-xl"
        style={anchoredMenuStyle(libraryPosition)}
      >
        <LibraryColorPickerMenu
          activeTokenId={libraryTokenId}
          onPick={pickLibraryColor}
        />
      </div>
    ) : null;

  if (variant === "inspectorRow") {
    const rowDisabled = disabled || !visible;
    const showMixedHex = hexMixed && !focused;
    return (
      <div>
        {label ? (
          <div className="mb-0.5 text-ui font-medium leading-4 text-app-subtle">{label}</div>
        ) : null}
        <div className="flex items-center gap-1">
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center overflow-hidden border border-app-border bg-app-field",
              inspectorControlHeightClass,
              appFieldRadius,
              rowDisabled && "opacity-45",
              (focused || opacityFocused || colorPickerOpen) &&
                "border-accent ring-1 ring-accent",
            )}
          >
            <button
              ref={swatchRef}
              type="button"
              disabled={rowDisabled}
              onClick={() => setColorPickerOpen((o) => !o)}
              className={cn(
                "h-7 w-7 shrink-0 border-r border-app-border p-1 disabled:cursor-not-allowed",
                colorPickerOpen && "bg-accent/10",
              )}
              style={{ background: fillCss(previewHex, opacity) }}
              aria-label={pickerTitleText}
              aria-expanded={colorPickerOpen}
              aria-haspopup="dialog"
            />
            {libraryName ? (
              canPickLibrary ? (
                <button
                  ref={libraryAnchorRef}
                  type="button"
                  disabled={rowDisabled}
                  onClick={() => setLibraryPickerOpen((o) => !o)}
                  className={cn(
                    "max-w-[40%] shrink-0 truncate border-r border-app-border bg-app-surface px-1.5 text-left text-ui font-medium text-accent hover:bg-app-hover",
                    libraryPickerOpen && "bg-accent/10",
                  )}
                  title={`${libraryName} — change library color`}
                >
                  {libraryName}
                </button>
              ) : (
                <span className="max-w-[40%] shrink-0 truncate border-r border-app-border bg-app-surface px-1.5 text-ui font-medium text-accent">
                  {libraryName}
                </span>
              )
            ) : null}
            <input
              type="text"
              disabled={rowDisabled}
              spellCheck={false}
              autoComplete="off"
              maxLength={showMixedHex ? undefined : 6}
              aria-label={label ? `${label} hex` : "Color hex"}
              title={showMixedHex ? "Mixed colors" : "6-digit hex"}
              className={cn(
                "h-full min-w-0 flex-1 border-0 bg-transparent px-2 py-0 font-mono text-ui uppercase text-app-field-fg focus-visible:outline-none disabled:cursor-not-allowed",
                showMixedHex && "text-app-muted",
              )}
              value={showMixedHex ? "Mixed" : text}
              onFocus={() => {
                if (hexMixed) setText(safe.replace("#", "").toUpperCase());
                setFocused(true);
              }}
              onChange={(e) => {
                if (showMixedHex) return;
                handleTextChange(e.target.value);
              }}
              onBlur={finishEditing}
              onKeyDown={(e) => {
                handlePanelFieldKeyDown(e, {
                  onEnter: () => {
                    finishEditing();
                    e.currentTarget.blur();
                  },
                  onEscape: () => {
                    dirtyLiveRef.current = false;
                    setText(safe.replace("#", "").toUpperCase());
                    lastAppliedRef.current = safe;
                    setFocused(false);
                    e.currentTarget.blur();
                  },
                });
              }}
            />
            <div className="h-5 w-px shrink-0 bg-app-border" aria-hidden />
            <input
              type="text"
              inputMode="numeric"
              disabled={rowDisabled || !onCommitOpacity}
              aria-label="Opacity percent"
              {...bindOpacityScrub(
                "h-full w-9 shrink-0 border-0 bg-transparent px-1 py-0 text-right font-mono text-ui tabular-nums text-app-field-fg focus-visible:outline-none disabled:cursor-not-allowed",
                opacityFocused,
              )}
              value={opacityText}
              onFocus={() => setOpacityFocused(true)}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
                setOpacityText(digits);
                if (digits !== "") {
                  const n = parseInt(digits, 10);
                  if (Number.isFinite(n)) commitOpacityPercent(n);
                }
              }}
              onBlur={() => {
                if (opacityScrubActiveRef.current) return;
                setOpacityFocused(false);
                if (!applyOpacityDraft(opacityText)) {
                  setOpacityText(String(Math.round(opacity * 100)));
                }
              }}
              onKeyDown={(e) => {
                handlePanelFieldKeyDown(e, {
                  onEnter: () => {
                    if (!applyOpacityDraft(opacityText)) {
                      setOpacityText(String(Math.round(opacity * 100)));
                    }
                    e.currentTarget.blur();
                  },
                  onArrowNudge: (dir, shift, alt) => {
                    const step = keyboardNudgeStep(1, 0, shift, alt) * dir;
                    const current = parseInt(opacityText, 10);
                    const base = Number.isFinite(current)
                      ? current
                      : Math.round(opacity * 100);
                    commitOpacityPercent(base + step);
                  },
                });
              }}
            />
            <span className="shrink-0 pr-2 text-ui text-app-subtle">%</span>
          </div>
          {onToggleVisible ? (
            <button
              type="button"
              disabled={disabled}
              title={visible ? "Hide fill" : "Show fill"}
              onClick={onToggleVisible}
              className={cn(inspectorRowActionBtnClass, "inspector-icon-btn")}
            >
              {visible ? <Eye {...inspectorLucideProps()} /> : <EyeOff {...inspectorLucideProps()} />}
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onRemove}
              className={cn(inspectorRowActionBtnClass, "inspector-icon-btn hover:text-rose-300")}
              aria-label={removeLabel}
            >
              <Minus className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
            </button>
          ) : null}
        </div>
        {mounted && libraryMenu ? createPortal(libraryMenu, document.body) : null}
        <InspectorColorPickerAside
          open={colorPickerOpen}
          onClose={() => setColorPickerOpen(false)}
          anchorRef={swatchRef}
          title={pickerTitleText}
          hex={previewHex}
          opacity={opacity}
          disabled={rowDisabled}
          onCommitHex={(h, opts) => {
            applyHex(h, opts);
            setText(h.replace("#", "").toUpperCase());
          }}
          onCommitOpacity={onCommitOpacity ?? (() => undefined)}
        />
      </div>
    );
  }

  return (
    <div>
      {label ? (
        <div className="mb-0.5 text-ui font-medium leading-4 text-app-subtle">{label}</div>
      ) : null}
      <div className="flex gap-1.5">
        <button
          ref={swatchRef}
          type="button"
          disabled={disabled}
          onClick={() => setColorPickerOpen((o) => !o)}
          className={cn(
            "h-6 w-9 shrink-0 cursor-pointer rounded border border-app-border p-px disabled:opacity-45",
            colorPickerOpen && "border-accent ring-1 ring-accent",
          )}
          style={{ background: fillCss(previewHex, opacity) }}
          aria-label={pickerTitleText}
          aria-expanded={colorPickerOpen}
          aria-haspopup="dialog"
        />
        <div
          className={cn(
            "flex h-6 min-h-[24px] min-w-0 flex-1 overflow-hidden border border-app-border bg-app-field focus-within:border-accent focus-within:ring-1 focus-within:ring-accent",
            appFieldRadius,
            disabled && "opacity-45",
            libraryPickerOpen && canPickLibrary && "border-accent ring-1 ring-accent",
          )}
        >
          {libraryName ? (
            canPickLibrary ? (
              <button
                ref={libraryAnchorRef}
                type="button"
                disabled={disabled}
                onClick={() => setLibraryPickerOpen((o) => !o)}
                className={cn(
                  "flex max-w-[55%] shrink-0 items-center gap-0.5 truncate border-r border-app-border bg-app-surface px-1.5 text-left text-ui font-medium leading-4 text-accent transition-colors hover:bg-app-hover",
                  libraryPickerOpen && "bg-accent/10",
                )}
                title={`${libraryName} — click to change library color`}
                aria-expanded={libraryPickerOpen}
                aria-haspopup="dialog"
              >
                <span className="truncate">{libraryName}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 shrink-0 opacity-70 transition-transform",
                    libraryPickerOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
            ) : (
              <span
                className="flex max-w-[55%] shrink-0 items-center truncate border-r border-app-border bg-app-surface px-1.5 text-ui font-medium leading-4 text-accent"
                title={libraryName}
              >
                {libraryName}
              </span>
            )
          ) : null}
          <input
            type="text"
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
            aria-label={label ? `${label} hex` : "Color hex"}
            title={disabled ? "Enable fill to edit color" : "Type 6-digit hex — shape updates when complete"}
            className="h-full min-w-0 flex-1 border-0 bg-transparent px-1.5 py-0 font-mono text-ui leading-4 text-app-field-fg focus-visible:outline-none disabled:opacity-45"
            value={text}
            onFocus={() => setFocused(true)}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={finishEditing}
            onKeyDown={(e) => {
              handlePanelFieldKeyDown(e, {
                onEnter: () => {
                  finishEditing();
                  e.currentTarget.blur();
                },
                onEscape: () => {
                  dirtyLiveRef.current = false;
                  setText(safe);
                  lastAppliedRef.current = safe;
                  setFocused(false);
                  e.currentTarget.blur();
                },
              });
            }}
          />
        </div>
      </div>
      {mounted && libraryMenu ? createPortal(libraryMenu, document.body) : null}
      <InspectorColorPickerAside
        open={colorPickerOpen}
        onClose={() => setColorPickerOpen(false)}
        anchorRef={swatchRef}
        title={pickerTitleText}
        hex={previewHex}
        opacity={opacity}
        disabled={disabled}
        onCommitHex={(h, opts) => {
          applyHex(h, opts);
          setText(h);
        }}
        onCommitOpacity={
          onCommitOpacity ??
          (() => {
            /* opacity-only UI hidden when no handler */
          })
        }
      />
    </div>
  );
}
