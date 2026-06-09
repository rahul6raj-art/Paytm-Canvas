"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "@/components/editor/useAnchoredDropdown";
import {
  AI_CONTEXT_KINDS,
  attachmentFromFile,
  attachmentFromFolder,
  MAX_CONTEXT_ATTACHMENTS,
  revokeAttachmentPreview,
  type AIContextAttachment,
  type AIContextKind,
} from "@/lib/aiGenerateContext";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<AIContextKind, typeof FolderOpen> = {
  project: FolderOpen,
  image: ImageIcon,
  doc: FileText,
  video: Video,
  skills: Sparkles,
  "design-md": FileCode,
  folder: Folder,
};

type Props = {
  attachments: AIContextAttachment[];
  disabled?: boolean;
  onChange: (next: AIContextAttachment[]) => void;
  className?: string;
  /** `minimal` = icon + chip row only (composer toolbar). */
  variant?: "full" | "minimal";
  /** When `minimal`, render only the attach button, chips, or both. */
  minimalPart?: "all" | "button" | "chips";
};

export function AIContextAttachments({
  attachments,
  disabled,
  onChange,
  className,
  variant = "full",
  minimalPart = "all",
}: Props) {
  const fileRefs = useRef<Partial<Record<AIContextKind, HTMLInputElement | null>>>({});
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const position = useAnchoredDropdownPosition(anchorRef, menuOpen, 6, {
    viewportClamp: true,
    maxHeight: 320,
    width: 240,
  });
  useDismissAnchoredDropdown(menuOpen, () => setMenuOpen(false), anchorRef, menuRef);

  useEffect(() => setMounted(true), []);

  const removeAttachment = useCallback(
    (id: string) => {
      const target = attachments.find((a) => a.id === id);
      if (target) revokeAttachmentPreview(target);
      onChange(attachments.filter((a) => a.id !== id));
    },
    [attachments, onChange],
  );

  const onPickFiles = useCallback(
    async (kind: AIContextKind, files: FileList | null) => {
      if (!files?.length || disabled || reading) return;
      const room = MAX_CONTEXT_ATTACHMENTS - attachments.length;
      if (room <= 0) return;
      setReading(true);
      try {
        const slice = Array.from(files).slice(0, room);
        const processed = await Promise.all(slice.map((file) => attachmentFromFile(file, kind)));
        onChange([...attachments, ...processed]);
      } finally {
        setReading(false);
      }
    },
    [attachments, disabled, onChange, reading],
  );

  const onPickFolder = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || disabled || reading) return;
      if (attachments.length >= MAX_CONTEXT_ATTACHMENTS) return;
      setReading(true);
      try {
        const processed = await attachmentFromFolder(files);
        onChange([...attachments, processed]);
      } finally {
        setReading(false);
      }
    },
    [attachments, disabled, onChange, reading],
  );

  const atLimit = attachments.length >= MAX_CONTEXT_ATTACHMENTS;
  const busy = disabled || reading;

  const pickKind = (kind: AIContextKind) => {
    setMenuOpen(false);
    fileRefs.current[kind]?.click();
  };

  const menuSurface = "border-app-border bg-app-panel text-app-fg shadow-2xl";
  const menuItemHover = "hover:bg-app-hover";
  const menuTitleClass = "text-app-fg";
  const menuHintClass = "text-app-subtle";

  const attachMenu =
    menuOpen && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        aria-label="Attach context"
        className={cn(
          "fixed z-[250] w-[240px] overflow-y-auto overscroll-contain rounded-xl border py-1",
          menuSurface,
        )}
        style={anchoredMenuStyle(position)}
      >
        {AI_CONTEXT_KINDS.map((meta) => {
          const Icon = KIND_ICONS[meta.kind];
          return (
            <button
              key={meta.kind}
              type="button"
              role="menuitem"
              disabled={busy || atLimit}
              className={cn(
                "flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors",
                menuItemHover,
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
              onClick={() => pickKind(meta.kind)}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-app-muted" strokeWidth={1.75} />
              <span className="min-w-0">
                <span className={cn("block text-[12px] font-medium", menuTitleClass)}>{meta.label}</span>
                <span className={cn("block text-[10px] leading-snug", menuHintClass)}>{meta.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    ) : null;

  const attachButton =
    variant === "minimal" ? (
      <button
        ref={anchorRef}
        type="button"
        disabled={busy || atLimit}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Attach context"
        title="Attach context"
        onClick={() => setMenuOpen((v) => !v)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-app-panel text-app-muted transition-colors",
          "hover:bg-app-hover hover:text-app-fg disabled:cursor-not-allowed disabled:opacity-40",
          menuOpen && "border-accent/40 bg-app-hover text-app-fg",
        )}
      >
        {reading ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : (
          <Plus className="h-4 w-4" strokeWidth={2} />
        )}
      </button>
    ) : (
      <button
        ref={anchorRef}
        type="button"
        disabled={busy || atLimit}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className={cn(
          "mb-2 flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors",
          "border-app-border bg-black/30 text-app-fg hover:border-white/[0.14] hover:bg-black/40",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-2 text-[12px] font-medium">
          <Plus className="h-4 w-4 shrink-0 text-app-muted" strokeWidth={1.75} />
          <span className="truncate">Attach</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-app-muted transition-transform", menuOpen && "rotate-180")}
          strokeWidth={2}
        />
      </button>
    );

  const chipRow =
    attachments.length > 0 ? (
      <div
        className={cn(
          "flex flex-wrap gap-1.5",
          variant === "minimal" ? "px-4 pb-2" : "mt-1",
        )}
      >
        {attachments.map((a) => {
          const kindLabel = AI_CONTEXT_KINDS.find((k) => k.kind === a.kind)?.label ?? a.kind;
          return (
            <span
              key={a.id}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                "border-app-border bg-app-hover text-app-fg",
              )}
              title={a.name}
            >
              <span className="truncate">{a.name}</span>
              <span className="opacity-50">·</span>
              <span className="shrink-0 opacity-70">{kindLabel}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeAttachment(a.id)}
                className="shrink-0 rounded-full p-0.5 opacity-60 hover:opacity-100 disabled:opacity-30"
                aria-label={`Remove ${a.name}`}
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            </span>
          );
        })}
      </div>
    ) : null;

  if (variant === "minimal") {
    const showButton = minimalPart === "all" || minimalPart === "button";
    const showChips = minimalPart === "all" || minimalPart === "chips";
    return (
      <>
        {showButton ? attachButton : null}
        {showButton && mounted && attachMenu ? createPortal(attachMenu, document.body) : null}
        {showButton
          ? AI_CONTEXT_KINDS.map((meta) => (
              <input
                key={meta.kind}
                ref={(el) => {
                  fileRefs.current[meta.kind] = el;
                }}
                type="file"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                accept={meta.accept || undefined}
                multiple={!meta.directory}
                {...(meta.directory ? { webkitdirectory: "", directory: "" } : {})}
                onChange={(e) => {
                  const files = e.target.files;
                  e.target.value = "";
                  if (meta.directory) void onPickFolder(files);
                  else void onPickFiles(meta.kind, files);
                }}
              />
            ))
          : null}
        {showChips ? chipRow : null}
      </>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-app-subtle">Context</p>
        <span className="shrink-0 text-[10px] text-app-subtle">
          {attachments.length}/{MAX_CONTEXT_ATTACHMENTS}
          {reading ? (
            <span className="ml-1 inline-flex items-center gap-1 text-violet-300">
              <Loader2 className="h-3 w-3 animate-spin" />
            </span>
          ) : null}
        </span>
      </div>
      {attachButton}
      {mounted && attachMenu ? createPortal(attachMenu, document.body) : null}
      {AI_CONTEXT_KINDS.map((meta) => (
        <input
          key={meta.kind}
          ref={(el) => {
            fileRefs.current[meta.kind] = el;
          }}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          accept={meta.accept || undefined}
          multiple={!meta.directory}
          {...(meta.directory ? { webkitdirectory: "", directory: "" } : {})}
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = "";
            if (meta.directory) void onPickFolder(files);
            else void onPickFiles(meta.kind, files);
          }}
        />
      ))}
      {chipRow}
    </div>
  );
}
