"use client";

import { useRef } from "react";
import { ImagePlus, PanelRight } from "lucide-react";
import { ToolButton } from "./ToolButton";
import { useEditorStore } from "@/stores/useEditorStore";
import { getLastCanvasWorldPoint } from "@/lib/canvasPointerMemory";
import { isSvgLayerImportFile } from "@/lib/svgFileImport";
import { isPaytmCraftHttpApiMode } from "@/lib/env";
import { cn } from "@/lib/utils";

export function RightPanelQuickTools({ className }: { className?: string }) {
  const imageImportInputRef = useRef<HTMLInputElement>(null);
  const isApiBackedFile = useEditorStore((s) => s.isApiBackedFile);
  const apiCommentsStatus = useEditorStore((s) => s.apiCommentsStatus);
  const commentsPanelOpen = useEditorStore((s) => s.commentsPanelOpen);
  const toggleCommentsPanel = useEditorStore((s) => s.toggleCommentsPanel);
  const importImageAsset = useEditorStore((s) => s.importImageAsset);
  const addImageNodeAt = useEditorStore((s) => s.addImageNodeAt);
  const placeImageFilesOnCanvas = useEditorStore((s) => s.placeImageFilesOnCanvas);

  const isApiMode = isPaytmCraftHttpApiMode();

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      <input
        ref={imageImportInputRef}
        data-place-image-input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        aria-hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (isSvgLayerImportFile(file)) {
            const last = getLastCanvasWorldPoint();
            await placeImageFilesOnCanvas([file], last?.x ?? 200, last?.y ?? 200);
            return;
          }
          const aid = await importImageAsset(file);
          if (!aid) return;
          addImageNodeAt(aid);
        }}
      />
      <ToolButton
        active={false}
        aria-label="Import image"
        title="Import image"
        onClick={() => imageImportInputRef.current?.click()}
      >
        <ImagePlus className="size-icon-ui" strokeWidth={1.85} />
      </ToolButton>
      <ToolButton
        active={commentsPanelOpen}
        aria-label="Comments panel"
        title="Comments panel"
        onClick={() => toggleCommentsPanel()}
      >
        <PanelRight className="size-icon-ui" strokeWidth={1.85} />
      </ToolButton>
      {isApiMode && isApiBackedFile && apiCommentsStatus === "synced" ? (
        <span
          className="ml-1 min-w-0 shrink truncate text-ui text-emerald-300/90"
          title="Thread comments are stored on the mock API for this file"
        >
          Synced
        </span>
      ) : null}
    </div>
  );
}
