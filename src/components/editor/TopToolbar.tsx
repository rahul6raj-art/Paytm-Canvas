"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Code2,
  ChevronRight,
  CircleHelp,
  FileDown,
  FilePlus2,
  FileUp,
  History,
  Plug2,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import { DocumentTitleField } from "./DocumentTitleField";
import {
  useEditorStore,
  type DocumentSaveStatus,
} from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";
import { DEFAULT_MOCK_WORKSPACE, getActiveMockWorkspace, subscribeMockAuth } from "@/lib/mockAuth";
import { PaytmCraftApiModeBanner } from "@/components/PaytmCraftApiModeBanner";
import { isPaytmCraftHttpApiMode } from "@/lib/env";
import { EditorMenuBar } from "./EditorMenuBar";
import { EditorHintWrap } from "./EditorHoverHint";
import { editorCanRedoHistory, editorCanUndoHistory } from "@/engine/editorHistoryState";

function saveStatusLabel(status: DocumentSaveStatus): string {
  switch (status) {
    case "saving":
      return "Saving…";
    case "unsaved":
      return "Unsaved changes";
    case "saved-api":
      return "Saved to API";
    case "api-save-failed":
      return "API save failed";
    case "api-conflict":
      return "Server has a newer version — reload to continue";
    default:
      return "Saved";
  }
}

