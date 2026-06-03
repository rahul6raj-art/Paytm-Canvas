"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Code2,
  Component,
  ChevronRight,
  CircleHelp,
  FileDown,
  FilePlus2,
  FileUp,
  Hand,
  History,
  ImagePlus,
  MessageSquare,
  MousePointer2,
  PanelRight,
  Pen,
  Play,
  Plug2,
  Redo2,
  Save,
  Search,
  Share2,
  Sparkles,
  Type,
  Undo2,
  Users,
  LogOut,
} from "lucide-react";
import { ToolButton } from "./ToolButton";
import { ShapeToolDropdown } from "./ShapeToolDropdown";
import { FrameToolDropdown } from "./FrameToolDropdown";
import { AlignToolbarDropdown } from "./AlignToolbarDropdown";
import { BooleanToolbarDropdown } from "./BooleanToolbarDropdown";
import { TextTypographyBar } from "./TextTypographyBar";
import { DocumentTitleField } from "./DocumentTitleField";
import { AvatarStack } from "./AvatarStack";
import { Button } from "@/components/ui/button";
import {
  useEditorStore,
  type Tool,
  type EditorMode,
  type DocumentSaveStatus,
} from "@/stores/useEditorStore";
import { formatShortcutLabel } from "@/lib/commands";
import { canCreateComponentFromSelection } from "@/lib/componentModel";
import { cn } from "@/lib/utils";
import { DEFAULT_MOCK_WORKSPACE, getActiveMockWorkspace, getMockCurrentUser, subscribeMockAuth } from "@/lib/mockAuth";
import { PaytmCraftApiModeBanner } from "@/components/PaytmCraftApiModeBanner";
import { isPaytmCraftApiMode } from "@/lib/env";
import { EditorMenuBar } from "./EditorMenuBar";
import { ThemeToggle } from "@/components/ThemeToggle";

const tools: { id: Tool; icon: typeof MousePointer2; label: string; shortcut?: string }[] = [
  { id: "move", icon: MousePointer2, label: "Move", shortcut: "V" },
  { id: "pen", icon: Pen, label: "Pen", shortcut: "P" },
  { id: "text", icon: Type, label: "Text", shortcut: "T" },
  { id: "comment", icon: MessageSquare, label: "Comment" },
  { id: "hand", icon: Hand, label: "Hand", shortcut: "H" },
];

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
    default:
      return "Saved";
  }
}

