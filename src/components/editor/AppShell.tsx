"use client";

import { TopToolbar } from "./TopToolbar";
import { PageTabsBar } from "./PageTabsBar";
import { LeftSidebar } from "./LeftSidebar";
import { Canvas } from "./Canvas";
import { CanvasToolRail } from "./CanvasToolRail";
import { RightPropertiesPanel } from "./RightPropertiesPanel";
import { ZoomControls } from "./ZoomControls";
import { CanvasDebugReadout } from "./CanvasDebugReadout";
import { EditorKeyboardShortcuts } from "./EditorKeyboardShortcuts";
import { EditorContextMenu } from "./EditorContextMenu";

import { PrototypePreviewModal } from "./PrototypePreviewModal";
import { EditorDocumentPersistence } from "./EditorDocumentPersistence";
import { CommentsPanel } from "./CommentsPanel";
import { CommentPopover } from "./CommentPopover";
import { useEditorStore } from "@/stores/useEditorStore";
import { EditorMockPresence } from "./EditorMockPresence";
import { EditorRealtimeSync } from "./EditorRealtimeSync";
import { PresenceActivityFeed } from "./PresenceActivityFeed";
import { CommandMenu } from "./CommandMenu";
import { ShortcutOverlay } from "./ShortcutOverlay";
import { AIGenerateModal } from "@/components/ai/AIGenerateModal";
import { PluginMarketplace } from "@/components/plugins/PluginMarketplace";
import { PluginRunner } from "@/components/plugins/PluginRunner";
import { ShareModal } from "./ShareModal";
import { WorkspaceTeamModals } from "./WorkspaceTeamModals";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { CodeRoundTripModal } from "@/components/code/CodeRoundTripModal";
import { TextEditPortal } from "./TextEditPortal";
import { UiChromeHiddenHint } from "./UiChromeHiddenHint";
import { FigImportOverlay } from "@/components/import/FigImportOverlay";
import { FigImportFinishEffect } from "@/components/import/FigImportFinishEffect";
import { FigImportToast } from "@/components/import/FigImportToast";
import { ImportNoticeToast } from "@/components/editor/ImportNoticeToast";
import { ImportFigmaModal } from "@/components/import/ImportFigmaModal";
import { ImportHub } from "@/components/import/ImportHub";
import { ImportWebModal } from "@/components/import/ImportWebModal";
import { DocumentHydrationOverlay } from "@/components/editor/DocumentHydrationOverlay";
import { EditorBootGuard } from "@/components/editor/EditorBootGuard";
import { useTheme } from "@/components/ThemeProvider";
import { displayCanvasBackground } from "@/lib/canvasVisual";
import { canAcceptFigFileDrop, figFileFromDataTransfer } from "@/lib/figImport";
import { activateCanvasForShortcuts, isEditableFieldElement, resetStaleEditorOverlays } from "@/lib/editorKeyboardFocus";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo } from "react";
import {
  RIGHT_CODE_PANEL_BOUNDS,
  RIGHT_PANEL_BOUNDS,
  readLeftSidebarWidth,
  readRightPanelWidth,
  writeRightPanelWidth,
  type PanelLayoutContext,
} from "@/lib/sidebarPanelWidths";
import { ResizablePanelEdge } from "./ResizablePanelEdge";
import { useResizablePanelWidth } from "./useResizablePanelWidth";

function TextEditLayer() {
  const editingTextId = useEditorStore((s) => s.editingTextId);
  if (!editingTextId) return null;
  return <TextEditPortal nodeId={editingTextId} />;
}

