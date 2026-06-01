"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

export function PageTabsBar() {
  const pageOrder = useEditorStore((s) => s.pageOrder);
  const pages = useEditorStore((s) => s.pages);
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const addPage = useEditorStore((s) => s.addPage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const renamePage = useEditorStore((s) => s.renamePage);
  const cycleActivePage = useEditorStore((s) => s.cycleActivePage);

  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [renameId, setRenameId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [contextPageId, setContextPageId] = useState<string | null>(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
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
      <button
        type="button"
        title="Previous page (⌘⌥↑)"
        aria-label="Previous page"
        onClick={() => cycleActivePage(-1)}
        className="flex h-full w-6 shrink-0 items-center justify-center text-[#7a7a7a] transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

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
                "group relative flex h-full shrink-0 items-stretch border-r border-white/[0.06]",
                active ? "bg-[#383838]" : "bg-[#2c2c2c] hover:bg-[#333333]",
              )}
            >
              {renaming ? (
                <input
                  ref={renameInputRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenameId(null);
                  }}
                  className="h-full w-[min(140px,28vw)] min-w-[72px] border-0 bg-[#1a1a1a] px-2.5 text-[11px] font-medium text-white outline-none ring-1 ring-inset ring-accent"
                />
              ) : (
                <button
                  ref={(el) => {
                    if (el) tabRefs.current.set(pageId, el);
                    else tabRefs.current.delete(pageId);
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={page.name}
                  onClick={() => setActivePage(pageId)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    setRenameId(pageId);
                    setDraftName(page.name);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextPageId(pageId);
                    setContextPos({ x: e.clientX, y: e.clientY });
                  }}
                  className={cn(
                    "flex h-full max-w-[180px] items-center px-2.5 text-[11px] font-medium transition-colors",
                    active ? "text-white" : "text-[#a3a3a3] group-hover:text-[#e6e6e6]",
                  )}
                >
                  <span className="truncate">{page.name}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        title="Add page"
        aria-label="Add page"
        onClick={() => addPage()}
        className="flex h-full shrink-0 items-center gap-1 border-l border-white/[0.06] px-2 text-[11px] font-medium text-[#8c8c8c] transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>

      <button
        type="button"
        title="Next page (⌘⌥↓)"
        aria-label="Next page"
        onClick={() => cycleActivePage(1)}
        className="flex h-full w-6 shrink-0 items-center justify-center text-[#7a7a7a] transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      {contextPageId && pages[contextPageId] ? (
        <div
          className="fixed z-[80] min-w-[160px] rounded-md border border-white/[0.1] bg-[#1e1e1e] py-1 shadow-xl"
          style={{ left: contextPos.x, top: contextPos.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-[#ececec] hover:bg-white/[0.08]"
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
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-[#ececec] hover:bg-white/[0.08]"
            onClick={() => {
              duplicatePage(contextPageId);
              setContextPageId(null);
            }}
          >
            <Copy className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
            Duplicate
          </button>
          {pageOrder.length > 1 ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-red-300 hover:bg-red-500/15"
              onClick={() => {
                deletePage(contextPageId);
                setContextPageId(null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
