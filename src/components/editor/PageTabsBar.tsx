"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Plus, X } from "lucide-react";
import { handlePanelFieldKeyDown } from "@/lib/panelFieldKeyboard";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";
import { EditorHintWrap } from "./EditorHoverHint";

export function PageTabsBar() {
  const router = useRouter();
  const pageOrder = useEditorStore((s) => s.pageOrder);
  const pages = useEditorStore((s) => s.pages);
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const addPage = useEditorStore((s) => s.addPage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);
  const closePage = useEditorStore((s) => s.closePage);
  const renamePage = useEditorStore((s) => s.renamePage);
  const cycleActivePage = useEditorStore((s) => s.cycleActivePage);

  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [renameId, setRenameId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [contextPageId, setContextPageId] = useState<string | null>(null);
  const [contextAnchor, setContextAnchor] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renameId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renameId]);

  useEffect(() => {
    const el = tabRefs.current.get(activePageId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activePageId, pageOrder.length]);

  useEffect(() => {
    if (!contextPageId) return;
    const close = () => setContextPageId(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextPageId]);

  const commitRename = useCallback(() => {
    if (!renameId) return;
    const trimmed = draftName.trim();
    if (trimmed) renamePage(renameId, trimmed);
    setRenameId(null);
  }, [renameId, draftName, renamePage]);

  const onTabsWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    scrollRef.current.scrollLeft += e.deltaY;
  };

  const scrollTabs = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });
  };

  return (
    <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
      <EditorHintWrap title="Previous page (⌘⌥↑)">
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => cycleActivePage(-1)}
          className="flex h-full w-6 shrink-0 items-center justify-center text-app-subtle transition-colors hover:bg-app-hover hover:text-app-fg"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </EditorHintWrap>

      <div
        ref={scrollRef}
        className="thin-scroll flex min-w-0 flex-1 items-stretch gap-px overflow-x-auto"
        onWheel={onTabsWheel}
        role="tablist"
        aria-label="Pages"
      >
        {pageOrder.map((pageId) => {
          const page = pages[pageId];
          if (!page) return null;
          const active = pageId === activePageId;
          const renaming = renameId === pageId;

          return (
            <div
              key={pageId}
              className={cn(
                "group relative flex h-full shrink-0 items-stretch border-r border-app-border-subtle",
                active ? "bg-app-inset" : "bg-app-panel hover:bg-app-hover",
              )}
            >
              {renaming ? (
                <input
                  ref={renameInputRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    handlePanelFieldKeyDown(e, {
                      onEnter: () => commitRename(),
                      onEscape: () => setRenameId(null),
                    });
                  }}
                  className="h-full w-[min(140px,28vw)] min-w-[72px] border-0 bg-app-field px-2.5 text-ui font-medium text-white outline-none ring-1 ring-inset ring-accent"
                />
              ) : (
                <EditorHintWrap title={page.name} hintSide="bottom">
                  <button
                    ref={(el) => {
                      if (el) tabRefs.current.set(pageId, el);
                      else tabRefs.current.delete(pageId);
                    }}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActivePage(pageId)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    setRenameId(pageId);
                    setDraftName(page.name);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const tab = tabRefs.current.get(pageId);
                    const rect = tab?.getBoundingClientRect();
                    setContextPageId(pageId);
                    setContextAnchor({
                      left: rect?.left ?? e.clientX,
                      top: rect?.top ?? e.clientY,
                    });
                  }}
                  className={cn(
                    "flex h-full max-w-[180px] items-center px-2.5 text-ui font-medium transition-colors",
                    active ? "text-white" : "text-[#a3a3a3] group-hover:text-app-fg",
                  )}
                >
                  <span className="truncate">{page.name}</span>
                </button>
                </EditorHintWrap>
              )}
            </div>
          );
        })}
      </div>

      <EditorHintWrap title="Add page">
        <button
          type="button"
          aria-label="Add page"
          onClick={() => addPage()}
          className="flex h-full shrink-0 items-center gap-1 border-l border-app-border-subtle px-2 text-ui font-medium text-app-subtle transition-colors hover:bg-app-hover hover:text-app-fg"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </EditorHintWrap>

      <EditorHintWrap title="Next page (⌘⌥↓)">
        <button
          type="button"
          aria-label="Next page"
          onClick={() => cycleActivePage(1)}
          className="flex h-full w-6 shrink-0 items-center justify-center text-app-subtle transition-colors hover:bg-app-hover hover:text-app-fg"
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </EditorHintWrap>

      {contextPageId && pages[contextPageId] && contextAnchor ? (
        <div
          className="fixed z-[80] min-w-[160px] editor-floating-menu border border-app-border bg-app-surface py-1 shadow-xl"
          style={{
            left: Math.max(
              8,
              Math.min(contextAnchor.left, window.innerWidth - 168),
            ),
            bottom: window.innerHeight - contextAnchor.top + 4,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
            onClick={() => {
              setRenameId(contextPageId);
              setDraftName(pages[contextPageId]!.name);
              setContextPageId(null);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
            onClick={() => {
              duplicatePage(contextPageId);
              setContextPageId(null);
            }}
          >
            <Copy className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
            Duplicate
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
            onClick={() => {
              const { emptied } = closePage(contextPageId);
              setContextPageId(null);
              if (emptied) router.push("/dashboard");
            }}
          >
            <X className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
