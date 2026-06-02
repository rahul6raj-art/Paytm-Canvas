"use client";

import { useEditorStore } from "@/stores/useEditorStore";
import { formatZoomPercent, KEYBOARD_ZOOM_STEP } from "@/lib/canvasZoom";
import { resetCanvasView, zoomCanvasAtViewportCenter } from "@/lib/viewportZoom";

export function ZoomControls() {
  const zoom = useEditorStore((s) => s.zoom);
  const pct = formatZoomPercent(zoom);
  return (
    <div className="flex items-center gap-1">
      <span className="min-w-[36px] text-right text-[11px] tabular-nums text-app-subtle">{pct}%</span>
      <div className="flex items-center overflow-hidden rounded border border-app-border bg-app-panel text-[11px] font-medium">
        <button
          type="button"
          className="px-2 py-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
          onClick={() => zoomCanvasAtViewportCenter(1 / KEYBOARD_ZOOM_STEP, { recordHistory: true })}
          title="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="border-x border-app-border px-2 py-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
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
          className="px-2 py-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
          onClick={() => zoomCanvasAtViewportCenter(KEYBOARD_ZOOM_STEP, { recordHistory: true })}
          title="Zoom in"
        >
          +
        </button>
      </div>
      <button
        type="button"
        className="rounded border border-app-border bg-app-panel px-1.5 py-0.5 text-[11px] font-medium text-[#a3a3a3] transition-colors hover:bg-app-hover hover:text-app-fg"
        onClick={() => resetCanvasView()}
        title="Reset view (100% zoom, center artboard)"
      >
        Reset
      </button>
    </div>
  );
}
