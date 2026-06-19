"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileCode,
  Loader2,
  Palette,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "@/components/editor/useAnchoredDropdown";
import {
  attachmentFromFile,
  revokeAttachmentPreview,
  type AIContextAttachment,
} from "@/lib/aiGenerateContext";
import type { AIStyleId } from "@/lib/aiMockGenerator";
import { DesignMdBrandLogo } from "@/components/ai/DesignMdBrandLogo";
import {
  builtinDesignMdEntry,
  builtinDesignMdGroups,
  builtinDesignMdId,
  isBuiltinDesignMdId,
} from "@/lib/builtinDesignMd";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";

export type StyleGuideMode = "design-md" | "style-guide";
export type StyleGuideTheme = "auto" | AIStyleId;

const THEME_OPTIONS: { id: StyleGuideTheme; label: string; hint?: string }[] = [
  { id: "auto", label: "Auto", hint: "Match prompt & screen type" },
  { id: "minimal", label: "Minimal" },
  { id: "bold", label: "Bold" },
  { id: "fintech", label: "Fintech" },
  { id: "dark", label: "Dark" },
  { id: "playful", label: "Playful" },
];

type Props = {
  disabled?: boolean;
  menuZClass?: string;
  className?: string;
  mode: StyleGuideMode;
  onModeChange: (mode: StyleGuideMode) => void;
  designMdRefs: AIContextAttachment[];
  onDesignMdRefsChange: (next: AIContextAttachment[]) => void;
  selectedDesignMdId: string | null;
  onSelectedDesignMdIdChange: (id: string | null) => void;
  theme: StyleGuideTheme;
  onThemeChange: (theme: StyleGuideTheme) => void;
  controlAnchorRef?: RefObject<HTMLButtonElement | null>;
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
  hideButton?: boolean;
};

