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
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6b6b6b]">
        Imported images
      </p>
      {assetList.length === 0 ? (
        <div className="mb-3 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-5 text-center">
          <Image className="mx-auto mb-2 h-7 w-7 text-[#4a4a4a]" strokeWidth={1.25} />
          <p className="text-[12px] font-medium text-[#9a9a9a]">No imported images</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#6b6b6b]">
            Use <span className="font-medium text-[#8c8c8c]">Import image</span> in the toolbar or drop files on the
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
                  "flex w-full items-center gap-2 rounded-md border border-white/[0.08] bg-[#2c2c2c] px-2 py-1.5 text-left transition-colors",
                  "hover:border-sky-500/35 hover:bg-sky-500/10 hover:text-white",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.dataUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded border border-white/[0.06] object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-[#d4d4d4]">{a.name}</span>
                  <span className="mt-0.5 block truncate text-[9px] text-[#6b6b6b]">{formatAssetMeta(a)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6b6b6b]">
        Libraries
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {tiles.map(({ t, i: I }) => (
          <button
            key={t}
            type="button"
            className="flex flex-col items-center gap-1 rounded-md border border-white/[0.08] bg-[#2c2c2c] py-2.5 text-[11px] font-medium text-[#9a9a9a] transition-colors hover:border-white/15 hover:bg-white/[0.04] hover:text-[#e6e6e6]"
          >
            <I className="h-4 w-4" strokeWidth={1.75} />
            {t}
          </button>
        ))}
      </div>

      <p className="mt-3 px-1 text-[10px] leading-relaxed text-[#5c5c5c]">
        Reusable components live in the <span className="font-medium text-[#8c8c8c]">Comp</span> sidebar tab. Drag
        images here onto the canvas to place them.
      </p>
    </div>
  );
}