function CanvasWorkspaceChrome() {
  const storedCanvasBg = useEditorStore((s) => s.canvasBackgroundColor);
  const figImportBusy = useEditorStore((s) => s.figImportInProgress);
  const importWorkspaceFile = useEditorStore((s) => s.importWorkspaceFile);
  const { resolved } = useTheme();
  const canvasBackgroundColor = useMemo(
    () => displayCanvasBackground(storedCanvasBg, resolved),
    [storedCanvasBg, resolved],
  );

  const onWorkspaceDragOverCapture = useCallback(
    (e: React.DragEvent) => {
      if (figImportBusy) return;
      if (!canAcceptFigFileDrop(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
    },
    [figImportBusy],
  );

  const onWorkspaceDropCapture = useCallback(
    async (e: React.DragEvent) => {
      if (figImportBusy) return;
      const figFile = figFileFromDataTransfer(e.dataTransfer);
      if (!figFile) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        await importWorkspaceFile(figFile);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not import that Figma file.");
      }
    },
    [figImportBusy, importWorkspaceFile],
  );

  return (
    <div
      className="relative min-h-0 min-w-0 flex-1 overflow-visible"
      data-canvas-workspace
      onDragOverCapture={onWorkspaceDragOverCapture}
      onDropCapture={onWorkspaceDropCapture}
    >
      <main
        className="absolute inset-0 min-h-0 overflow-visible"
        style={{ backgroundColor: canvasBackgroundColor }}
      >
        <Canvas />
      </main>
      <CanvasToolRail />
      <CommentPopover />
    </div>
  );
}

function EditorChromeRightColumn() {
  const commentsPanelOpen = useEditorStore((s) => s.commentsPanelOpen);
  const rightPanelTab = useEditorStore((s) => s.rightPanelTab);
  const codeTab = rightPanelTab === "code";
  const bounds = codeTab ? RIGHT_CODE_PANEL_BOUNDS : RIGHT_PANEL_BOUNDS;

  const panelLayout = useMemo<PanelLayoutContext>(
    () => ({
      getViewportWidth: () => window.innerWidth,
      getReservedChromeWidth: () => readLeftSidebarWidth(),
    }),
    [],
  );

  const readWidth = useCallback(() => readRightPanelWidth(codeTab, panelLayout), [codeTab, panelLayout]);
  const writeWidth = useCallback(
    (w: number) => writeRightPanelWidth(w, codeTab, panelLayout),
    [codeTab, panelLayout],
  );
  const { width, onResizeStart, onResize, onResizeEnd } = useResizablePanelWidth(
    bounds,
    readWidth,
    writeWidth,
    panelLayout,
  );

  return (
    <div className="flex min-h-0 shrink-0">
      {commentsPanelOpen ? <CommentsPanel /> : null}
      <div
        className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden"
        style={{ width, minWidth: bounds.min }}
      >
        <ResizablePanelEdge
          edge="left"
          onResizeStart={onResizeStart}
          onResize={onResize}
          onResizeEnd={onResizeEnd}
          className="hover:bg-accent/30"
        />
        <RightPropertiesPanel />
      </div>
    </div>
  );
}

function AppShellChrome() {
  const uiChromeVisible = useEditorStore((s) => s.uiChromeVisible);

  return (
    <>
      {uiChromeVisible ? <TopToolbar /> : null}
      <div className="relative flex min-h-0 flex-1 overflow-visible">
        {!uiChromeVisible ? <UiChromeHiddenHint /> : null}
        {uiChromeVisible ? <LeftSidebar /> : null}
        <CanvasWorkspaceChrome />
        {uiChromeVisible ? <EditorChromeRightColumn /> : null}
      </div>
      {uiChromeVisible ? (
        <footer className="flex h-10 shrink-0 items-stretch border-t border-app-border bg-chrome-raised text-ui text-app-subtle shadow-app-raised">
          <PageTabsBar />
          <div className="flex shrink-0 items-center gap-3 border-l border-app-border px-3">
            <ZoomControls />
            <CanvasDebugReadout />
            <PresenceActivityFeed />
            <div className="flex shrink-0 items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Ready</span>
            </div>
          </div>
        </footer>
      ) : null}
    </>
  );
}

export function AppShell() {
  useEffect(() => {
    resetStaleEditorOverlays();
    requestAnimationFrame(() => activateCanvasForShortcuts());
  }, []);

  return (
    <div
      className={cn(
        "flex h-dvh flex-col overflow-hidden bg-chrome font-sans text-app-fg",
      )}
      onPointerDownCapture={(e) => {
        if (!isEditableFieldElement(e.target)) {
          activateCanvasForShortcuts();
        }
      }}
    >
      <EditorMockPresence />
      <EditorRealtimeSync />
      <CommandMenu />
      <ShortcutOverlay />
      <AIGenerateModal />
      <CodeRoundTripModal />
      <PluginMarketplace />
      <ShareModal />
      <WorkspaceTeamModals />
      <VersionHistoryPanel />
      <PluginRunner />
      <EditorBootGuard />
      <EditorDocumentPersistence />
      <DocumentHydrationOverlay />
      <ImportFigmaModal
        onImportFigFile={(file) => useEditorStore.getState().importFigmaFile(file)}
      />
      <ImportHub />
      <ImportWebModal />
      <FigImportOverlay />
      <FigImportFinishEffect />
      <FigImportToast />
      <ImportNoticeToast />
      <PrototypePreviewModal />
      <EditorKeyboardShortcuts />
      <EditorContextMenu />
      <TextEditLayer />
      <AppShellChrome />
    </div>
  );
}
