"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FileCode, FileText, Folder, FolderOpen, Image as ImageIcon, Sparkles, Video, X } from "lucide-react";
import type { AIContextAttachment, AIContextKind } from "@/lib/aiGenerateContext";
import { AI_CONTEXT_KINDS } from "@/lib/aiGenerateContext";

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
  attachment: AIContextAttachment | null;
  onClose: () => void;
};

export function AIContextAttachmentLightbox({ attachment, onClose }: Props) {
  useEffect(() => {
    if (!attachment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attachment, onClose]);

  if (!attachment) return null;

  const kindLabel = AI_CONTEXT_KINDS.find((k) => k.kind === attachment.kind)?.label ?? attachment.kind;
  const Icon = KIND_ICONS[attachment.kind];
  const hasVisual = Boolean(attachment.previewUrl) && (attachment.kind === "image" || attachment.kind === "video");

  return createPortal(
    <div
      className="fixed inset-0 z-[530] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${attachment.name}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-app-border-subtle px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-app-fg">{attachment.name}</p>
            <p className="text-[11px] text-app-muted">{kindLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4">
          {attachment.status === "error" ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100">
              {attachment.error ?? "Could not load attachment."}
            </p>
          ) : hasVisual ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-app-border bg-app-inset p-2">
              {attachment.kind === "video" ? (
                <video
                  src={attachment.previewUrl}
                  controls
                  playsInline
                  className="max-h-[min(72vh,760px)] w-full rounded-lg object-contain"
                />
              ) : (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name}
                  className="max-h-[min(72vh,760px)] w-full rounded-lg object-contain"
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-app-border bg-app-inset px-4 py-8">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-app-border bg-app-panel text-app-muted">
                <Icon className="h-8 w-8" strokeWidth={1.5} />
              </span>
              <p className="text-center text-[12px] font-medium text-app-fg">{attachment.name}</p>
              {attachment.summary ? (
                <pre className="thin-scroll max-h-[min(50vh,420px)] w-full overflow-y-auto whitespace-pre-wrap rounded-lg border border-app-border bg-app-panel p-3 text-left text-[11px] leading-relaxed text-app-muted">
                  {attachment.summary}
                </pre>
              ) : (
                <p className="text-center text-[11px] text-app-subtle">No preview available for this file type.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
