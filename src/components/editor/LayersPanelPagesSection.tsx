"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, ChevronDown, Plus, Trash2 } from "lucide-react";
import { handlePanelFieldKeyDown } from "@/lib/panelFieldKeyboard";
import { ensurePageHasSubPages } from "@/lib/editorPages";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";
import { EditorHintWrap } from "./EditorHoverHint";

type PageContextMenu = { subPageId: string; x: number; y: number };

export function LayersPanelPagesSection({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const activePageId = useEditorStore((s) => s.activePageId);
  const pages = useEditorStore((s) => s.pages);
  const activeSubPageId = useEditorStore((s) => s.activeSubPageId);
  const setActiveSubPage = useEditorStore((s) => s.setActiveSubPage);
  const addSubPage = useEditorStore((s) => s.addSubPage);
  const duplicateSubPage = useEditorStore((s) => s.duplicateSubPage);
  const deleteSubPage = useEditorStore((s) => s.deleteSubPage);
  const renameSubPage = useEditorStore((s) => s.renameSubPage);

  const master = pages[activePageId];
  const { subPageOrder, subPages } = useMemo(() => {
    if (!master) return { subPageOrder: [] as string[], subPages: {} };
    const ensured = ensurePageHasSubPages(master);
    return {
      subPageOrder: ensured.subPageOrder ?? [],
      subPages: ensured.subPages ?? {},
    };
  }, [master]);

  const [renameSubPageId, setRenameSubPageId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [contextMenu, setContextMenu] = useState<PageContextMenu | null>(null);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!renameSubPageId) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [renameSubPageId]);

  useEffect(() => {
    if (!contextMenu) return;
    const closePointer = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setContextMenu(null);
    };
    const closeScroll = () => setContextMenu(null);
    window.addEventListener("pointerdown", closePointer, true);
    window.addEventListener("scroll", closeScroll, true);
    return () => {
      window.removeEventListener("pointerdown", closePointer, true);
      window.removeEventListener("scroll", closeScroll, true);
    };
  }, [contextMenu]);

  const startRename = useCallback(
    (subPageId: string) => {
      const sub = subPages[subPageId];
      if (!sub) return;
      setDraft(sub.name);
      setRenameSubPageId(subPageId);
    },
    [subPages],
  );

  const commitRename = useCallback(() => {
    const subPageId = renameSubPageId;
    if (!subPageId) return;
    setRenameSubPageId(null);
    const trimmed = draft.trim();
    const previousName = subPages[subPageId]?.name ?? "";
    if (!trimmed || trimmed === previousName) return;
    renameSubPage(subPageId, trimmed);
  }, [draft, renameSubPage, renameSubPageId, subPages]);

  if (!master || subPageOrder.length === 0) return null;

  const contextSubPage = contextMenu ? subPages[contextMenu.subPageId] : null;
  const canDeleteSubPage = subPageOrder.length > 1;

  const contextMenuPortal =
    contextMenu && contextSubPage && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        aria-label={`Sub-page actions: ${contextSubPage.name}`}
        data-editor-shell
        className="editor-floating-menu fixed z-[500] min-w-[168px] overflow-hidden border border-app-border bg-app-panel py-1 shadow-xl"
        style={{
          left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 176)),
          top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 140)),
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          role="menuitem"
          className="editor-menu-dropdown-item !justify-start gap-2.5"
          onClick={() => {
            startRename(contextMenu.subPageId);
            setContextMenu(null);
          }}
        >
          Rename
        </button>
        <button
          type="button"
          role="menuitem"
          className="editor-menu-dropdown-item !justify-start gap-2.5"
          onClick={() => {
            duplicateSubPage(contextMenu.subPageId);
            setContextMenu(null);
          }}
        >
          <Copy className="size-icon-ui shrink-0 text-app-muted" strokeWidth={1.75} />
          Duplicate
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!canDeleteSubPage}
          className={cn(
            "editor-menu-dropdown-item !justify-start gap-2.5",
            !canDeleteSubPage && "cursor-not-allowed opacity-40",
          )}
          onClick={() => {
            if (!canDeleteSubPage) return;
            deleteSubPage(contextMenu.subPageId);
            setContextMenu(null);
          }}
        >
          <Trash2 className="size-icon-ui shrink-0 text-app-muted" strokeWidth={1.75} />
          Delete
        </button>
      </div>
    ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-2 py-2">
      <div
        className={cn(
          "flex shrink-0 items-center justify-between px-1.5",
          open ? "mb-[12px]" : "mb-0",
        )}
      >
        <p className="section-heading">Pages</p>
        <div className="flex items-center gap-0.5">
          {open ? (
            <EditorHintWrap hintLabel="Add sub-page" hintSide="top">
              <button
                type="button"
                aria-label="Add sub-page"
                onClick={() => addSubPage()}
                className="flex h-6 w-6 items-center justify-center rounded-md text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </EditorHintWrap>
          ) : null}
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Collapse Pages" : "Expand Pages"}
            onClick={() => onOpenChange(!open)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-app-subtle transition-colors hover:bg-app-hover hover:text-app-fg"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                open ? "rotate-180" : "rotate-0",
              )}
              strokeWidth={2}
            />
          </button>
        </div>
      </div>

      {open ? (
      <div className="thin-scroll min-h-0 flex-1 space-y-[8px] overflow-y-auto">
        {subPageOrder.map((subPageId) => {
          const sub = subPages[subPageId];
          if (!sub) return null;
          const active = subPageId === activeSubPageId;
          const renaming = renameSubPageId === subPageId;

          if (renaming) {
            return (
              <div key={subPageId} className="px-1 py-0.5">
                <input
                  ref={inputRef}
                  value={draft}
                  data-page-name-editor
                  aria-label="Sub-page name"
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => window.requestAnimationFrame(() => commitRename())}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    handlePanelFieldKeyDown(e, {
                      onEnter: () => commitRename(),
                      onEscape: () => setRenameSubPageId(null),
                    });
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="block h-8 w-full rounded-lg border border-app-border-subtle bg-app-inset px-2 text-ui-sm text-app-fg outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
                />
              </div>
            );
          }

          return (
            <div
              key={subPageId}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ subPageId, x: e.clientX, y: e.clientY });
              }}
              className={cn(
                "flex h-8 items-center rounded-lg text-ui-sm transition-colors",
                active
                  ? "bg-[color:var(--pc-canvas-selection-muted)] text-app-fg"
                  : "text-app-fg hover:bg-app-hover",
              )}
            >
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (subPageId !== activeSubPageId) setActiveSubPage(subPageId);
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  startRename(subPageId);
                }}
                className="flex h-full w-full min-w-0 items-center px-2 text-left"
              >
                <span className="truncate">{sub.name}</span>
              </button>
            </div>
          );
        })}
      </div>
      ) : null}
      {contextMenuPortal ? createPortal(contextMenuPortal, document.body) : null}
    </div>
  );
}
