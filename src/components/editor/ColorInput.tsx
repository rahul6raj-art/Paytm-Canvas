"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { normalizeHex } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";
import { LibraryColorPickerMenu } from "./LibraryColorPickerMenu";

type ColorInputProps = {
  label?: string;
  /** Design-system / library style name when this color is linked to a token */
  libraryName?: string;
  /** Token id for the linked library color — enables picker on name click */
  libraryTokenId?: string;
  hex: string;
  onCommitHex: (hex: string) => void;
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
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
    setText(normalizeHex(hex) ?? "#888888");
  }, [hex, instanceKey]);

  useEffect(() => {
    if (!canPickLibrary) setPickerOpen(false);
  }, [canPickLibrary]);

  const commitText = () => {
    const n = normalizeHex(text.startsWith("#") ? text : `#${text}`);
    if (n) {
      onCommitHex(n);
      setText(n);
    } else {
      setText(safe);
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
        className="fixed z-[120] w-[min(240px,calc(100vw-16px))] overflow-hidden rounded-md border border-white/[0.08] bg-[#2a2a2a] shadow-xl"
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
        <div
          className={cn(
            "flex h-6 min-h-[24px] min-w-0 flex-1 overflow-hidden rounded border border-white/[0.1] bg-[#262626] focus-within:border-accent focus-within:ring-1 focus-within:ring-accent",
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
                  "flex max-w-[55%] shrink-0 items-center gap-0.5 truncate border-r border-white/[0.08] bg-[#1e1e1e] px-1.5 text-left text-[11px] font-medium leading-4 text-accent transition-colors hover:bg-white/[0.06]",
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
                className="flex max-w-[55%] shrink-0 items-center truncate border-r border-white/[0.08] bg-[#1e1e1e] px-1.5 text-[11px] font-medium leading-4 text-accent"
                title={libraryName}
              >
                {libraryName}
              </span>
            )
          ) : null}
          <input
            type="text"
            disabled={disabled}
            className={cn(
              "h-full min-w-0 flex-1 border-0 bg-transparent px-1.5 py-0 font-mono text-[12px] leading-4 text-[#f5f5f5] focus-visible:outline-none disabled:opacity-45",
              libraryName && "max-w-[45%]",
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
      {mounted && pickerMenu ? createPortal(pickerMenu, document.body) : null}
    </div>
  );
}
