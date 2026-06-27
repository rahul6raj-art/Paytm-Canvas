"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff, Minus } from "lucide-react";
import { normalizeHex, parseHexInputLive, fillCss } from "@/lib/color";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import { appFieldInnerClass, appFieldInnerClassCompact, appFieldShellClass, appFieldShellClassCompact, inspectorOpacityInputClass, inspectorOpacityInputCompactClass, inspectorOpacitySegmentClass, inspectorOpacitySegmentCompactClass, inspectorOpacitySuffixClass, inspectorRowGapClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";
import {
  inspectorFieldIconSlotClass,
  inspectorFieldIconSlotCompactClass,
  inspectorIconClass,
  inspectorIconStroke,
  inspectorLucideProps,
  inspectorRowActionBtnClass,
} from "@/lib/inspectorIconStyles";
import { useEditorStore } from "@/stores/useEditorStore";
import { InspectorColorPickerAside } from "./InspectorColorPickerAside";
import { ColorLibraryDialog } from "./ColorLibraryDialog";
import { EditorHintWrap } from "./EditorHoverHint";

export type ColorCommitOptions = { skipHistory?: boolean };

const inspectorColorFieldActiveClass = "border-app-panel-edge ring-1 ring-app-panel-edge";

function colorMainSegmentShellClass(opts: { compact?: boolean; attachOpacity: boolean }) {
  return cn(
    opts.compact ? appFieldShellClassCompact : appFieldShellClass,
    "min-w-0 flex-1 basis-0 overflow-visible",
    opts.attachOpacity && "rounded-r-none border-r-0",
  );
}

type ColorInputProps = {
  variant?: "default" | "inspectorRow";
  label?: string;
  /** Design-system / library style name when this color is linked to a token */
  libraryName?: string;
  /** Token id for the linked library color — enables picker on name click */
  libraryTokenId?: string;
  /** When true, show color library picker if design tokens exist (fill / text color). */
  colorLibraryPicker?: boolean;
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
  colorLibraryPicker = false,
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
  const lastAppliedRef = useRef(safe);
  const dirtyLiveRef = useRef(false);
  const libraryAnchorRef = useRef<HTMLButtonElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);
  const applyTokenToSelection = useEditorStore((s) => s.applyTokenToSelection);
  const colorLibraryCount = useEditorStore((s) => {
    let count = 0;
    for (const token of Object.values(s.designTokens)) {
      if (token.type === "color" || token.type === "gradient") count += 1;
    }
    return count;
  });

  const canPickLibrary = Boolean(!disabled && colorLibraryPicker && colorLibraryCount > 0);

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

  const libraryDialogTitle = libraryName ?? "Color library";
  const attachOpacitySegment = Boolean(onCommitOpacity);

  if (variant === "inspectorRow") {
    const rowDisabled = disabled || !visible;
    const showMixedHex = hexMixed && !focused;
    const fieldActive = focused || opacityFocused || colorPickerOpen;
    const fieldShellStateClass = cn(
      rowDisabled && "opacity-45",
      fieldActive && inspectorColorFieldActiveClass,
    );
    const opacityInputClass = inspectorOpacityInputClass;
    const opacityInput = onCommitOpacity ? (
      <>
        <input
          type="text"
          inputMode="numeric"
          disabled={rowDisabled}
          aria-label="Opacity percent"
          {...bindOpacityScrub(opacityInputClass, opacityFocused)}
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
        <span className={inspectorOpacitySuffixClass}>%</span>
      </>
    ) : null;
    return (
      <div>
        {label ? (
          <div className="mb-1.5 text-ui font-medium leading-4 text-app-subtle">{label}</div>
        ) : null}
        <div className={cn("flex items-center", inspectorRowGapClass)}>
          <div className="flex min-w-0 flex-1 basis-0 items-stretch overflow-visible">
            <div
              className={cn(
                colorMainSegmentShellClass({ attachOpacity: attachOpacitySegment }),
                fieldShellStateClass,
              )}
            >
              <button
                ref={swatchRef}
                type="button"
                disabled={rowDisabled}
                onClick={() => setColorPickerOpen((o) => !o)}
                className={cn(
                  inspectorFieldIconSlotClass,
                  "p-1 disabled:cursor-not-allowed",
                  colorPickerOpen && "bg-accent/10",
                )}
                aria-label={pickerTitleText}
                aria-expanded={colorPickerOpen}
                aria-haspopup="dialog"
              >
                <span
                  className="block h-full w-full rounded-[2px] border border-app-border"
                  style={{ background: fillCss(previewHex, opacity, visible) }}
                />
              </button>
              {canPickLibrary ? (
                <EditorHintWrap
                  title={
                    libraryName
                      ? `${libraryName} — change library color`
                      : "Choose color from library"
                  }
                >
                  <button
                    ref={libraryAnchorRef}
                    type="button"
                    disabled={rowDisabled}
                    onClick={() => setLibraryPickerOpen((o) => !o)}
                    className={cn(
                      "max-w-[5.5rem] shrink-0 truncate border-r border-app-border bg-app-surface px-1.5 text-left text-ui font-medium text-accent hover:bg-app-hover",
                      libraryPickerOpen && "bg-accent/10",
                    )}
                    aria-expanded={libraryPickerOpen}
                    aria-haspopup="dialog"
                  >
                    {libraryName ?? "Library"}
                  </button>
                </EditorHintWrap>
              ) : libraryName ? (
                <span className="max-w-[5.5rem] shrink-0 truncate border-r border-app-border bg-app-surface px-1.5 text-ui font-medium text-accent">
                  {libraryName}
                </span>
              ) : null}
              <EditorHintWrap
                title={showMixedHex ? "Mixed colors" : "6-digit hex"}
                anchorClassName="min-w-0 flex-1 overflow-hidden"
              >
                <input
                  type="text"
                  disabled={rowDisabled}
                  spellCheck={false}
                  autoComplete="off"
                  maxLength={showMixedHex ? undefined : 6}
                  aria-label={label ? `${label} hex` : "Color hex"}
                  className={cn(
                    appFieldInnerClass,
                    "w-full min-w-0 font-mono uppercase",
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
              </EditorHintWrap>
            </div>
            {opacityInput ? (
              <div className={cn(inspectorOpacitySegmentClass, fieldShellStateClass)}>
                {opacityInput}
              </div>
            ) : null}
          </div>
          {onToggleVisible ? (
            <EditorHintWrap title={visible ? "Hide fill" : "Show fill"}>
              <button
                type="button"
                disabled={disabled}
                onClick={onToggleVisible}
                className={cn(inspectorRowActionBtnClass, "inspector-icon-btn")}
              >
                {visible ? <Eye {...inspectorLucideProps()} /> : <EyeOff {...inspectorLucideProps()} />}
              </button>
            </EditorHintWrap>
          ) : null}
          {onRemove ? (
            <EditorHintWrap title={removeLabel}>
              <button
                type="button"
                disabled={disabled}
                onClick={onRemove}
                className={cn(inspectorRowActionBtnClass, "inspector-icon-btn hover:text-rose-300")}
                aria-label={removeLabel}
              >
                <Minus className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
              </button>
            </EditorHintWrap>
          ) : null}
        </div>
        {canPickLibrary ? (
          <ColorLibraryDialog
            open={libraryPickerOpen}
            onClose={() => setLibraryPickerOpen(false)}
            anchorRef={libraryAnchorRef}
            title={libraryDialogTitle}
            activeTokenId={libraryTokenId}
            onPick={pickLibraryColor}
          />
        ) : null}
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

  const fieldActive =
    focused ||
    opacityFocused ||
    colorPickerOpen ||
    (libraryPickerOpen && canPickLibrary);
  const compactFieldShellStateClass = cn(
    disabled && "opacity-45",
    fieldActive && inspectorColorFieldActiveClass,
  );
  const compactOpacityInputClass = inspectorOpacityInputCompactClass;

  return (
    <div>
      {label ? (
        <div className="mb-1.5 text-ui font-medium leading-4 text-app-subtle">{label}</div>
      ) : null}
      <div className="flex min-w-0 items-stretch overflow-visible focus-within:[&_input]:border-accent">
        <div
          className={cn(
            colorMainSegmentShellClass({ compact: true, attachOpacity: attachOpacitySegment }),
            "focus-within:border-accent focus-within:ring-1 focus-within:ring-accent",
            compactFieldShellStateClass,
          )}
        >
          <button
            ref={swatchRef}
            type="button"
            disabled={disabled}
            onClick={() => setColorPickerOpen((o) => !o)}
            className={cn(
              inspectorFieldIconSlotCompactClass,
              "p-px disabled:cursor-not-allowed",
              colorPickerOpen && "bg-app-inset",
            )}
            aria-label={pickerTitleText}
            aria-expanded={colorPickerOpen}
            aria-haspopup="dialog"
          >
            <span
              className="block h-full w-full rounded-[2px] border border-app-border"
              style={{ background: fillCss(previewHex, opacity, visible) }}
            />
          </button>
          {canPickLibrary ? (
            <EditorHintWrap
              title={
                libraryName
                  ? `${libraryName} — click to change library color`
                  : "Choose color from library"
              }
            >
              <button
                ref={libraryAnchorRef}
                type="button"
                disabled={disabled}
                onClick={() => setLibraryPickerOpen((o) => !o)}
                className={cn(
                  "flex max-w-[5.5rem] shrink-0 items-center gap-0.5 truncate border-r border-app-border bg-app-surface px-1.5 text-left text-ui font-medium leading-4 text-app-fg transition-colors hover:bg-app-hover",
                  libraryPickerOpen && "bg-app-inset",
                )}
                aria-expanded={libraryPickerOpen}
                aria-haspopup="dialog"
              >
                <span className="truncate">{libraryName ?? "Library"}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 shrink-0 opacity-70 transition-transform",
                    libraryPickerOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
            </EditorHintWrap>
          ) : libraryName ? (
            <EditorHintWrap title={libraryName}>
              <span className="flex max-w-[5.5rem] shrink-0 items-center truncate border-r border-app-border bg-app-surface px-1.5 text-ui font-medium leading-4 text-app-fg">
                {libraryName}
              </span>
            </EditorHintWrap>
          ) : null}
          <EditorHintWrap
            title={disabled ? "Enable fill to edit color" : "Type 6-digit hex — shape updates when complete"}
            anchorClassName="min-w-0 flex-1 overflow-hidden"
          >
            <input
              type="text"
              disabled={disabled}
              spellCheck={false}
              autoComplete="off"
              aria-label={label ? `${label} hex` : "Color hex"}
              className={cn(appFieldInnerClassCompact, "w-full min-w-0 font-mono leading-4")}
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
          </EditorHintWrap>
        </div>
        {onCommitOpacity ? (
          <div className={cn(inspectorOpacitySegmentCompactClass, compactFieldShellStateClass)}>
            <input
              type="text"
              inputMode="numeric"
              disabled={disabled}
              aria-label="Opacity percent"
              {...bindOpacityScrub(compactOpacityInputClass, opacityFocused)}
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
            <span className={inspectorOpacitySuffixClass}>%</span>
          </div>
        ) : null}
      </div>
      {canPickLibrary ? (
        <ColorLibraryDialog
          open={libraryPickerOpen}
          onClose={() => setLibraryPickerOpen(false)}
          anchorRef={libraryAnchorRef}
          title={libraryDialogTitle}
          activeTokenId={libraryTokenId}
          onPick={pickLibraryColor}
        />
      ) : null}
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
