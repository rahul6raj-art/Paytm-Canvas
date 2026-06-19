"use client";

import { useMemo } from "react";
import { ChevronDown, Grid3X3, Ruler } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  formatZoomPercent,
  KEYBOARD_ZOOM_STEP,
} from "@/lib/canvasZoom";
import { resetCanvasView, zoomCanvasAtViewportCenter } from "@/lib/viewportZoom";
import { COMMENTS_PANEL_WIDTH, readRightPanelWidth } from "@/lib/sidebarPanelWidths";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "./EditorHoverHint";

const iconButtonClass =
  "flex h-9 w-9 items-center justify-center rounded-lg text-ui transition-colors hover:bg-app-hover hover:text-app-fg";

export function CanvasFloatingZoom() {
  const zoom = useEditorStore((s) => s.zoom);
  const uiChromeVisible = useEditorStore((s) => s.uiChromeVisible);
  const commentsPanelOpen = useEditorStore((s) => s.commentsPanelOpen);
  const rightPanelTab = useEditorStore((s) => s.rightPanelTab);
  const showGrid = useEditorStore((s) => s.showGrid);
  const showRulers = useEditorStore((s) => s.showRulers);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const toggleRulers = useEditorStore((s) => s.toggleRulers);
  const pct = formatZoomPercent(zoom);

  const style = useMemo(() => {
    const rightPanelWidth = readRightPanelWidth(rightPanelTab === "code");
    const rightChrome = rightPanelWidth + (commentsPanelOpen ? COMMENTS_PANEL_WIDTH : 0);
    return {
      right: rightChrome + 16,
      bottom: 16,
    };
  }, [commentsPanelOpen, rightPanelTab]);

  if (!uiChromeVisible) return null;

  return (
    <div
      className="pointer-events-auto fixed z-40 flex items-center gap-0.5 editor-floating-menu border border-app-border-subtle bg-app-panel/95 p-1 shadow-float backdrop-blur-sm"
      style={style}
      data-canvas-floating-zoom
    >
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
          className="flex h-9 min-w-[58px] items-center justify-center gap-0.5 rounded-lg px-2 text-ui font-medium tabular-nums text-app-fg transition-colors hover:bg-app-hover"
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
      <div className="mx-0.5 h-5 w-px shrink-0 bg-app-panel-edge" aria-hidden />
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
  );
}
