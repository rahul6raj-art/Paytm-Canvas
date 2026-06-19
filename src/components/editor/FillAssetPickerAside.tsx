"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Image, Upload, Video, X } from "lucide-react";
import type { EditorAsset } from "@/lib/documentPersistence";
import { IMAGE_IMPORT_ACCEPT, VIDEO_IMPORT_ACCEPT } from "@/lib/editorAssets";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  adjacentPanelDialogStyle,
  useAdjacentPanelDialogPosition,
} from "./useAdjacentPanelDialogPosition";
import { useDismissAnchoredDropdown } from "./useAnchoredDropdown";
import { useDraggableFloatingPanel } from "./useDraggableFloatingPanel";

export function FillAssetPickerAside({
  open,
  onClose,
  anchorRef,
  title,
  mode,
  disabled,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  title: string;
  mode: "image" | "video";
  disabled?: boolean;
  onSelect: (assetId: string) => void;
}) {
  const assets = useEditorStore((s) => s.assets);
  const importImageAsset = useEditorStore((s) => s.importImageAsset);
  const importVideoAsset = useEditorStore((s) => s.importVideoAsset);
  const [mounted, setMounted] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const position = useAdjacentPanelDialogPosition(anchorRef, open, {
    width: 220,
    maxHeight: 320,
  });
  const { position: dragPosition, onHeaderPointerDown, isDragging } = useDraggableFloatingPanel(
    open,
    position,
  );

  useDismissAnchoredDropdown(open, onClose, anchorRef, pickerRef);
  useEffect(() => setMounted(true), []);

  const isVideo = mode === "video";
  const accept = isVideo ? VIDEO_IMPORT_ACCEPT : IMAGE_IMPORT_ACCEPT;

  const filtered = Object.values(assets)
    .filter((a) => {
      const mime = a.mimeType.toLowerCase();
      if (isVideo) return mime.startsWith("video/");
      return mime.startsWith("image/");
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const importFile = async (file: File) => {
    const id = isVideo ? await importVideoAsset(file) : await importImageAsset(file);
    if (id) {
      onSelect(id);
      onClose();
    }
  };

  const menu =
    open && mounted ? (
      <div
        ref={pickerRef}
        role="dialog"
        aria-label={title}
        aria-modal="false"
        data-editor-shell
        className="editor-inspector-dialog fixed z-[121]"
        style={adjacentPanelDialogStyle(dragPosition)}
      >
        <div
          className={cn("editor-inspector-dialog-header !px-2.5 !py-1.5", isDragging && "cursor-grabbing")}
          onPointerDown={onHeaderPointerDown}
        >
          <span className="pointer-events-none text-ui font-medium text-app-fg">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
        <div className="thin-scroll max-h-[240px] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-1 py-3 text-center text-ui text-app-subtle">
              {isVideo ? "No videos yet" : "No images yet"}
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((a) => (
                <AssetRow key={a.id} asset={a} isVideo={isVideo} onSelect={() => {
                  onSelect(a.id);
                  onClose();
                }} />
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-app-border p-1.5">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importFile(file);
            }}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
            className="flex h-7 w-full items-center justify-center gap-1.5 rounded border border-dashed border-app-border text-ui font-medium text-app-muted transition-colors hover:border-app-muted hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={2} />
            Import {isVideo ? "video" : "image"}
          </button>
        </div>
      </div>
    ) : null;

  return mounted && menu ? createPortal(menu, document.body) : null;
}

function AssetRow({
  asset,
  isVideo,
  onSelect,
}: {
  asset: EditorAsset;
  isVideo: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-left transition-colors",
          "hover:border-app-border hover:bg-app-hover",
        )}
      >
        {isVideo ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-app-border bg-app-inset text-app-muted">
            <Video className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.dataUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded border border-app-border object-cover"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-ui text-app-fg">{asset.name}</span>
        {!isVideo ? null : (
          <Image className="h-3 w-3 shrink-0 text-app-subtle opacity-0" aria-hidden />
        )}
      </button>
    </li>
  );
}
