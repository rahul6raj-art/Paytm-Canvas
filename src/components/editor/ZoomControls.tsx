"use client";

import { useEditorStore } from "@/stores/useEditorStore";
import {
  formatZoomPercent,
  KEYBOARD_ZOOM_STEP,
} from "@/lib/canvasZoom";
import { resetCanvasView, zoomCanvasAtViewportCenter } from "@/lib/viewportZoom";
import { EditorHintWrap } from "./EditorHoverHint";

export function ZoomControls() {
  const zoom = useEditorStore((s) => s.zoom);
  const pct = formatZoomPercent(zoom);
  return (
    <div className="flex items-center gap-1">
      <span className="min-w-[36px] text-right text-ui tabular-nums text-app-subtle">{pct}</span>
      <div className="flex items-center overflow-hidden rounded border border-app-border bg-app-panel text-ui font-medium">
        <EditorHintWrap title="Zoom out" hintSide="bottom">
          <button
            type="button"
            className="px-2 py-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
            onClick={() => zoomCanvasAtViewportCenter(1 / KEYBOARD_ZOOM_STEP, { recordHistory: true })}
          >
            −
          </button>
        </EditorHintWrap>
        <EditorHintWrap title="100% zoom" hintSide="bottom">
          <button
            type="button"
            className="border-x border-app-border px-2 py-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
            onClick={() => {
              const z = useEditorStore.getState().zoom;
              if (z <= 0) return;
              zoomCanvasAtViewportCenter(1 / z, { recordHistory: true });
            }}
          >
            100%
          </button>
        </EditorHintWrap>
        <EditorHintWrap title="Zoom in" hintSide="bottom">
          <button
            type="button"
            className="px-2 py-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
            onClick={() => zoomCanvasAtViewportCenter(KEYBOARD_ZOOM_STEP, { recordHistory: true })}
          >
            +
          </button>
        </EditorHintWrap>
      </div>
      <EditorHintWrap
        hintLabel="Reset view"
        hintShortcut="100% zoom, center artboard"
        hintSide="bottom"
      >
        <button
          type="button"
          className="rounded border border-app-border bg-app-panel px-1.5 py-0.5 text-ui font-medium text-[#a3a3a3] transition-colors hover:bg-app-hover hover:text-app-fg"
          onClick={() => resetCanvasView()}
        >
          Reset
        </button>
      </EditorHintWrap>
    </div>
  );
}
