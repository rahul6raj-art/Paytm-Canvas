"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { normalizeHex, parseHexInputLive } from "@/lib/color";
import { handlePanelFieldKeyDown } from "@/lib/panelFieldKeyboard";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";
import { LibraryColorPickerMenu } from "./LibraryColorPickerMenu";

export type ColorCommitOptions = { skipHistory?: boolean };

type ColorInputProps = {
  label?: string;
  /** Design-system / library style name when this color is linked to a token */
  libraryName?: string;
  /** Token id for the linked library color — enables picker on name click */
  libraryTokenId?: string;
  hex: string;
  onCommitHex: (hex: string, opts?: ColorCommitOptions) => void;
  disabled?: boolean;
  instanceKey?: string;
};

export function ColorInput({
  label,
  libraryName,
  libraryTokenId,
  hex,
  onCommitHex,
  disabled,
  instanceKey = "",
}: ColorInputProps) {
  const safe = normalizeHex(hex) ?? "#888888";
  const [text, setText] = useState(safe);
  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastAppliedRef = useRef(safe);
  const dirtyLiveRef = useRef(false);
  const libraryAnchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const applyTokenToSelection = useEditorStore((s) => s.applyTokenToSelection);

  const canPickLibrary = Boolean(libraryName && libraryTokenId && !disabled);

  const position = useAnchoredDropdownPosition(libraryAnchorRef, pickerOpen, 4, {
    viewportClamp: true,
    maxHeight: 360,
    width: 240,
  });
  useDismissAnchoredDropdown(pickerOpen, () => setPickerOpen(false), libraryAnchorRef, menuRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (focused) return;
    const n = normalizeHex(hex) ?? "#888888";
    setText(n);
    lastAppliedRef.current = n;
    dirtyLiveRef.current = false;
  }, [hex, instanceKey, focused]);

  useEffect(() => {
    if (!canPickLibrary) setPickerOpen(false);
  }, [canPickLibrary]);

  const previewHex = (focused ? parseHexInputLive(text) : null) ?? safe;

  const applyHex = (n: string, opts?: ColorCommitOptions) => {
    if (n === lastAppliedRef.current) return;
    onCommitHex(n, opts);
    lastAppliedRef.current = n;
    if (opts?.skipHistory) dirtyLiveRef.current = true;
  };

  const handleTextChange = (raw: string) => {
    setText(raw);
    const n = parseHexInputLive(raw);
    if (n) applyHex(n, { skipHistory: true });
  };

  const finishEditing = () => {
    setFocused(false);
    const n =
      parseHexInputLive(text) ??
      normalizeHex(text.startsWith("#") ? text : `#${text}`);
    if (n) {
      applyHex(n, { skipHistory: true });
      setText(n);
    } else {
      setText(safe);
      lastAppliedRef.current = safe;
    }
    if (dirtyLiveRef.current) {
      useEditorStore.getState().pushHistory();
      dirtyLiveRef.current = false;
    }
  };

  const pickLibraryColor = (tokenId: string) => {
    applyTokenToSelection(tokenId);
    setPickerOpen(false);
  };

  const pickerMenu =
    pickerOpen && mounted && canPickLibrary ? (
      <div
        ref={menuRef}
        role="dialog"
        aria-label="Choose library color"
        className="fixed z-[120] w-[min(240px,calc(100vw-16px))] overflow-hidden rounded-md border border-app-border bg-app-panel shadow-xl"
        style={anchoredMenuStyle(position)}
      >
        <LibraryColorPickerMenu
          activeTokenId={libraryTokenId}
          onPick={pickLibraryColor}
        />
      </div>
    ) : null;

  return (
    <div>
      {label ? (
        <div className="mb-0.5 text-[11px] font-medium leading-4 text-app-subtle">{label}</div>
      ) : null}
      <div className="flex gap-1.5">
        <input
          type="color"
          value={previewHex}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.toLowerCase();
            applyHex(v);
            setText(v);
          }}
          className="h-6 w-9 shrink-0 cursor-pointer rounded border border-app-border bg-transparent p-px disabled:opacity-45"
        />
        <div
          className={cn(
            "flex h-6 min-h-[24px] min-w-0 flex-1 overflow-hidden rounded border border-app-border bg-app-field focus-within:border-accent focus-within:ring-1 focus-within:ring-accent",
            disabled && "opacity-45",
            pickerOpen && canPickLibrary && "border-accent ring-1 ring-accent",
          )}
        >
          {libraryName ? (
            canPickLibrary ? (
              <button
                ref={libraryAnchorRef}
                type="button"
                disabled={disabled}
                onClick={() => setPickerOpen((o) => !o)}
                className={cn(
                  "flex max-w-[55%] shrink-0 items-center gap-0.5 truncate border-r border-app-border bg-app-surface px-1.5 text-left text-[11px] font-medium leading-4 text-accent transition-colors hover:bg-app-hover",
                  pickerOpen && "bg-accent/10",
                )}
                title={`${libraryName} — click to change library color`}
                aria-expanded={pickerOpen}
                aria-haspopup="dialog"
              >
                <span className="truncate">{libraryName}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 shrink-0 opacity-70 transition-transform",
                    pickerOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
            ) : (
              <span
                className="flex max-w-[55%] shrink-0 items-center truncate border-r border-app-border bg-app-surface px-1.5 text-[11px] font-medium leading-4 text-accent"
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
            className="h-full min-w-0 flex-1 border-0 bg-transparent px-1.5 py-0 font-mono text-[12px] leading-4 text-app-field-fg focus-visible:outline-none disabled:opacity-45"
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
      {mounted && pickerMenu ? createPortal(pickerMenu, document.body) : null}
    </div>
  );
}
