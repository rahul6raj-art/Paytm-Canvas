"use client";

import { useCallback, useMemo } from "react";
import { Image, Sparkles } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";

function formatAssetMeta(a: { mimeType: string; width?: number; height?: number; dataUrl: string }): string {
  const dim =
    a.width != null && a.height != null && a.width > 0 && a.height > 0 ? `${a.width}×${a.height}` : "—";
  const approxKb = Math.max(1, Math.round((a.dataUrl.length * 3) / 4 / 1024));
  return `${dim} · ${approxKb} KB · ${a.mimeType.replace("image/", "")}`;
}

export function AssetsPanel() {
  const assets = useEditorStore((s) => s.assets);
  const setLeftTab = useEditorStore((s) => s.setLeftTab);
  const setTool = useEditorStore((s) => s.setTool);
  const addImageNodeAt = useEditorStore((s) => s.addImageNodeAt);

  const assetList = useMemo(
    () => Object.values(assets).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [assets],
  );

  const placeImageByClick = useCallback(
    (assetId: string) => {
      setTool("move");
      addImageNodeAt(assetId);
      setLeftTab("layers");
    },
    [addImageNodeAt, setLeftTab, setTool],
  );

  const tiles = [
    { t: "Media", i: Image },
    { t: "Plugins", i: Sparkles },
  ];

  return (
    <div className="thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-app-subtle">
        Imported images
      </p>
      {assetList.length === 0 ? (
        <div className="mb-3 rounded-lg border border-dashed border-app-border bg-white/[0.02] px-3 py-5 text-center">
          <Image className="mx-auto mb-2 h-7 w-7 text-[#4a4a4a]" strokeWidth={1.25} />
          <p className="text-[12px] font-medium text-app-muted">No imported images</p>
          <p className="mt-1 text-[11px] leading-relaxed text-app-subtle">
            Use <span className="font-medium text-app-subtle">Import image</span> in the toolbar or drop files on the
            canvas.
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
                  <span className="block truncate text-[11px] font-medium text-app-fg">{a.name}</span>
                  <span className="mt-0.5 block truncate text-[9px] text-app-subtle">{formatAssetMeta(a)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-app-subtle">
        Libraries
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {tiles.map(({ t, i: I }) => (
          <button
            key={t}
            type="button"
            className="flex flex-col items-center gap-1 rounded-md border border-app-border bg-app-panel py-2.5 text-[11px] font-medium text-app-muted transition-colors hover:border-white/15 hover:bg-app-hover hover:text-app-fg"
          >
            <I className="h-4 w-4" strokeWidth={1.75} />
            {t}
          </button>
        ))}
      </div>

      <p className="mt-3 px-1 text-[10px] leading-relaxed text-app-subtle">
        Reusable components live in the <span className="font-medium text-app-subtle">Comp</span> sidebar tab. Drag
        images here onto the canvas to place them.
      </p>
    </div>
  );
}
