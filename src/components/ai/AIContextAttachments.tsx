"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
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
import { AIContextAttachmentLightbox } from "@/components/ai/AIContextAttachmentLightbox";
import {
  AI_ATTACH_CONTEXT_KINDS,
  AI_CONTEXT_KINDS,
  attachmentFromFile,
  attachmentFromFolder,
  MAX_CONTEXT_ATTACHMENTS,
  revokeAttachmentPreview,
  type AIContextAttachment,
  type AIContextKind,
} from "@/lib/aiGenerateContext";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";

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
  /** z-index class for portaled attach menu (e.g. above modals). */
  floatingMenuZClass?: string;
  /** External anchor for attach menu positioning (e.g. Mitra + button). */
  attachAnchorRef?: RefObject<HTMLButtonElement | null>;
  controlledMenuOpen?: boolean;
  onControlledMenuOpenChange?: (open: boolean) => void;
  hideAttachButton?: boolean;
  /** Hidden from the attach menu but still pickable via `pickKindRef` (e.g. Mitra + menu). */
  excludeAttachKinds?: AIContextKind[];
  pickKindRef?: RefObject<((kind: AIContextKind) => void) | null>;
};

export function AIContextAttachments({
  attachments,
  disabled,
  onChange,
  className,
  variant = "full",
  minimalPart = "all",
  floatingMenuZClass = "z-[250]",
  attachAnchorRef,
  controlledMenuOpen,
  onControlledMenuOpenChange,
  hideAttachButton = false,
  excludeAttachKinds = [],
  pickKindRef,
}: Props) {
  const fileRefs = useRef<Partial<Record<AIContextKind, HTMLInputElement | null>>>({});
  const internalAnchorRef = useRef<HTMLButtonElement>(null);
  const anchorRef = attachAnchorRef ?? internalAnchorRef;
  const menuRef = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState(false);
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const menuOpen = controlledMenuOpen ?? internalMenuOpen;
  const setMenuOpen = onControlledMenuOpenChange ?? setInternalMenuOpen;
  const [mounted, setMounted] = useState(false);
  const [lightboxAttachment, setLightboxAttachment] = useState<AIContextAttachment | null>(null);

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
    async (kind: AIContextKind, picked: File[]) => {
      if (!picked.length || disabled || reading) return;
      const room = MAX_CONTEXT_ATTACHMENTS - attachments.length;
      if (room <= 0) return;
      setReading(true);
      try {
        const slice = picked.slice(0, room);
        const processed = await Promise.all(slice.map((file) => attachmentFromFile(file, kind)));
        onChange([...attachments, ...processed]);
      } finally {
        setReading(false);
      }
    },
    [attachments, disabled, onChange, reading],
  );

  const onPickFolder = useCallback(
    async (picked: File[]) => {
      if (!picked.length || disabled || reading) return;
      if (attachments.length >= MAX_CONTEXT_ATTACHMENTS) return;
      setReading(true);
      try {
        const processed = await attachmentFromFolder(picked);
        onChange([...attachments, processed]);
      } finally {
        setReading(false);
      }
    },
    [attachments, disabled, onChange, reading],
  );

  const handleFileInputChange = useCallback(
    (kind: AIContextKind, directory: boolean | undefined, input: HTMLInputElement) => {
      const picked = input.files ? Array.from(input.files) : [];
      input.value = "";
      if (!picked.length) return;
      if (directory) void onPickFolder(picked);
      else void onPickFiles(kind, picked);
    },
    [onPickFiles, onPickFolder],
  );

  const atLimit = attachments.length >= MAX_CONTEXT_ATTACHMENTS;
  const busy = disabled || reading;

  const attachKinds = useMemo(
    () => AI_ATTACH_CONTEXT_KINDS.filter((meta) => !excludeAttachKinds.includes(meta.kind)),
    [excludeAttachKinds],
  );

  const inputKinds = useMemo(() => {
    const kinds = new Set<AIContextKind>(attachKinds.map((meta) => meta.kind));
    for (const kind of excludeAttachKinds) kinds.add(kind);
    return AI_CONTEXT_KINDS.filter((meta) => kinds.has(meta.kind));
  }, [attachKinds, excludeAttachKinds]);

  const pickKind = useCallback(
    (kind: AIContextKind) => {
      setMenuOpen(false);
      requestAnimationFrame(() => {
        fileRefs.current[kind]?.click();
      });
    },
    [setMenuOpen],
  );

  useEffect(() => {
    if (!pickKindRef) return;
    pickKindRef.current = pickKind;
    return () => {
      pickKindRef.current = null;
    };
  }, [pickKind, pickKindRef]);

  const pickKindFromMenu = (kind: AIContextKind) => {
    pickKind(kind);
  };

  const attachMenu =
    menuOpen && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        aria-label="Attach context"
        data-editor-shell
        className={cn(
          "editor-floating-menu editor-menu-dropdown fixed w-[240px] overflow-y-auto overscroll-contain border border-app-border bg-app-surface shadow-xl thin-scroll",
          floatingMenuZClass,
        )}
        style={anchoredMenuStyle(position)}
      >
        {attachKinds.map((meta) => {
          const Icon = KIND_ICONS[meta.kind];
          return (
            <button
              key={meta.kind}
              type="button"
              role="menuitem"
              disabled={busy || atLimit}
              className={cn(
                "editor-menu-dropdown-item !items-start !justify-start",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
              onClick={() => pickKindFromMenu(meta.kind)}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-app-muted" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{meta.label}</span>
                <span className="block text-ui font-normal leading-snug text-app-subtle">{meta.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    ) : null;

  const attachButton =
    variant === "minimal" ? (
      <EditorHintWrap title="Attach context">
        <button
          ref={anchorRef}
          type="button"
          disabled={busy || atLimit}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Attach context"
          onClick={() => setMenuOpen(!menuOpen)}
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
      </EditorHintWrap>
    ) : (
      <button
        ref={anchorRef}
        type="button"
        disabled={busy || atLimit}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
        className={cn(
          "mb-2 flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors",
          "border-app-border bg-black/30 text-app-fg hover:border-white/[0.14] hover:bg-black/40",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-2 text-ui font-medium">
          <Plus className="h-4 w-4 shrink-0 text-app-muted" strokeWidth={1.75} />
          <span className="truncate">Attach</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-app-muted transition-transform", menuOpen && "rotate-180")}
          strokeWidth={2}
        />
      </button>
    );

  const previewRow =
    attachments.length > 0 ? (
      <div
        className={cn(
          "flex flex-wrap gap-2",
          variant === "minimal" ? "px-4 pb-2" : "mt-1",
        )}
      >
        {attachments.map((a) => {
          const Icon = KIND_ICONS[a.kind];
          const kindLabel = AI_CONTEXT_KINDS.find((k) => k.kind === a.kind)?.label ?? a.kind;
          const hasThumb = Boolean(a.previewUrl) && (a.kind === "image" || a.kind === "video");
          const canPreview = a.status === "ready";

          return (
            <div key={a.id} className="group relative flex w-[72px] flex-col gap-1">
              <EditorHintWrap title={canPreview ? `Preview ${a.name}` : a.error ?? a.name}>
                <button
                  type="button"
                  disabled={!canPreview}
                  aria-label={canPreview ? `Preview ${a.name}` : a.name}
                  onClick={() => canPreview && setLightboxAttachment(a)}
                  className={cn(
                    "relative h-[72px] w-[72px] overflow-hidden rounded-xl border border-app-border bg-app-inset transition-colors",
                    canPreview && "cursor-zoom-in hover:border-accent/40 hover:ring-2 hover:ring-accent/20",
                    !canPreview && "cursor-default opacity-70",
                    a.status === "error" && "border-rose-500/40",
                  )}
                >
                {a.status === "loading" ? (
                  <span className="flex h-full w-full items-center justify-center text-app-muted">
                    <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
                  </span>
                ) : hasThumb ? (
                  a.kind === "video" ? (
                    <>
                      <video
                        src={a.previewUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                        <Video className="h-5 w-5 text-white/90" strokeWidth={2} />
                      </span>
                    </>
                  ) : (
                    <img src={a.previewUrl} alt="" className="h-full w-full object-cover" />
                  )
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-app-muted">
                    <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                    <span className="line-clamp-2 text-center text-ui leading-tight text-app-subtle">
                      {kindLabel}
                    </span>
                  </span>
                )}
              </button>
              </EditorHintWrap>

              <EditorHintWrap title={a.name}>
                <p className="truncate text-center text-ui text-app-muted">
                  {a.name}
                </p>
              </EditorHintWrap>

              <button
                type="button"
                disabled={busy}
                onClick={() => removeAttachment(a.id)}
                className={cn(
                  "absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-app-border bg-app-panel text-app-muted shadow-sm transition-opacity",
                  "opacity-90 hover:bg-app-hover hover:text-app-fg disabled:opacity-30 sm:opacity-0 sm:group-hover:opacity-100",
                  "focus-visible:opacity-100",
                )}
                aria-label={`Remove ${a.name}`}
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>
    ) : null;

  const lightbox = (
    <AIContextAttachmentLightbox attachment={lightboxAttachment} onClose={() => setLightboxAttachment(null)} />
  );

  if (variant === "minimal") {
    const showButton = !hideAttachButton && (minimalPart === "all" || minimalPart === "button");
    const showAttachUi = showButton || hideAttachButton;
    const showChips = minimalPart === "all" || minimalPart === "chips";
    return (
      <>
        {showButton ? attachButton : null}
        {showAttachUi && mounted && attachMenu ? createPortal(attachMenu, document.body) : null}
        {showAttachUi
          ? inputKinds.map((meta) => (
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
                onChange={(e) => handleFileInputChange(meta.kind, meta.directory, e.currentTarget)}
              />
            ))
          : null}
        {showChips ? previewRow : null}
        {lightbox}
      </>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="section-heading">Context</p>
        <span className="shrink-0 text-ui text-app-subtle">
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
      {inputKinds.map((meta) => (
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
          onChange={(e) => handleFileInputChange(meta.kind, meta.directory, e.currentTarget)}
        />
      ))}
      {previewRow}
      {lightbox}
    </div>
  );
}
