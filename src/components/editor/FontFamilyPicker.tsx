"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, RefreshCw, Upload } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { FONT_IMPORT_ACCEPT } from "@/lib/editorFontAssets";
import { uploadedFontOptionsFromAssets } from "@/lib/fonts/uploadedFonts";
import { trySelectAllPanelField } from "@/lib/panelFieldKeyboard";
import {
  ensureFontFamilyLoaded,
  fontFamilyLabel,
  matchFontOption,
  useFontCatalog,
  type FontFamilyOption,
} from "@/lib/fonts";
import { cn } from "@/lib/utils";
import {
  anchoredMenuStyle,
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

type FlatFontOption = FontFamilyOption & { optionId: string };

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const inputId = useId();

  const fontAssets = useEditorStore((s) => s.fontAssets);
  const importFontFile = useEditorStore((s) => s.importFontFile);
  const { groups, filter, localStatus, localFontsSupported, refreshInstalled } = useFontCatalog();
  const position = useAnchoredDropdownPosition(anchorRef, open, 4, {
    viewportClamp: true,
    maxHeight: 420,
    width: 280,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), anchorRef, menuRef);

  const filteredGroups = useMemo(() => filter(query), [filter, query]);
  const currentLabel = fontFamilyLabel(value);

  const flatOptions = useMemo((): FlatFontOption[] => {
    const out: FlatFontOption[] = [];
    for (const group of filteredGroups) {
      for (const opt of group.fonts) {
        out.push({ ...opt, optionId: `${group.id}-${opt.id}` });
      }
    }
    return out;
  }, [filteredGroups]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(-1);
      return;
    }
    const t = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(flatOptions.length > 0 ? 0 : -1);
  }, [open, query, flatOptions.length]);

  const pick = async (opt: FontFamilyOption) => {
    await ensureFontFamilyLoaded(opt.value, fontAssets);
    onChange(opt.value);
    setOpen(false);
    anchorRef.current?.focus();
  };

  const onFontFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const assetId = await importFontFile(file);
    if (!assetId) return;
    const asset = useEditorStore.getState().fontAssets[assetId];
    if (!asset) return;
    const opt = uploadedFontOptionsFromAssets({ [assetId]: asset })[0];
    if (opt) await pick(opt);
  };

  const close = useCallback(() => {
    setOpen(false);
    anchorRef.current?.focus();
  }, []);

  const scrollActiveIntoView = useCallback((index: number) => {
    if (index < 0) return;
    const el = menuRef.current?.querySelector<HTMLElement>(
      `[data-font-option-index="${index}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, []);

  const onMenuKeyDown = (e: KeyboardEvent) => {
    if (trySelectAllPanelField(e)) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (flatOptions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = i < flatOptions.length - 1 ? i + 1 : 0;
        requestAnimationFrame(() => scrollActiveIntoView(next));
        return next;
      });
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = i > 0 ? i - 1 : flatOptions.length - 1;
        requestAnimationFrame(() => scrollActiveIntoView(next));
        return next;
      });
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
      scrollActiveIntoView(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      const last = flatOptions.length - 1;
      setActiveIndex(last);
      scrollActiveIntoView(last);
      return;
    }
    if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const opt = flatOptions[activeIndex];
      if (opt) void pick(opt);
    }
  };

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        id={listId}
        role="listbox"
        aria-label="Font family"
        onKeyDown={onMenuKeyDown}
        className="fixed z-[120] flex w-[min(280px,calc(100vw-16px))] flex-col overflow-hidden rounded-md border border-app-border bg-app-panel shadow-xl"
        style={anchoredMenuStyle(position)}
      >
        <div className="shrink-0 border-b border-app-border-subtle p-2">
          <label htmlFor={inputId} className="sr-only">
            Search fonts
          </label>
          <input
            ref={searchRef}
            id={inputId}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 && flatOptions[activeIndex]
                ? `font-opt-${flatOptions[activeIndex]!.optionId}`
                : undefined
            }
            placeholder="Search fonts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onMenuKeyDown}
            className="h-8 w-full rounded-md border border-app-border bg-app-field px-2.5 text-ui text-app-field-fg placeholder:text-app-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={FONT_IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => void onFontFileChange(e)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-app-border py-1.5 text-ui text-[#aaa] hover:border-accent/40 hover:bg-app-hover hover:text-app-fg"
          >
            <Upload className="h-3 w-3" />
            Upload TTF or OTF…
          </button>
          {localFontsSupported ? (
            <button
              type="button"
              disabled={localStatus === "loading"}
              onClick={() => void refreshInstalled()}
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md py-1 text-ui text-[#aaa] hover:bg-app-hover hover:text-app-fg disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", localStatus === "loading" && "animate-spin")} />
              {localStatus === "loading"
                ? "Scanning installed fonts…"
                : localStatus === "ready"
                  ? "Refresh installed fonts"
                  : "Load fonts installed on this device"}
            </button>
          ) : (
            <p className="mt-1.5 px-0.5 text-ui leading-snug text-[#888]">
              Installed-font scan needs Chrome or Edge. Upload or use Google Fonts instead.
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
          {!matchFontOption(value) && value ? (
            <div className="border-b border-app-border-subtle px-2 pb-2">
              <p className="px-2 py-1 section-heading">
                Current
              </p>
              <button
                type="button"
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-ui text-[#f0f0f0] bg-[rgba(13,153,255,0.12)]"
                style={{ fontFamily: value }}
                onClick={() => setOpen(false)}
              >
                {currentLabel}
              </button>
            </div>
          ) : null}

          {filteredGroups.every((g) => g.fonts.length === 0) ? (
            <p className="px-3 py-4 text-center text-ui text-[#888]" role="status">
              No fonts match your search.
            </p>
          ) : (
            (() => {
              let optionIndex = -1;
              return filteredGroups.map((group) =>
              group.fonts.length === 0 ? null : (
                <div key={group.id} className="mb-1">
                  <p className="sticky top-0 z-[1] bg-app-panel px-3 py-1 section-heading">
                    {group.label}
                    {group.id === "google" ? ` (${group.fonts.length})` : null}
                  </p>
                  {group.fonts.map((opt) => {
                    optionIndex += 1;
                    const idx = optionIndex;
                    const optionId = `${group.id}-${opt.id}`;
                    const selected = value === opt.value;
                    const active = idx === activeIndex;
                    return (
                      <button
                        key={opt.id}
                        id={`font-opt-${optionId}`}
                        data-font-option-index={idx}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={cn(
                          "flex w-full items-center rounded-md px-3 py-1.5 text-left text-ui text-[#e8e8e8] hover:bg-app-hover",
                          selected && "bg-[rgba(13,153,255,0.15)] text-white",
                          active && !selected && "bg-app-hover",
                        )}
                        style={{ fontFamily: opt.value }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => void pick(opt)}
                      >
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              ),
            );
            })()
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
        aria-label={`Font family, ${currentLabel}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        title={currentLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            if (!open) {
              e.preventDefault();
              setOpen(true);
            }
          }
        }}
        className={cn(
          "flex h-7 max-w-full items-center gap-1 rounded-md border border-app-border bg-app-field pl-2 pr-1 text-ui text-app-field-fg hover:border-app-border disabled:opacity-45",
          buttonClassName,
        )}
        style={{ fontFamily: value }}
      >
        <span className="min-w-0 flex-1 truncate text-left">{currentLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
