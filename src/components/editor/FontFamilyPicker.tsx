"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, RefreshCw } from "lucide-react";
import {
  ensureFontFamilyLoaded,
  fontFamilyLabel,
  matchFontOption,
  useFontCatalog,
  type FontFamilyOption,
} from "@/lib/fonts";
import { cn } from "@/lib/utils";
import {
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";

type FontFamilyPickerProps = {
  value: string;
  disabled?: boolean;
  onChange: (fontFamily: string) => void;
  className?: string;
  buttonClassName?: string;
};

export function FontFamilyPicker({
  value,
  disabled,
  onChange,
  className,
  buttonClassName,
}: FontFamilyPickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { groups, filter, localStatus, localFontsSupported, refreshInstalled } = useFontCatalog();
  const position = useAnchoredDropdownPosition(anchorRef, open, 4);
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);

  const filteredGroups = useMemo(() => filter(query), [filter, query]);
  const currentLabel = fontFamilyLabel(value);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  const pick = async (opt: FontFamilyOption) => {
    await ensureFontFamilyLoaded(opt.value);
    onChange(opt.value);
    setOpen(false);
  };

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label="Font family"
        className="fixed z-[120] flex max-h-[min(420px,70vh)] w-[min(280px,calc(100vw-16px))] flex-col overflow-hidden rounded-md border border-white/[0.08] bg-[#2a2a2a] shadow-xl"
        style={{ left: position.left, top: position.top }}
      >
        <div className="border-b border-white/[0.06] p-2">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search fonts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-white/[0.1] bg-[#1f1f1f] px-2.5 text-[12px] text-white placeholder:text-[#888] focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          />
          {localFontsSupported ? (
            <button
              type="button"
              disabled={localStatus === "loading"}
              onClick={() => void refreshInstalled()}
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md py-1 text-[10px] text-[#aaa] hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", localStatus === "loading" && "animate-spin")} />
              {localStatus === "loading"
                ? "Scanning installed fonts…"
                : localStatus === "ready"
                  ? "Refresh installed fonts"
                  : "Load fonts installed on this device"}
            </button>
          ) : (
            <p className="mt-1.5 px-0.5 text-[10px] leading-snug text-[#888]">
              Installed-font scan needs Chrome or Edge. Open-source and system fonts are still available.
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {!matchFontOption(value) && value ? (
            <div className="border-b border-white/[0.06] px-2 pb-2">
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[#888]">
                Current
              </p>
              <button
                type="button"
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-[12px] text-[#f0f0f0] bg-[rgba(13,153,255,0.12)]"
                style={{ fontFamily: value }}
                onClick={() => setOpen(false)}
              >
                {currentLabel}
              </button>
            </div>
          ) : null}

          {filteredGroups.every((g) => g.fonts.length === 0) ? (
            <p className="px-3 py-4 text-center text-[12px] text-[#888]">No fonts match your search.</p>
          ) : (
            filteredGroups.map((group) =>
              group.fonts.length === 0 ? null : (
                <div key={group.id} className="mb-1">
                  <p className="sticky top-0 z-[1] bg-[#2a2a2a] px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[#888]">
                    {group.label}
                    {group.id === "google" ? ` (${group.fonts.length})` : null}
                  </p>
                  {group.fonts.map((opt) => {
                    const selected = value === opt.value;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={cn(
                          "flex w-full items-center rounded-md px-3 py-1.5 text-left text-[12px] text-[#e8e8e8] hover:bg-white/[0.08]",
                          selected && "bg-[rgba(13,153,255,0.15)] text-white",
                        )}
                        style={{ fontFamily: opt.value }}
                        onClick={() => void pick(opt)}
                      >
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              ),
            )
          )}
        </div>
      </div>
    ) : null;

  return (
    <div className={cn("relative min-w-0", className)}>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        aria-label="Font family"
        aria-expanded={open}
        aria-haspopup="listbox"
        title={currentLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-7 max-w-full items-center gap-1 rounded-md border border-white/[0.1] bg-[#262626] pl-2 pr-1 text-[11px] text-[#f0f0f0] hover:border-white/20 disabled:opacity-45",
          buttonClassName,
        )}
        style={{ fontFamily: value }}
      >
        <span className="min-w-0 flex-1 truncate text-left">{currentLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
