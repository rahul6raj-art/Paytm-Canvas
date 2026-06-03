"use client";

import { useCallback, useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { RESIZE_MIN_DIMENSION } from "@/lib/resize";
import { RESPONSIVE_DEVICE_PRESETS } from "@/lib/framePresets";
import { cn } from "@/lib/utils";

export function ResponsivePreviewPanel() {
  const responsivePreview = useEditorStore((s) => s.responsivePreview);
  const nodes = useEditorStore((s) => s.nodes);
  const updateResponsivePreviewBounds = useEditorStore((s) => s.updateResponsivePreviewBounds);
  const resetResponsivePreview = useEditorStore((s) => s.resetResponsivePreview);
  const cancelResponsivePreview = useEditorStore((s) => s.cancelResponsivePreview);
  const applyResponsivePreview = useEditorStore((s) => s.applyResponsivePreview);

  const frame = responsivePreview ? nodes[responsivePreview.frameId] : undefined;

  const dw = responsivePreview?.draftWidth ?? 0;
  const dh = responsivePreview?.draftHeight ?? 0;
  const maxW = useMemo(
    () => Math.max(2048, dw + 400, (frame?.width ?? 0) + 400),
    [dw, frame?.width],
  );
  const maxH = useMemo(
    () => Math.max(2048, dh + 400, (frame?.height ?? 0) + 400),
    [dh, frame?.height],
  );

  const onWidthInput = useCallback(
    (v: number) => {
      if (!responsivePreview) return;
      updateResponsivePreviewBounds(v, responsivePreview.draftHeight);
    },
    [responsivePreview, updateResponsivePreviewBounds],
  );

  const onHeightInput = useCallback(
    (v: number) => {
      if (!responsivePreview) return;
      updateResponsivePreviewBounds(responsivePreview.draftWidth, v);
    },
    [responsivePreview, updateResponsivePreviewBounds],
  );

  if (!responsivePreview || !frame) return null;

  const frameName = frame.name ?? "Frame";

  return (
    <div className="shrink-0 border-t border-app-border bg-app-panel p-2 shadow-[0_-4px_12px_rgba(0,0,0,0.25)]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">Responsive preview</p>
          <p className="truncate text-[12px] font-medium text-white" title={frameName}>
            {frameName}
          </p>
        </div>
        <span className="shrink-0 rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-100">
          Draft
        </span>
      </div>

      <p className="mb-2 text-[10px] leading-relaxed text-[#737373]">
        Canvas updates live. Apply saves with one undo step; Cancel reverts without history.
      </p>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-medium text-app-subtle">Width</span>
          <input
            type="range"
            min={RESIZE_MIN_DIMENSION}
            max={maxW}
            value={Math.min(dw, maxW)}
            onChange={(e) => onWidthInput(Number(e.target.value))}
            className="w-full accent-sky-500"
          />
          <span className="mt-0.5 block text-right font-mono text-[10px] text-app-muted">{Math.round(dw)}</span>
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-medium text-app-subtle">Height</span>
          <input
            type="range"
            min={RESIZE_MIN_DIMENSION}
            max={maxH}
            value={Math.min(dh, maxH)}
            onChange={(e) => onHeightInput(Number(e.target.value))}
            className="w-full accent-sky-500"
          />
          <span className="mt-0.5 block text-right font-mono text-[10px] text-app-muted">{Math.round(dh)}</span>
        </label>
      </div>

      <div className="mb-2">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-app-subtle">Presets</p>
        <div className="flex flex-wrap gap-1">
          {RESPONSIVE_DEVICE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => updateResponsivePreviewBounds(p.width, p.height)}
              className={cn(
                "rounded border px-2 py-1 text-[10px] font-medium transition-colors",
                "border-app-border bg-[#333] text-app-fg hover:border-sky-500/40 hover:bg-sky-500/10",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => resetResponsivePreview()}
          className="rounded border border-app-border bg-app-hover px-2 py-1.5 text-[11px] font-medium text-app-fg hover:bg-white/[0.1]"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => cancelResponsivePreview()}
          className="rounded border border-app-border px-2 py-1.5 text-[11px] font-medium text-app-muted hover:bg-white/[0.05]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => applyResponsivePreview()}
          className="ml-auto rounded border border-sky-500/45 bg-sky-500/20 px-3 py-1.5 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/30"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