export function TopToolbar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const editorMode = useEditorStore((s) => s.editorMode);
  const setEditorMode = useEditorStore((s) => s.setEditorMode);
  const openPrototypePreview = useEditorStore((s) => s.openPrototypePreview);
  const documentSaveStatus = useEditorStore((s) => s.documentSaveStatus);
  const saveToLocal = useEditorStore((s) => s.saveToLocal);
  const saveCurrentDocumentAsApiFile = useEditorStore((s) => s.saveCurrentDocumentAsApiFile);
  const isApiBackedFile = useEditorStore((s) => s.isApiBackedFile);
  const apiCommentsStatus = useEditorStore((s) => s.apiCommentsStatus);
  const exportDocument = useEditorStore((s) => s.exportDocument);
  const importWorkspaceFile = useEditorStore((s) => s.importWorkspaceFile);
  const openImportFigmaModal = useEditorStore((s) => s.openImportFigmaModal);
  const resetDocument = useEditorStore((s) => s.resetDocument);
  const importImageAsset = useEditorStore((s) => s.importImageAsset);
  const addImageNodeAt = useEditorStore((s) => s.addImageNodeAt);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.historyPast.length > 0);
  const canRedo = useEditorStore((s) => s.historyFuture.length > 0);
  const commentsPanelOpen = useEditorStore((s) => s.commentsPanelOpen);
  const toggleCommentsPanel = useEditorStore((s) => s.toggleCommentsPanel);
  const startPlacingComment = useEditorStore((s) => s.startPlacingComment);
  const showPresence = useEditorStore((s) => s.showPresence);
  const presenceUsers = useEditorStore((s) => s.presenceUsers);
  const togglePresence = useEditorStore((s) => s.togglePresence);
  const setCommandMenuOpen = useEditorStore((s) => s.setCommandMenuOpen);
  const openAIModal = useEditorStore((s) => s.openAIModal);
  const openCodeRoundTrip = useEditorStore((s) => s.openCodeRoundTrip);
  const openPluginMarketplace = useEditorStore((s) => s.openPluginMarketplace);
  const openShareModal = useEditorStore((s) => s.openShareModal);
  const openVersionHistory = useEditorStore((s) => s.openVersionHistory);
  const openHelpDemoChecklist = useEditorStore((s) => s.openHelpDemoChecklist);
  const createComponentFromSelection = useEditorStore((s) => s.createComponentFromSelection);
  const setLeftTab = useEditorStore((s) => s.setLeftTab);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);

  const workspace = useSyncExternalStore(
    subscribeMockAuth,
    () => getActiveMockWorkspace(),
    () => DEFAULT_MOCK_WORKSPACE,
  );
  const currentUser = getMockCurrentUser();

  const isApiMode = isPaytmCraftApiMode();
  const saveMenuLabel = !isApiMode ? "Save locally" : isApiBackedFile ? "Save to API" : "Save locally";

  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const imageImportInputRef = useRef<HTMLInputElement>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [accountMenuOpen]);

  const modes: { id: EditorMode; label: string }[] = [
    { id: "design", label: "Design" },
    { id: "prototype", label: "Prototype" },
    { id: "inspect", label: "Inspect" },
  ];

  return (
    <header className="relative z-30 flex shrink-0 flex-col border-b border-app-border bg-chrome-raised shadow-app-raised">
      <EditorMenuBar />
      <div className="flex h-10 min-w-0 items-center gap-2 px-2">
      <div className="flex min-w-0 shrink items-center gap-2">
      <div className="flex shrink-0 items-center gap-0.5 border-r border-app-border pr-2">
        <button
          type="button"
          disabled={!canUndo}
          title="Undo (⌘Z or Ctrl+Z)"
          aria-label="Undo"
          onClick={() => undo()}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg",
            !canUndo && "cursor-not-allowed opacity-30 hover:bg-transparent hover:text-app-muted",
          )}
        >
          <Undo2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          disabled={!canRedo}
          title="Redo (⌘⇧Z / Ctrl+Y or Ctrl+Shift+Z)"
          aria-label="Redo"
          onClick={() => redo()}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg",
            !canRedo && "cursor-not-allowed opacity-30 hover:bg-transparent hover:text-app-muted",
          )}
        >
          <Redo2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      <div className="relative flex min-w-0 max-w-[min(36vw,320px)] items-center gap-1.5">
        <Link
          href="/"
          className="shrink-0 text-[11px] font-medium tracking-wide text-app-subtle transition-colors hover:text-app-fg"
        >
          Paytm Craft
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0 text-app-subtle" strokeWidth={2} />
        <span className="max-w-[120px] shrink-0 truncate text-[11px] font-medium text-app-subtle" title={workspace.name}>
          {workspace.name}
        </span>
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
              className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border border-app-border bg-app-surface py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-app-fg hover:bg-app-hover"
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
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-app-fg hover:bg-app-hover"
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
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-app-fg hover:bg-app-hover"
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
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-app-fg hover:bg-app-hover"
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
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-app-fg hover:bg-app-hover"
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
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-app-fg hover:bg-app-hover"
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
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-app-fg hover:bg-app-hover"
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
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-app-fg hover:bg-app-hover"
                onClick={() => {
                  setFileMenuOpen(false);
                  openCodeRoundTrip("import");
                }}
              >
                <Code2 className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                Import React (Design ↔ Code)
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!isApiMode || !isApiBackedFile}
                title={!isApiMode || !isApiBackedFile ? "API file required" : "Browse and restore saved versions"}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px]",
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
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-app-fg hover:bg-app-hover"
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

        <span
          className={cn(
            "shrink-0 whitespace-nowrap text-[10px] font-medium tabular-nums",
            documentSaveStatus === "saving" && "text-amber-300/90",
            documentSaveStatus === "unsaved" && "text-amber-200/85",
            documentSaveStatus === "saved" && "text-app-subtle",
            documentSaveStatus === "saved-api" && "text-emerald-400/85",
            documentSaveStatus === "api-save-failed" && "text-red-400/90",
          )}
          title={saveStatusLabel(documentSaveStatus)}
        >
          {saveStatusLabel(documentSaveStatus)}
        </span>
        <PaytmCraftApiModeBanner variant="dark" className="ml-1 hidden shrink-0 sm:flex" />
        {isApiMode ? (
          <span
            className={cn(
              "hidden shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:inline",
              isApiBackedFile
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200/95"
                : "border-amber-500/35 bg-amber-500/12 text-amber-100/90",
            )}
            title={isApiBackedFile ? "Edits save to the mock API file" : "Edits are kept in browser storage until you save as an API file"}
          >
            {isApiBackedFile ? "API file" : "Local draft"}
          </span>
        ) : null}
      </div>
      </div>

      <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
        <button
          type="button"
          onClick={() => setCommandMenuOpen(true)}
          title="Search commands"
          className="flex h-7 w-full max-w-[280px] items-center gap-1.5 rounded-md border border-app-border bg-app-toolbar-well px-2 text-[11px] font-medium text-app-muted transition-colors hover:border-app-border hover:bg-app-hover hover:text-app-fg"
        >
          <Search className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} />
          <span className="min-w-0 truncate">Search commands</span>
          <span className="hidden shrink-0 text-[10px] tabular-nums text-app-subtle lg:inline">{formatShortcutLabel("⌘K")}</span>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-l border-app-border pl-2">
        <Button
          variant="toolbar"
          type="button"
          className="h-7 gap-1 border border-app-border-subtle px-2 text-[11px] font-medium shadow-none md:px-2.5"
          title="Present prototype"
          onClick={() => openPrototypePreview()}
        >
          <Play className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="hidden md:inline">Present</span>
        </Button>
        <Button variant="primary" className="h-7 gap-1 px-2.5 text-[11px] font-semibold shadow-sm md:px-3" onClick={() => openShareModal()}>
          <Share2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="hidden sm:inline">Share</span>
        </Button>
        <ThemeToggle size="sm" />
        <div className="relative shrink-0" ref={accountMenuRef}>
          <button
            type="button"
            title="Account"
            aria-label="Account menu"
            aria-expanded={accountMenuOpen}
            onClick={() => setAccountMenuOpen((o) => !o)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-toolbar-well text-[10px] font-bold text-white shadow-inner transition-colors hover:border-white/[0.2] hover:bg-app-hover"
            style={{
              boxShadow: `inset 0 0 0 1px hsl(${currentUser.avatarHue} 65% 42% / 0.35)`,
            }}
          >
            {currentUser.initials}
          </button>
          {accountMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-app-border bg-app-surface py-1 shadow-lg"
            >
              <div className="border-b border-app-border-subtle px-3 py-2">
                <p className="truncate text-[12px] font-semibold text-app-fg">{currentUser.name}</p>
                <p className="truncate text-[11px] text-app-subtle">{currentUser.email}</p>
                <p className="mt-1 text-[10px] text-app-subtle">{workspace.name}</p>
              </div>
              <Link
                href="/"
                role="menuitem"
                className="block px-3 py-1.5 text-[11px] text-app-fg hover:bg-app-hover"
                onClick={() => setAccountMenuOpen(false)}
              >
                Back to dashboard
              </Link>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-app-fg hover:bg-app-hover"
                onClick={() => {
                  setAccountMenuOpen(false);
                  window.alert("Sign out is a mock action — no session exists.");
                }}
              >
                <LogOut className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                Sign out (mock)
              </button>
            </div>
          ) : null}
        </div>
        <div className="hidden items-center gap-1 border-l border-app-border pl-1.5 sm:flex">
          <Button
            variant="toolbar"
            type="button"
            className="h-7 gap-1 border border-app-border bg-app-toolbar-well px-2 text-[11px] font-medium text-app-fg shadow-none hover:bg-app-hover xl:px-2.5"
            title="Help and demo checklist"
            aria-label="Help"
            onClick={() => openHelpDemoChecklist()}
          >
            <CircleHelp className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="hidden xl:inline">Help</span>
          </Button>
          <Button
            variant="toolbar"
            type="button"
            className="h-7 gap-1 border border-violet-500/25 bg-violet-500/10 px-2 text-[11px] font-medium text-violet-100 shadow-none hover:bg-violet-500/20 xl:px-2.5"
            title="Generate design with AI (mock)"
            onClick={() => openAIModal("editor")}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="hidden xl:inline">AI</span>
          </Button>
          <Button
            variant="toolbar"
            type="button"
            className="hidden h-7 gap-1 border border-app-border bg-app-toolbar-well px-2 text-[11px] font-medium text-app-fg shadow-none hover:bg-app-hover lg:flex xl:px-2.5"
            title="Plugins marketplace"
            onClick={() => openPluginMarketplace()}
          >
            <Plug2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="hidden xl:inline">Plugins</span>
          </Button>
          <button
            type="button"
            title={showPresence ? "Turn mock presence off" : "Turn mock presence on (simulated collaborators)"}
            onClick={() => togglePresence()}
            className={cn(
              "hidden h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors lg:flex",
              showPresence
                ? "border-[rgba(13,153,255,0.35)] bg-[rgba(13,153,255,0.12)] text-white"
                : "border-app-border bg-app-toolbar-well text-app-muted hover:bg-app-hover hover:text-app-fg",
            )}
          >
            <Users className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="hidden xl:inline">Presence</span>
          </button>
          {showPresence ? (
            <span className="hidden whitespace-nowrap text-[10px] tabular-nums text-app-subtle xl:inline">
              {presenceUsers.length > 0 ? `${presenceUsers.length} online` : "Live"}
            </span>
          ) : null}
          <span className="hidden lg:block">
            <AvatarStack />
          </span>
        </div>
      </div>
      </div>

      {editorMode === "design" ? <TextTypographyBar /> : null}

      <div className="flex h-9 min-w-0 items-center justify-center gap-2 border-t border-app-border-subtle px-2">
        <div
          className="flex shrink-0 items-center gap-px rounded-lg border border-app-border-subtle bg-app-toolbar-well p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          role="tablist"
          aria-label="Editor mode"
        >
          {modes.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={editorMode === id}
              onClick={() => setEditorMode(id)}
              className={cn(
                "rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition-colors",
                editorMode === id
                  ? "bg-[rgba(13,153,255,0.22)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "text-app-muted hover:bg-app-hover hover:text-app-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 max-w-full items-center gap-px overflow-x-auto rounded-lg border border-app-border-subtle bg-app-toolbar-well p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] thin-scroll">
          {tools.slice(0, 1).map(({ id, icon: Icon, label, shortcut }) => (
            <ToolButton
              key={id}
              active={tool === id}
              aria-label={label}
              title={shortcut ? `${label} (${shortcut})` : label}
              onClick={() => setTool(id)}
            >
              <Icon className="h-[15px] w-[15px]" strokeWidth={1.85} />
            </ToolButton>
          ))}
          <FrameToolDropdown />
          <ShapeToolDropdown />
          <AlignToolbarDropdown />
          <BooleanToolbarDropdown />
          <ToolButton
            active={false}
            aria-label="Create component"
            title={`Create component (${formatShortcutLabel("⌘⌥K")})`}
            disabled={!canCreateComponentFromSelection(selectedIds, nodes)}
            onClick={() => {
              createComponentFromSelection();
              setLeftTab("components");
            }}
          >
            <Component className="h-[15px] w-[15px]" strokeWidth={1.85} />
          </ToolButton>
          <input
            ref={imageImportInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            aria-hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const aid = await importImageAsset(file);
              if (!aid) return;
              addImageNodeAt(aid);
            }}
          />
          <ToolButton
            active={false}
            aria-label="Import image"
            title="Import image"
            onClick={() => imageImportInputRef.current?.click()}
          >
            <ImagePlus className="h-[15px] w-[15px]" strokeWidth={1.85} />
          </ToolButton>
          {tools.slice(1).map(({ id, icon: Icon, label, shortcut }) => (
            <ToolButton
              key={id}
              active={tool === id}
              aria-label={label}
              title={shortcut ? `${label} (${shortcut})` : label}
              disabled={id === "comment" && editorMode !== "design"}
              onClick={() => (id === "comment" ? startPlacingComment() : setTool(id))}
            >
              <Icon className="h-[15px] w-[15px]" strokeWidth={1.85} />
            </ToolButton>
          ))}
          <ToolButton
            active={commentsPanelOpen}
            aria-label="Comments panel"
            title="Comments panel"
            onClick={() => toggleCommentsPanel()}
          >
            <PanelRight className="h-[15px] w-[15px]" strokeWidth={1.85} />
          </ToolButton>
          {isApiMode && isApiBackedFile && apiCommentsStatus === "synced" ? (
            <span
              className="hidden max-w-[140px] shrink-0 truncate px-1 text-[9px] font-medium leading-tight text-emerald-300/90 lg:inline"
              title="Thread comments are stored on the mock API for this file"
            >
              Comments synced to API
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
