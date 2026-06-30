"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Component, FileStack, Image, Library, type LucideIcon } from "lucide-react";
import { LayersPanel } from "./LayersPanel";
import { ComponentsPanel } from "./ComponentsPanel";
import { AssetsPanel } from "./AssetsPanel";
import { StylesPanel } from "./StylesPanel";
import { EditorSidebarJulesPanel } from "./EditorSidebarJulesPanel";
import { EditorSidebarBrandHeader } from "./EditorSidebarBrandHeader";
import { EditorHintWrap } from "./EditorHoverHint";
import { useEditorStore, type LeftTab } from "@/stores/useEditorStore";
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
import { SidebarSectionSplitHandle } from "./SidebarSectionSplitHandle";
import { useResizablePanelWidth } from "./useResizablePanelWidth";
import { useLeftSidebarSplitHeight } from "./useLeftSidebarSplitHeight";

const LEFT_SIDEBAR_TABS: {
  id: LeftTab;
  hintLabel: string;
  icon: LucideIcon;
}[] = [
  { id: "layers", hintLabel: "Pages", icon: FileStack },
  { id: "components", hintLabel: "Components", icon: Component },
  { id: "assets", hintLabel: "Asset library", icon: Image },
  { id: "styles", hintLabel: "Library", icon: Library },
];

export function LeftSidebar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
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
  const [panelOpen, setPanelOpen] = useState(true);
  const [mitraOpen, setMitraOpen] = useState(true);
  const {
    containerRef: splitContainerRef,
    layersHeight,
    mitraPanelHeight,
    onResizeStart: onSplitResizeStart,
    onResize: onSplitResize,
    onResizeEnd: onSplitResizeEnd,
    reportMitraRequiredHeight,
    showSplitHandle,
  } = useLeftSidebarSplitHeight(panelOpen, mitraOpen, setMitraOpen);

  return (
    <aside
      data-left-sidebar
      className="editor-sidebar-shell absolute inset-y-0 left-0 z-30 flex h-full min-h-0 shrink-0 flex-col gap-2 overflow-hidden p-2"
      style={{ width, minWidth: LEFT_SIDEBAR_BOUNDS.min }}
    >
      <EditorSidebarBrandHeader sidebarVisible onToggleSidebar={onToggleSidebar} />

      <div
        ref={splitContainerRef}
        className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {/* Card 2 — tabs and panel content */}
        <div
          className={cn(
            "editor-sidebar-section flex flex-col overflow-hidden",
            mitraOpen ? "shrink-0" : "min-h-0 flex-1",
          )}
          style={mitraOpen && panelOpen ? { height: layersHeight } : undefined}
        >
        <div
          className={cn(
            "flex shrink-0 flex-col gap-2 px-2.5 py-2",
            panelOpen && "border-b border-app-panel-edge",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <div
              className="grid min-w-0 flex-1 grid-cols-4 gap-1 rounded-xl bg-app-inset p-1"
              role="tablist"
              aria-label="Left sidebar"
            >
              {LEFT_SIDEBAR_TABS.map(({ id, hintLabel, icon: Icon }) => (
                <EditorHintWrap key={id} hintLabel={hintLabel} hintSide="bottom">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={leftTab === id}
                    aria-label={hintLabel}
                    onClick={() => setLeftTab(id)}
                    className={cn(
                      "chrome-segmented-tab flex h-9 w-full items-center justify-center border border-transparent",
                      leftTab === id
                        ? "chrome-segmented-tab-active"
                        : "text-app-muted hover:text-app-fg",
                    )}
                  >
                    <Icon className="size-icon-ui shrink-0" strokeWidth={1.75} />
                  </button>
                </EditorHintWrap>
              ))}
            </div>
            <EditorHintWrap title={panelOpen ? "Collapse" : "Expand"}>
              <button
                type="button"
                aria-expanded={panelOpen}
                aria-label={panelOpen ? "Collapse sidebar panel" : "Expand sidebar panel"}
                onClick={() => setPanelOpen((v) => !v)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-app-subtle transition-colors hover:bg-app-hover hover:text-app-fg"
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    panelOpen ? "rotate-180" : "rotate-0",
                  )}
                  strokeWidth={2}
                />
              </button>
            </EditorHintWrap>
          </div>
        </div>

        {panelOpen ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {leftTab === "layers" && <LayersPanel hideHeader />}

            {leftTab === "components" && <ComponentsPanel embedded />}

            {leftTab === "assets" && <AssetsPanel />}

            {leftTab === "styles" && <StylesPanel />}
          </div>
        ) : null}
        </div>

        {showSplitHandle ? (
          <SidebarSectionSplitHandle
            onResizeStart={onSplitResizeStart}
            onResize={onSplitResize}
            onResizeEnd={onSplitResizeEnd}
          />
        ) : (
          <div className="h-2 shrink-0" aria-hidden />
        )}

        {/* Card 3 — Nova */}
        <EditorSidebarJulesPanel
          open={mitraOpen}
          className={cn(
            "min-h-0 shrink-0",
            mitraOpen && panelOpen && mitraPanelHeight != null && "flex-none",
          )}
          style={
            mitraOpen && panelOpen && mitraPanelHeight != null
              ? { height: mitraPanelHeight, overflow: "hidden" }
              : undefined
          }
          onRequiredHeightChange={reportMitraRequiredHeight}
          onOpenChange={setMitraOpen}
        />
      </div>

      <ResizablePanelEdge
        edge="right"
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
        className="pointer-events-auto hover:bg-accent/30"
      />
    </aside>
  );
}
