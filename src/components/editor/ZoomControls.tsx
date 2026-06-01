"use client";

import { useEditorStore } from "@/stores/useEditorStore";
import { formatZoomPercent, KEYBOARD_ZOOM_STEP } from "@/lib/canvasZoom";
import { resetCanvasView, zoomCanvasAtViewportCenter } from "@/lib/viewportZoom";

export function ZoomControls() {
  const zoom = useEditorStore((s) => s.zoom);
  const pct = formatZoomPercent(zoom);
  return (
    <div className="flex items-center gap-1">
      <span className="min-w-[36px] text-right text-[11px] tabular-nums text-[#8c8c8c]">{pct}%</span>
      <div className="flex items-center overflow-hidden rounded border border-white/[0.08] bg-[#2c2c2c] text-[11px] font-medium">
        <button
          type="button"
          className="px-2 py-0.5 text-[#c4c4c4] transition-colors hover:bg-white/[0.06] hover:text-white"
          onClick={() => zoomCanvasAtViewportCenter(1 / KEYBOARD_ZOOM_STEP, { recordHistory: true })}
          title="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="border-x border-white/[0.08] px-2 py-0.5 text-[#c4c4c4] transition-colors hover:bg-white/[0.06] hover:text-white"
          onClick={() => {
            const z = useEditorStore.getState().zoom;
            if (z <= 0) return;
            zoomCanvasAtViewportCenter(1 / z, { recordHistory: true });
          }}
          title="100% zoom"
        >
          100%
        </button>
        <button
          type="button"
          className="px-2 py-0.5 text-[#c4c4c4] transition-colors hover:bg-white/[0.06] hover:text-white"
          onClick={() => zoomCanvasAtViewportCenter(KEYBOARD_ZOOM_STEP, { recordHistory: true })}
          title="Zoom in"
        >
          +
        </button>
      </div>
      <button
        type="button"
        className="rounded border border-white/[0.08] bg-[#2c2c2c] px-1.5 py-0.5 text-[11px] font-medium text-[#a3a3a3] transition-colors hover:bg-white/[0.06] hover:text-white"
        onClick={() => resetCanvasView()}
        title="Reset view (100% zoom, center artboard)"
      >
        Reset
      </button>
    </div>
  );
}
