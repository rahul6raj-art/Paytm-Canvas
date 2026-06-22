"use client";

import { ChevronDown, Grid3X3, Ruler } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  formatZoomPercent,
  KEYBOARD_ZOOM_STEP,
} from "@/lib/canvasZoom";
import { resetCanvasView, zoomCanvasAtViewportCenter } from "@/lib/viewportZoom";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "./EditorHoverHint";

const iconButtonClass =
  "flex h-8 w-8 items-center justify-center rounded-lg text-ui transition-colors hover:bg-app-hover hover:text-app-fg";

/** Zoom, grid, and ruler controls for the right panel view section. */
export function CanvasZoomControls() {
  const zoom = useEditorStore((s) => s.zoom);
  const showGrid = useEditorStore((s) => s.showGrid);
  const showRulers = useEditorStore((s) => s.showRulers);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const toggleRulers = useEditorStore((s) => s.toggleRulers);
  const pct = formatZoomPercent(zoom);

  return (
    <div
      className="flex w-full items-center justify-between gap-1 rounded-xl bg-app-inset p-1"
      data-canvas-floating-zoom
    >
      <div className="flex min-w-0 flex-1 items-center gap-0.5">
        <EditorHintWrap title="Zoom out">
          <button
            type="button"
            aria-label="Zoom out"
            className={cn(iconButtonClass, "text-app-muted")}
            onClick={() => zoomCanvasAtViewportCenter(1 / KEYBOARD_ZOOM_STEP, { recordHistory: true })}
          >
            −
          </button>
        </EditorHintWrap>
        <EditorHintWrap hintLabel={`Zoom: ${pct}`} hintShortcut="Click for 100%">
          <button
            type="button"
            className="flex h-8 min-w-[58px] flex-1 items-center justify-center gap-0.5 rounded-lg px-2 text-ui font-medium tabular-nums text-app-fg transition-colors hover:bg-app-hover"
            onClick={() => {
              const z = useEditorStore.getState().zoom;
              if (z <= 0) return;
              if (Math.abs(z - 1) < 0.01) {
                resetCanvasView();
                return;
              }
              zoomCanvasAtViewportCenter(1 / z, { recordHistory: true });
            }}
          >
            {pct}
            <ChevronDown className="h-3 w-3 text-app-subtle" strokeWidth={2} />
          </button>
        </EditorHintWrap>
        <EditorHintWrap title="Zoom in">
          <button
            type="button"
            aria-label="Zoom in"
            className={cn(iconButtonClass, "text-app-muted")}
            onClick={() => zoomCanvasAtViewportCenter(KEYBOARD_ZOOM_STEP, { recordHistory: true })}
          >
            +
          </button>
        </EditorHintWrap>
      </div>
      <div className="mx-0.5 h-5 w-px shrink-0 bg-app-panel-edge" aria-hidden />
      <div className="flex shrink-0 items-center gap-0.5">
        <EditorHintWrap title={showRulers ? "Hide rulers" : "Show rulers"}>
          <button
            type="button"
            data-rulers-toggle
            aria-label={showRulers ? "Hide rulers" : "Show rulers"}
            aria-pressed={showRulers}
            className={cn(
              iconButtonClass,
              showRulers ? "bg-app-hover text-app-fg" : "text-app-muted",
            )}
            onClick={() => toggleRulers()}
          >
            <Ruler className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </EditorHintWrap>
        <EditorHintWrap title={showGrid ? "Hide layout grid" : "Show layout grid"}>
          <button
            type="button"
            data-grid-toggle
            aria-label={showGrid ? "Hide layout grid" : "Show layout grid"}
            aria-pressed={showGrid}
            className={cn(
              iconButtonClass,
              showGrid ? "bg-app-hover text-app-fg" : "text-app-muted",
            )}
            onClick={() => toggleGrid()}
          >
            <Grid3X3 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </EditorHintWrap>
      </div>
    </div>
  );
}

/** @deprecated Use CanvasZoomControls in the right panel view section. */
export const CanvasFloatingZoom = CanvasZoomControls;
