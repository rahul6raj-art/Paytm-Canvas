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
import { TextEditPortal } from "./TextEditPortal";
import { UiChromeHiddenHint } from "./UiChromeHiddenHint";
import { cn } from "@/lib/utils";

function TextEditLayer() {
  const editingTextId = useEditorStore((s) => s.editingTextId);
  if (!editingTextId) return null;
  return <TextEditPortal nodeId={editingTextId} />;
}

function CanvasWorkspaceChrome() {
  const canvasBackgroundColor = useEditorStore((s) => s.canvasBackgroundColor);
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
  return (
    <div className="flex min-h-0 shrink-0">
      {commentsPanelOpen ? <CommentsPanel /> : null}
      <div className="flex min-h-0 w-[min(260px,32vw)] min-w-[200px] max-w-[280px] shrink-0 flex-col">
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
        <footer className="flex h-9 shrink-0 items-stretch border-t border-black/25 bg-chrome-raised text-[11px] text-[#8c8c8c] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <PageTabsBar />
          <div className="flex shrink-0 items-center gap-3 border-l border-white/[0.08] px-3">
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
        "flex h-dvh flex-col overflow-hidden bg-chrome font-sans text-[#e6e6e6]",
      )}
    >
      <EditorMockPresence />
      <CommandMenu />
      <ShortcutOverlay />
      <AIGenerateModal />
      <PluginMarketplace />
      <ShareModal />
      <WorkspaceTeamModals />
      <VersionHistoryPanel />
      <PluginRunner />
      <EditorDocumentPersistence />
      <PrototypePreviewModal />
      <EditorKeyboardShortcuts />
      <EditorContextMenu />
      <TextEditLayer />
      <AppShellChrome />
    </div>
  );
}