export function AIStyleGuideSelect({
  disabled,
  menuZClass = "z-[500]",
  className,
  mode,
  onModeChange,
  designMdRefs,
  onDesignMdRefsChange,
  selectedDesignMdId,
  onSelectedDesignMdIdChange,
  theme,
  onThemeChange,
  controlAnchorRef,
  controlledOpen,
  onControlledOpenChange,
  hideButton = false,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onControlledOpenChange ?? setInternalOpen;
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [reading, setReading] = useState(false);
  const internalButtonRef = useRef<HTMLButtonElement>(null);
  const buttonRef = controlAnchorRef ?? internalButtonRef;
  const menuRef = useRef<HTMLDivElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);

  const position = useAnchoredDropdownPosition(buttonRef, open, 6, {
    viewportClamp: true,
    maxHeight: 400,
    width: 300,
    remeasureKey: `${mode}:${search}`,
  });
  useDismissAnchoredDropdown(open, () => setOpen(false), buttonRef, menuRef);

  useEffect(() => setMounted(true), []);

  const builtinGroups = useMemo(() => builtinDesignMdGroups(search), [search]);

  const selectedBuiltin = useMemo(
    () => (selectedDesignMdId ? builtinDesignMdEntry(selectedDesignMdId) : undefined),
    [selectedDesignMdId],
  );

  const pillLabel = useMemo(() => {
    if (mode === "design-md") {
      if (!selectedDesignMdId) return "Style Guide";
      if (selectedBuiltin) return selectedBuiltin.label;
      const hit = designMdRefs.find((r) => r.id === selectedDesignMdId);
      return hit?.name ?? "Style Guide";
    }
    if (theme === "auto") return "Auto";
    return THEME_OPTIONS.find((t) => t.id === theme)?.label ?? "Style Guide";
  }, [mode, selectedDesignMdId, designMdRefs, theme]);

  const filteredRefs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return designMdRefs;
    return designMdRefs.filter((r) => r.name.toLowerCase().includes(q));
  }, [designMdRefs, search]);

  const onPickDesignMd = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || reading) return;
      setReading(true);
      try {
        const file = files[0]!;
        const processed = await attachmentFromFile(file, "design-md");
        const withoutDuplicate = designMdRefs.filter(
          (r) => r.name.toLowerCase() !== file.name.toLowerCase(),
        );
        onDesignMdRefsChange([...withoutDuplicate, processed]);
        if (processed.status === "ready") {
          onSelectedDesignMdIdChange(processed.id);
        }
      } finally {
        setReading(false);
        if (mdInputRef.current) mdInputRef.current.value = "";
        if (styleInputRef.current) styleInputRef.current.value = "";
      }
    },
    [reading, designMdRefs, onDesignMdRefsChange, onSelectedDesignMdIdChange],
  );

  const removeDesignMd = useCallback(
    (id: string) => {
      const target = designMdRefs.find((r) => r.id === id);
      if (target) revokeAttachmentPreview(target);
      const next = designMdRefs.filter((r) => r.id !== id);
      onDesignMdRefsChange(next);
      if (selectedDesignMdId === id) {
        onSelectedDesignMdIdChange(null);
      }
    },
    [designMdRefs, onDesignMdRefsChange, selectedDesignMdId, onSelectedDesignMdIdChange],
  );

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        role="dialog"
        aria-label="Style Guide"
        data-editor-shell
        className={cn(
          "editor-floating-menu fixed flex w-[300px] flex-col overflow-hidden border border-app-border bg-app-surface shadow-xl thin-scroll",
          menuZClass,
        )}
        style={anchoredMenuStyle(position)}
      >
        <div className="shrink-0 border-b border-app-border-subtle p-2">
          <div
            className="grid grid-cols-2 gap-1 rounded-xl bg-app-inset p-1"
            role="tablist"
            aria-label="Style guide source"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "design-md"}
              className={cn(
                "chrome-segmented-tab min-w-0 truncate border border-transparent",
                mode === "design-md" ? "chrome-segmented-tab-active" : "text-app-muted hover:text-app-fg",
              )}
              onClick={() => onModeChange("design-md")}
            >
              Design.md
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "style-guide"}
              className={cn(
                "chrome-segmented-tab min-w-0 truncate border border-transparent",
                mode === "style-guide" ? "chrome-segmented-tab-active" : "text-app-muted hover:text-app-fg",
              )}
              onClick={() => onModeChange("style-guide")}
            >
              Style Guide
            </button>
          </div>
        </div>

        {mode === "design-md" ? (
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="border-b border-app-border-subtle px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-app-border bg-app-inset px-2.5 py-1.5">
                  <Search className="h-3.5 w-3.5 shrink-0 text-app-subtle" strokeWidth={2} />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search companies"
                    className="min-w-0 flex-1 bg-transparent text-ui text-app-fg outline-none placeholder:text-app-muted"
                  />
                </div>
                <EditorHintWrap title="Add Design.md">
                  <button
                    type="button"
                    disabled={reading || disabled}
                    aria-label="Add Design.md"
                    onClick={() => mdInputRef.current?.click()}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-dashed border-app-border-subtle px-2 text-ui font-medium text-app-muted transition-colors hover:border-app-border hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
                  >
                    {reading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    ) : (
                      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                    Add
                  </button>
                </EditorHintWrap>
              </div>
            </div>

            <button
              type="button"
              className={cn(
                "editor-menu-dropdown-item !items-center !justify-start gap-2.5",
                selectedDesignMdId === null ? "bg-app-inset text-app-fg" : "",
              )}
              onClick={() => onSelectedDesignMdIdChange(null)}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-app-border-subtle bg-app-inset">
                <FileCode className="h-4 w-4 text-app-muted" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">No reference</span>
              {selectedDesignMdId === null ? (
                <Check className="h-4 w-4 shrink-0 text-app-muted" strokeWidth={2.5} />
              ) : null}
            </button>

            {builtinGroups.map((group) => (
              <div key={group.category}>
                <p className="px-3 pb-0.5 pt-2 section-heading">
                  {group.category}
                </p>
                {group.entries.map((entry) => {
                  const id = builtinDesignMdId(entry.id);
                  const selected = selectedDesignMdId === id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={cn(
                        "editor-menu-dropdown-item !items-center !justify-start gap-2.5",
                        selected ? "bg-app-inset text-app-fg" : "",
                      )}
                      onClick={() => onSelectedDesignMdIdChange(id)}
                    >
                      <DesignMdBrandLogo logo={entry.logo} label={entry.label} />
                      <span className="min-w-0 flex-1 truncate font-medium text-app-fg">{entry.label}</span>
                      {selected ? (
                        <Check className="h-4 w-4 shrink-0 text-app-muted" strokeWidth={2.5} />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}

            {filteredRefs.length > 0 ? (
              <p className="border-t border-app-border-subtle px-3 pb-0.5 pt-2 section-heading">
                Your uploads
              </p>
            ) : null}

            {filteredRefs.map((ref) => (
              <div
                key={ref.id}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2",
                  selectedDesignMdId === ref.id ? "bg-app-inset" : "hover:bg-app-hover",
                )}
              >
                <button
                  type="button"
                  className="editor-menu-dropdown-item !items-center !justify-start gap-2.5 !px-0 !py-0"
                  onClick={() => onSelectedDesignMdIdChange(ref.id)}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-app-border-subtle bg-app-inset">
                    <FileCode className="h-4 w-4 text-app-muted" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-app-fg">{ref.name}</span>
                  {selectedDesignMdId === ref.id ? (
                    <Check className="h-4 w-4 shrink-0 text-app-muted" strokeWidth={2.5} />
                  ) : null}
                </button>
                {!isBuiltinDesignMdId(ref.id) ? (
                  <button
                    type="button"
                    className="shrink-0 rounded px-1.5 py-0.5 text-ui text-app-muted hover:bg-app-hover hover:text-app-fg"
                    onClick={() => removeDesignMd(ref.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="p-2">
              <button
                type="button"
                disabled={reading || disabled}
                onClick={() => styleInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-app-border-subtle bg-app-inset px-3 py-2 text-ui font-medium text-app-fg transition-colors hover:border-app-border hover:bg-app-hover disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Create New Style
              </button>
            </div>

            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={cn(
                  "editor-menu-dropdown-item !items-center !justify-start gap-2.5",
                  theme === opt.id ? "bg-app-inset text-app-fg" : "",
                )}
                onClick={() => onThemeChange(opt.id)}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-inset text-app-muted">
                  {opt.id === "auto" ? (
                    <Sparkles className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <Palette className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-app-fg">{opt.label}</span>
                  {opt.hint ? (
                    <span className="block truncate text-ui font-normal text-app-subtle">{opt.hint}</span>
                  ) : null}
                </span>
                {theme === opt.id ? (
                  <Check className="h-4 w-4 shrink-0 text-app-muted" strokeWidth={2.5} />
                ) : null}
              </button>
            ))}

            <p className="px-3 py-2 text-ui leading-snug text-app-muted">
              No custom themes yet. Create one from a Design.md file, image, or prompt.
            </p>

            <div className="border-t border-app-border-subtle">
              <button
                type="button"
                disabled={disabled}
                onClick={() => styleInputRef.current?.click()}
                className="editor-menu-dropdown-item justify-between font-medium"
              >
                Create Style
                <ChevronRight className="h-4 w-4 text-app-muted" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}

        <input
          ref={mdInputRef}
          type="file"
          accept=".md,.mdx"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void onPickDesignMd(e.target.files)}
        />
        <input
          ref={styleInputRef}
          type="file"
          accept=".md,.mdx,image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void onPickDesignMd(e.target.files)}
        />
      </div>
    ) : null;

  return (
    <>
      {!hideButton ? (
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Style Guide"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5 rounded-full border border-app-border-subtle bg-app-inset py-1 pl-2 pr-1.5 text-ui font-medium text-app-fg transition-colors",
            "hover:border-app-border hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-app-border bg-app-hover",
            className,
          )}
        >
          {mode === "design-md" && selectedBuiltin?.logo ? (
            <DesignMdBrandLogo
              logo={selectedBuiltin.logo}
              label={selectedBuiltin.label}
              boxClassName="h-5 w-5 rounded-full border-0 bg-white p-0.5"
              className="h-3.5 w-3.5"
            />
          ) : (
            <Palette className="h-3.5 w-3.5 shrink-0 text-app-muted" strokeWidth={2} />
          )}
          <span className="max-w-[100px] truncate">{pillLabel}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-app-subtle" strokeWidth={2.5} />
        </button>
      ) : null}
      {menu && mounted ? createPortal(menu, document.body) : null}
    </>
  );
}

export function effectiveStyleFromTheme(theme: StyleGuideTheme): AIStyleId {
  return theme === "auto" ? "fintech" : theme;
}

export function designMdContextAttachments(
  refs: AIContextAttachment[],
  selectedId: string | null,
  builtin?: AIContextAttachment | null,
): AIContextAttachment[] {
  if (selectedId) {
    if (isBuiltinDesignMdId(selectedId)) {
      return builtin?.status === "ready" ? [builtin] : [];
    }
    const hit = refs.find((r) => r.id === selectedId && r.status === "ready");
    if (hit) return [hit];
  }
  const readyRefs = refs.filter((r) => r.status === "ready" && r.summary?.trim());
  return readyRefs.length > 0 ? readyRefs : [];
}
