"use client";

import { TopToolbar } from "./TopToolbar";
import { PageTabsBar } from "./PageTabsBar";
import { LeftSidebar } from "./LeftSidebar";
import { Canvas } from "./Canvas";
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
import { ImportFigmaModal } from "@/components/import/ImportFigmaModal";
import { DocumentHydrationOverlay } from "@/components/editor/DocumentHydrationOverlay";
import { EditorBootGuard } from "@/components/editor/EditorBootGuard";
import { useTheme } from "@/components/ThemeProvider";
import { displayCanvasBackground } from "@/lib/canvasVisual";
import { activateCanvasForShortcuts, isEditableFieldElement } from "@/lib/editorKeyboardFocus";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

function TextEditLayer() {
  const editingTextId = useEditorStore((s) => s.editingTextId);
  if (!editingTextId) return null;
  return <TextEditPortal nodeId={editingTextId} />;
}

function CanvasWorkspaceChrome() {
  const storedCanvasBg = useEditorStore((s) => s.canvasBackgroundColor);
  const { resolved } = useTheme();
  const canvasBackgroundColor = useMemo(
    () => displayCanvasBackground(storedCanvasBg, resolved),
    [storedCanvasBg, resolved],
  );
  return (
    <main
      className="relative min-h-0 min-w-0 flex-1"
      style={{ backgroundColor: canvasBackgroundColor }}
    >
      <Canvas />
      <CommentPopover />
    </main>
  );
}

function EditorChromeRightColumn() {
  const commentsPanelOpen = useEditorStore((s) => s.commentsPanelOpen);
  const rightPanelTab = useEditorStore((s) => s.rightPanelTab);
  return (
    <div className="flex min-h-0 shrink-0">
      {commentsPanelOpen ? <CommentsPanel /> : null}
      <div
        className={cn(
          "flex min-h-0 shrink-0 flex-col",
          rightPanelTab === "code"
            ? "w-[min(360px,42vw)] min-w-[280px] max-w-[420px]"
            : "w-[min(260px,32vw)] min-w-[200px] max-w-[280px]",
        )}
      >
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
      <div className="relative flex min-h-0 flex-1">
        {!uiChromeVisible ? <UiChromeHiddenHint /> : null}
        {uiChromeVisible ? <LeftSidebar /> : null}
        <CanvasWorkspaceChrome />
        {uiChromeVisible ? <EditorChromeRightColumn /> : null}
      </div>
      {uiChromeVisible ? (
        <footer className="flex h-9 shrink-0 items-stretch border-t border-app-border bg-chrome-raised text-[11px] text-app-subtle shadow-app-raised">
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
      <FigImportOverlay />
      <FigImportFinishEffect />
      <FigImportToast />
      <PrototypePreviewModal />
      <EditorKeyboardShortcuts />
      <EditorContextMenu />
      <TextEditLayer />
      <AppShellChrome />
    </div>
  );
}
