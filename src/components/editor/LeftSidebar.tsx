"use client";

import { useCallback, useMemo } from "react";
import { LayersPanel } from "./LayersPanel";
import { ComponentsPanel } from "./ComponentsPanel";
import { AssetsPanel } from "./AssetsPanel";
import { StylesPanel } from "./StylesPanel";
import { PagesPanel } from "./PagesPanel";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";
import {
  COMMENTS_PANEL_WIDTH,
  LEFT_SIDEBAR_BOUNDS,
  readLeftSidebarWidth,
  readRightPanelWidth,
  writeLeftSidebarWidth,
  type PanelLayoutContext,
} from "@/lib/sidebarPanelWidths";
import { ResizablePanelEdge } from "./ResizablePanelEdge";
import { useResizablePanelWidth } from "./useResizablePanelWidth";

export function LeftSidebar() {
  const leftTab = useEditorStore((s) => s.leftTab);
  const setLeftTab = useEditorStore((s) => s.setLeftTab);
  const commentsPanelOpen = useEditorStore((s) => s.commentsPanelOpen);
  const rightPanelTab = useEditorStore((s) => s.rightPanelTab);

  const panelLayout = useMemo<PanelLayoutContext>(
    () => ({
      getViewportWidth: () => window.innerWidth,
      getReservedChromeWidth: () => {
        const right = readRightPanelWidth(rightPanelTab === "code");
        return right + (commentsPanelOpen ? COMMENTS_PANEL_WIDTH : 0);
      },
    }),
    [commentsPanelOpen, rightPanelTab],
  );

  const readWidth = useCallback(() => readLeftSidebarWidth(panelLayout), [panelLayout]);
  const writeWidth = useCallback((w: number) => writeLeftSidebarWidth(w, panelLayout), [panelLayout]);
  const { width, onResizeStart, onResize, onResizeEnd } = useResizablePanelWidth(
    LEFT_SIDEBAR_BOUNDS,
    readWidth,
    writeWidth,
    panelLayout,
  );

  return (
    <aside
      className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-app-panel-edge bg-chrome-panel shadow-app-panel"
      style={{ width, minWidth: LEFT_SIDEBAR_BOUNDS.min }}
    >
      <div
        className="grid h-9 w-full shrink-0 grid-cols-4 overflow-hidden border-b border-app-panel-edge"
        role="tablist"
        aria-label="Left sidebar"
      >
        {(
          [
            ["layers", "Layers"],
            ["components", "Comp"],
            ["assets", "Assets"],
            ["styles", "Library"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={leftTab === t}
            title={t === "styles" ? "Design library" : undefined}
            onClick={() => setLeftTab(t)}
            className={cn(
              "chrome-tab",
              leftTab === t ? "chrome-tab-active" : "text-app-subtle hover:text-app-fg",
            )}
          >
            <span className="chrome-tab-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {leftTab === "layers" && (
        <>
          <PagesPanel />
          <LayersPanel />
        </>
      )}

      {leftTab === "components" && <ComponentsPanel />}

      {leftTab === "assets" && <AssetsPanel />}

      {leftTab === "styles" && <StylesPanel />}
      </div>
      <ResizablePanelEdge
        edge="right"
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
        className="hover:bg-accent/30"
      />
    </aside>
  );
}
