"use client";

import { PanelLeft } from "lucide-react";
import { LeftSidebar } from "./LeftSidebar";
import { EditorHintPolicyProvider, EditorHintWrap } from "./EditorHoverHint";
import { Canvas } from "./Canvas";
import { CanvasToolRail } from "./CanvasToolRail";
import { CanvasFloatingPageName } from "./CanvasFloatingPageName";
import { RightPropertiesPanel } from "./RightPropertiesPanel";
import { EditorRightActionsCard } from "./EditorRightActionsCard";
import { EditorKeyboardShortcuts } from "./EditorKeyboardShortcuts";
import { EditorContextMenu } from "./EditorContextMenu";

import { PrototypePreviewModal } from "./PrototypePreviewModal";
import { EditorDocumentPersistence } from "./EditorDocumentPersistence";
import { CommentsPanel } from "./CommentsPanel";
import { CommentPopover } from "./CommentPopover";
import { useEditorStore } from "@/stores/useEditorStore";
import { EditorMockPresence } from "./EditorMockPresence";
import { EditorRealtimeSync } from "./EditorRealtimeSync";
import { CommandMenu } from "./CommandMenu";
import { ShortcutOverlay } from "./ShortcutOverlay";
import { AIKeysProvider } from "@/components/ai/useAIKeys";
import { AIAddKeyModal, AIKeysManageModal } from "@/components/ai/AIKeysModals";
import { AIGenerateModal } from "@/components/ai/AIGenerateModal";
import { AIGenerateCanvasController } from "@/components/ai/AIGenerateCanvasController";
import { PluginMarketplace } from "@/components/plugins/PluginMarketplace";
import { PluginRunner } from "@/components/plugins/PluginRunner";
import { ShareModal } from "./ShareModal";
import { WorkspaceTeamModals } from "./WorkspaceTeamModals";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { CodeRoundTripModal } from "@/components/code/CodeRoundTripModal";
import { CraftBridgeImportListener } from "@/components/craftBridge/CraftBridgeImportListener";
import { CraftBridgeSourceWatcher } from "@/components/craftBridge/CraftBridgeSourceWatcher";
import { CraftBridgeConflictBanner } from "@/components/craftBridge/CraftBridgeConflictBanner";
import { CraftBridgeSyncToast } from "@/components/craftBridge/CraftBridgeSyncToast";
import { TextEditPortal } from "./TextEditPortal";
import { UiChromeHiddenHint } from "./UiChromeHiddenHint";
import { FigImportOverlay } from "@/components/import/FigImportOverlay";
import { FigImportFinishEffect } from "@/components/import/FigImportFinishEffect";
import { EditorAckToast } from "@/components/editor/EditorAckToast";
import { FigImportToast } from "@/components/import/FigImportToast";
import { ImportNoticeToast } from "@/components/editor/ImportNoticeToast";
import { ImportFigmaModal } from "@/components/import/ImportFigmaModal";
import { McpConnectionsModal } from "@/components/mcp/McpConnectionsModal";
import { ImportHub } from "@/components/import/ImportHub";
import { ImportWebModal } from "@/components/import/ImportWebModal";
import { DocumentHydrationOverlay } from "@/components/editor/DocumentHydrationOverlay";
import { EditorBootGuard } from "@/components/editor/EditorBootGuard";
import { useTheme } from "@/components/ThemeProvider";
import { displayCanvasBackground } from "@/lib/canvasVisual";
import { canAcceptFigFileDrop, figFileFromDataTransfer } from "@/lib/figImport";
import { activateCanvasForShortcuts, isEditableFieldElement, resetStaleEditorOverlays } from "@/lib/editorKeyboardFocus";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, Suspense, useState } from "react";
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
      className="absolute inset-0 z-0 overflow-visible"
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
    <div className="absolute inset-y-0 right-0 z-30 flex min-h-0 shrink-0">
      {commentsPanelOpen ? <CommentsPanel /> : null}
      <div
        className="editor-sidebar-shell relative flex h-full min-h-0 shrink-0 flex-col gap-2 overflow-hidden p-2"
        style={{ width, minWidth: bounds.min }}
      >
        <ResizablePanelEdge
          edge="left"
          onResizeStart={onResizeStart}
          onResize={onResize}
          onResizeEnd={onResizeEnd}
          className="pointer-events-auto hover:bg-accent/30"
        />
        <EditorRightActionsCard />
        <RightPropertiesPanel />
      </div>
    </div>
  );
}

function AppShellChrome() {
  const uiChromeVisible = useEditorStore((s) => s.uiChromeVisible);
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(true);

  return (
    <div className="relative min-h-0 flex-1 overflow-visible">
      <CanvasWorkspaceChrome />
      {!uiChromeVisible ? <UiChromeHiddenHint /> : null}
      {uiChromeVisible && leftSidebarVisible ? (
        <LeftSidebar onToggleSidebar={() => setLeftSidebarVisible(false)} />
      ) : null}
      {uiChromeVisible && !leftSidebarVisible ? (
        <EditorHintWrap title="Show sidebar" anchorClassName="contents">
          <button
            type="button"
            aria-label="Show sidebar"
            onClick={() => setLeftSidebarVisible(true)}
            className="editor-sidebar-section absolute left-2 top-2 z-40 flex h-9 w-9 items-center justify-center text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
          >
            <PanelLeft className="size-icon-ui" strokeWidth={1.75} />
          </button>
        </EditorHintWrap>
      ) : null}
      {uiChromeVisible ? <EditorChromeRightColumn /> : null}
      {uiChromeVisible ? (
        <CanvasFloatingPageName leftSidebarVisible={leftSidebarVisible} />
      ) : null}
    </div>
  );
}

export function AppShell() {
  useEffect(() => {
    resetStaleEditorOverlays();
    requestAnimationFrame(() => activateCanvasForShortcuts());
  }, []);

  return (
    <AIKeysProvider>
    <EditorHintPolicyProvider policy="shortcuts-only">
    <div
      data-editor-shell
      className={cn(
        "flex h-dvh flex-col overflow-hidden bg-transparent font-sans text-app-fg",
      )}
      onPointerDownCapture={(e) => {
        const target = e.target;
        if (target instanceof Element && target.closest("[data-canvas-floating-page-name]")) {
          return;
        }
        if (target instanceof Element && target.closest("[data-left-sidebar]")) {
          return;
        }
        if (!isEditableFieldElement(e.target)) {
          activateCanvasForShortcuts();
        }
      }}
    >
      <EditorMockPresence />
      <EditorRealtimeSync />
      <CraftBridgeSourceWatcher />
      <CraftBridgeConflictBanner />
      <CraftBridgeSyncToast />
      <Suspense fallback={null}>
        <CraftBridgeImportListener />
      </Suspense>
      <CommandMenu />
      <ShortcutOverlay />
      <AIGenerateModal />
      <AIGenerateCanvasController />
      <AIAddKeyModal />
      <AIKeysManageModal />
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
      <McpConnectionsModal />
      <ImportHub />
      <ImportWebModal />
      <FigImportOverlay />
      <FigImportFinishEffect />
      <FigImportToast />
      <EditorAckToast />
      <ImportNoticeToast />
      <PrototypePreviewModal />
      <EditorKeyboardShortcuts />
      <EditorContextMenu />
      <TextEditLayer />
      <AppShellChrome />
    </div>
    </EditorHintPolicyProvider>
    </AIKeysProvider>
  );
}
