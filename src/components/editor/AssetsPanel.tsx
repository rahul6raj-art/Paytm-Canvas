"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, ImageUp, Sparkles, Trash2, Type } from "lucide-react";
import {
  applyFontFamilyToSelectedText,
  canAcceptCanvasFontDrop,
  handleCanvasFontDrop,
} from "@/lib/canvasFontImport";
import { ensureFontFamilyLoaded } from "@/lib/fonts/fontLoader";
import { uploadedFontOptionsFromAssets } from "@/lib/fonts/uploadedFonts";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "./EditorHoverHint";

function formatAssetMeta(a: { mimeType: string; width?: number; height?: number; dataUrl: string }): string {
  const dim =
    a.width != null && a.height != null && a.width > 0 && a.height > 0 ? `${a.width}×${a.height}` : "—";
  const approxKb = Math.max(1, Math.round((a.dataUrl.length * 3) / 4 / 1024));
  return `${dim} · ${approxKb} KB · ${a.mimeType.replace("image/", "")}`;
}

type AssetContextMenu = { assetId: string; x: number; y: number };

export function AssetsPanel() {
  const assets = useEditorStore((s) => s.assets);
  const fontAssets = useEditorStore((s) => s.fontAssets);
  const nodes = useEditorStore((s) => s.nodes);
  const setLeftTab = useEditorStore((s) => s.setLeftTab);
  const setTool = useEditorStore((s) => s.setTool);
  const addImageNodeAt = useEditorStore((s) => s.addImageNodeAt);
  const replaceAsset = useEditorStore((s) => s.replaceAsset);
  const deleteAsset = useEditorStore((s) => s.deleteAsset);
  const [contextMenu, setContextMenu] = useState<AssetContextMenu | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);

  const assetList = useMemo(
    () => Object.values(assets).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [assets],
  );

  const fontList = useMemo(
    () => Object.values(fontAssets).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [fontAssets],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };
    const onPointer = () => closeContextMenu();
    const onScroll = () => closeContextMenu();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    const timer = window.setTimeout(() => {
      window.addEventListener("pointerdown", onPointer);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [closeContextMenu, contextMenu]);

  const placeImageByClick = useCallback(
    (assetId: string) => {
      setTool("move");
      addImageNodeAt(assetId);
      setLeftTab("layers");
    },
    [addImageNodeAt, setLeftTab, setTool],
  );

  const applyFontByClick = useCallback(
    async (assetId: string) => {
      const asset = fontAssets[assetId];
      if (!asset) return;
      const opt = uploadedFontOptionsFromAssets({ [assetId]: asset })[0];
      if (!opt) return;
      await ensureFontFamilyLoaded(opt.value, fontAssets);
      applyFontFamilyToSelectedText(opt.value);
    },
    [fontAssets],
  );

  const onFontDragOver = useCallback((e: React.DragEvent) => {
    if (!canAcceptCanvasFontDrop(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onFontDrop = useCallback(async (e: React.DragEvent) => {
    if (!canAcceptCanvasFontDrop(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    await handleCanvasFontDrop(e.dataTransfer);
  }, []);

  const openAssetContextMenu = useCallback((assetId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ assetId, x: e.clientX, y: e.clientY });
  }, []);

  const startReplaceAsset = useCallback(
    (assetId: string) => {
      replaceTargetRef.current = assetId;
      closeContextMenu();
      replaceInputRef.current?.click();
    },
    [closeContextMenu],
  );

  const removeAsset = useCallback(
    (assetId: string) => {
      const asset = assets[assetId];
      if (!asset) return;
      const usedCount = Object.values(nodes).filter(
        (n) => n.type === "image" && n.assetId === assetId,
      ).length;
      if (
        usedCount > 0 &&
        !window.confirm(
          `Remove "${asset.name}" from the library? ${usedCount} canvas image${usedCount === 1 ? "" : "s"} will lose this asset.`,
        )
      ) {
        return;
      }
      deleteAsset(assetId);
      closeContextMenu();
    },
    [assets, closeContextMenu, deleteAsset, nodes],
  );

  const tiles = [
    { t: "Media", i: Image },
    { t: "Plugins", i: Sparkles },
  ];

  const contextAsset = contextMenu ? assets[contextMenu.assetId] : null;

  return (
    <div className="thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          const assetId = replaceTargetRef.current;
          e.target.value = "";
          replaceTargetRef.current = null;
          if (!file || !assetId) return;
          await replaceAsset(assetId, file);
        }}
      />

      <p className="mb-2 px-1 section-heading">
        Imported images
      </p>
      {assetList.length === 0 ? (
        <div className="mb-3 rounded-lg border border-dashed border-app-border bg-white/[0.02] px-3 py-5 text-center">
          <Image className="mx-auto mb-2 h-7 w-7 text-[#4a4a4a]" strokeWidth={1.25} />
          <p className="text-ui font-medium text-app-muted">No imported images</p>
          <p className="mt-1 text-ui leading-relaxed text-app-subtle">
            Use <span className="font-medium text-app-subtle">Import image</span> in the toolbar, drop images on the
            canvas, or paste with ⌘V.
          </p>
        </div>
      ) : (
        <ul className="mb-3 space-y-1">
          {assetList.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-pc-asset", a.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => placeImageByClick(a.id)}
                onContextMenu={(e) => openAssetContextMenu(a.id, e)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border border-app-border bg-app-panel px-2 py-1.5 text-left transition-colors",
                  "hover:border-sky-500/35 hover:bg-sky-500/10 hover:text-app-fg",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.dataUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded border border-app-border-subtle object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui font-medium text-app-fg">{a.name}</span>
                  <span className="mt-0.5 block truncate text-ui text-app-subtle">{formatAssetMeta(a)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {contextMenu && contextAsset ? (
        <div
          className="fixed z-[80] min-w-[168px] editor-floating-menu border border-app-border bg-app-surface py-1 shadow-xl"
          style={{
            left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 176)),
            top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 88)),
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
            onClick={() => startReplaceAsset(contextMenu.assetId)}
          >
            <ImageUp className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
            Replace…
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-red-300 hover:bg-red-500/15"
            onClick={() => removeAsset(contextMenu.assetId)}
          >
            <Trash2 className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
            Remove
          </button>
        </div>
      ) : null}

      <p className="mb-2 px-1 section-heading">
        Uploaded fonts
      </p>
      <div
        onDragOver={onFontDragOver}
        onDrop={onFontDrop}
        className="mb-3 rounded-lg border border-dashed border-app-border bg-white/[0.02] px-3 py-4"
      >
        {fontList.length === 0 ? (
          <div className="text-center">
            <Type className="mx-auto mb-2 h-7 w-7 text-[#4a4a4a]" strokeWidth={1.25} />
            <p className="text-ui font-medium text-app-muted">No uploaded fonts</p>
            <p className="mt-1 text-ui leading-relaxed text-app-subtle">
              Drop TTF or OTF files here, on the canvas, or use{" "}
              <span className="font-medium text-app-subtle">Upload font</span> in the font picker.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {fontList.map((f) => (
              <li key={f.id}>
                <EditorHintWrap title="Apply to selected text">
                  <button
                    type="button"
                    onClick={() => void applyFontByClick(f.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border border-app-border bg-app-panel px-2 py-1.5 text-left transition-colors",
                      "hover:border-violet-500/35 hover:bg-violet-500/10 hover:text-app-fg",
                    )}
                  >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-app-border-subtle bg-app-inset text-ui font-semibold text-app-fg"
                    style={{ fontFamily: `"${f.family.replace(/"/g, '\\"')}", system-ui, sans-serif` }}
                  >
                    Aa
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui font-medium text-app-fg">{f.family}</span>
                    <span className="mt-0.5 block truncate text-ui text-app-subtle">
                      {f.fileName} · w{f.weight}
                    </span>
                  </span>
                </button>
                </EditorHintWrap>
              </li>
            ))}
            <p className="px-1 pt-1 text-ui leading-relaxed text-app-subtle">
              Drop more font files here to add them. Click a font to apply it to selected text.
            </p>
          </ul>
        )}
      </div>

      <p className="mb-2 px-1 section-heading">
        Libraries
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {tiles.map(({ t, i: I }) => (
          <button
            key={t}
            type="button"
            className="flex flex-col items-center gap-1 rounded-md border border-app-border bg-app-panel py-2.5 text-ui font-medium text-app-muted transition-colors hover:border-white/15 hover:bg-app-hover hover:text-app-fg"
          >
            <I className="h-4 w-4" strokeWidth={1.75} />
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