export function TopToolbar() {
  const documentSaveStatus = useEditorStore((s) => s.documentSaveStatus);
  const saveToLocal = useEditorStore((s) => s.saveToLocal);
  const reloadApiFileFromServer = useEditorStore((s) => s.reloadApiFileFromServer);
  const saveCurrentDocumentAsApiFile = useEditorStore((s) => s.saveCurrentDocumentAsApiFile);
  const isApiBackedFile = useEditorStore((s) => s.isApiBackedFile);
  const exportDocument = useEditorStore((s) => s.exportDocument);
  const importWorkspaceFile = useEditorStore((s) => s.importWorkspaceFile);
  const openImportFigmaModal = useEditorStore((s) => s.openImportFigmaModal);
  const resetDocument = useEditorStore((s) => s.resetDocument);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => editorCanUndoHistory(s));
  const canRedo = useEditorStore((s) => editorCanRedoHistory(s));
  const realtimeSyncStatus = useEditorStore((s) => s.realtimeSyncStatus);
  const openCodeRoundTrip = useEditorStore((s) => s.openCodeRoundTrip);
  const openVersionHistory = useEditorStore((s) => s.openVersionHistory);
  const openHelpDemoChecklist = useEditorStore((s) => s.openHelpDemoChecklist);

  const workspace = useSyncExternalStore(
    subscribeMockAuth,
    () => getActiveMockWorkspace(),
    () => DEFAULT_MOCK_WORKSPACE,
  );
  const isApiMode = isPaytmCraftHttpApiMode();
  const saveMenuLabel = !isApiMode ? "Save locally" : isApiBackedFile ? "Save to API" : "Save locally";

  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!fileMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!fileMenuRef.current) return;
      if (!fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [fileMenuOpen]);

  return (
    <header className="relative z-40 flex shrink-0 flex-col border-b border-app-border bg-chrome-raised shadow-app-raised">
      <EditorMenuBar />
      <div className="flex h-11 min-w-0 items-center gap-2 px-2">
      <div className="flex min-w-0 shrink items-center gap-2">
      <div className="flex shrink-0 items-center gap-0.5 border-r border-app-border pr-2">
        <EditorHintWrap hintLabel="Undo" hintShortcut="⌘Z" hintSide="bottom" disabled={!canUndo}>
          <button
            type="button"
            disabled={!canUndo}
            aria-label="Undo"
            onClick={() => undo()}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg",
              !canUndo && "cursor-not-allowed opacity-30 hover:bg-transparent hover:text-app-muted",
            )}
          >
            <Undo2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </EditorHintWrap>
        <EditorHintWrap hintLabel="Redo" hintShortcut="⇧⌘Z" hintSide="bottom" disabled={!canRedo}>
          <button
            type="button"
            disabled={!canRedo}
            aria-label="Redo"
            onClick={() => redo()}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg",
              !canRedo && "cursor-not-allowed opacity-30 hover:bg-transparent hover:text-app-muted",
            )}
          >
            <Redo2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </EditorHintWrap>
      </div>

      <div className="relative flex min-w-0 max-w-[min(36vw,320px)] items-center gap-1.5">
        <Link
          href="/"
          className="shrink-0 text-ui font-medium tracking-wide text-app-subtle transition-colors hover:text-app-fg"
        >
          Paytm Craft
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0 text-app-subtle" strokeWidth={2} />
        <EditorHintWrap title={workspace.name}>
          <span className="max-w-[120px] shrink-0 truncate text-ui font-medium text-app-subtle">
            {workspace.name}
          </span>
        </EditorHintWrap>
        <ChevronRight className="h-3 w-3 shrink-0 text-app-subtle" strokeWidth={2} />

        <div className="relative shrink-0" ref={fileMenuRef}>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
            aria-label="File menu"
            aria-expanded={fileMenuOpen}
            onClick={() => setFileMenuOpen((o) => !o)}
          >
            <FilePlus2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          {fileMenuOpen ? (
            <div
              role="menu"
              className="absolute left-0 top-full z-50 mt-1 min-w-[200px] editor-floating-menu border border-app-border bg-app-surface py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
                onClick={() => {
                  setFileMenuOpen(false);
                  resetDocument();
                }}
              >
                <FilePlus2 className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                New file
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
                onClick={() => {
                  setFileMenuOpen(false);
                  saveToLocal();
                }}
              >
                <Save className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                {saveMenuLabel}
              </button>
              {isApiMode && !isApiBackedFile ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
                  onClick={() => {
                    setFileMenuOpen(false);
                    void saveCurrentDocumentAsApiFile();
                  }}
                >
                  <Save className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                  Save as API file
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
                onClick={() => {
                  setFileMenuOpen(false);
                  exportDocument();
                }}
              >
                <FileDown className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                Export .paytmcraft.json
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
                onClick={() => {
                  setFileMenuOpen(false);
                  importInputRef.current?.click();
                }}
              >
                <FileUp className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                Import file…
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
                onClick={() => {
                  setFileMenuOpen(false);
                  openImportFigmaModal();
                }}
              >
                <Plug2 className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                Import from Figma…
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
                onClick={() => {
                  setFileMenuOpen(false);
                  openCodeRoundTrip("export");
                }}
              >
                <Code2 className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                Export React (Design ↔ Code)
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
                onClick={() => {
                  setFileMenuOpen(false);
                  openCodeRoundTrip("import");
                }}
              >
                <Code2 className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                Import React (Design ↔ Code)
              </button>
              <EditorHintWrap
                title={
                  !isApiMode || !isApiBackedFile
                    ? "API file required"
                    : "Browse and restore saved versions"
                }
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={!isApiMode || !isApiBackedFile}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui",
                    !isApiMode || !isApiBackedFile
                      ? "cursor-not-allowed text-app-subtle"
                      : "text-app-fg hover:bg-app-hover",
                  )}
                  onClick={() => {
                    if (!isApiMode || !isApiBackedFile) return;
                    setFileMenuOpen(false);
                    openVersionHistory();
                  }}
                >
                  <History className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                  Version history
                </button>
              </EditorHintWrap>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
                onClick={() => {
                  setFileMenuOpen(false);
                  openHelpDemoChecklist();
                }}
              >
                <CircleHelp className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                Help & demo checklist
              </button>
            </div>
          ) : null}
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept=".paytmcraft.json,.fig,application/json,.json,application/octet-stream"
          className="sr-only"
          data-editor-import-input
          aria-hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            await importWorkspaceFile(file);
          }}
        />

        <DocumentTitleField />

        <EditorHintWrap title={saveStatusLabel(documentSaveStatus)}>
          <span
            className={cn(
              "shrink-0 whitespace-nowrap text-ui font-medium tabular-nums",
              documentSaveStatus === "saving" && "text-amber-300/90",
              documentSaveStatus === "unsaved" && "text-amber-200/85",
              documentSaveStatus === "saved" && "text-app-subtle",
              documentSaveStatus === "saved-api" && "text-emerald-400/85",
              documentSaveStatus === "api-save-failed" && "text-red-400/90",
              documentSaveStatus === "api-conflict" && "text-orange-300/95",
            )}
          >
            {documentSaveStatus === "api-conflict" ? (
              <button
                type="button"
                className="underline decoration-orange-300/50 underline-offset-2 hover:text-orange-200"
                onClick={() => void reloadApiFileFromServer()}
              >
                {saveStatusLabel(documentSaveStatus)}
              </button>
            ) : (
              saveStatusLabel(documentSaveStatus)
            )}
          </span>
        </EditorHintWrap>
        <PaytmCraftApiModeBanner variant="dark" className="ml-1 hidden shrink-0 sm:flex" />
        {isApiMode ? (
          <EditorHintWrap
            title={
              isApiBackedFile
                ? "Edits save to the mock API file"
                : "Edits are kept in browser storage until you save as an API file"
            }
          >
            <span
              className={cn(
                "hidden shrink-0 rounded border px-1.5 py-0.5 text-ui font-medium sm:inline",
                isApiBackedFile
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200/95"
                  : "border-amber-500/35 bg-amber-500/12 text-amber-100/90",
              )}
            >
              {isApiBackedFile ? "API file" : "Local draft"}
            </span>
          </EditorHintWrap>
        ) : null}
        {isApiMode && realtimeSyncStatus === "connected" ? (
          <EditorHintWrap title="Yjs WebSocket sync is active for this file">
            <span className="hidden shrink-0 rounded border border-violet-500/35 bg-violet-500/12 px-1.5 py-0.5 text-ui font-medium text-violet-200/95 sm:inline">
              Live sync
            </span>
          </EditorHintWrap>
        ) : null}
      </div>
      </div>
      </div>
    </header>
  );
}
