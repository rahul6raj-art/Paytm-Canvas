"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, X } from "lucide-react";
import { handlePanelFieldKeyDown } from "@/lib/panelFieldKeyboard";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";
import { EditorHintWrap } from "./EditorHoverHint";

export function PagesPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const pageOrder = useEditorStore((s) => s.pageOrder);
  const pages = useEditorStore((s) => s.pages);
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const addPage = useEditorStore((s) => s.addPage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);
  const closePage = useEditorStore((s) => s.closePage);
  const renamePage = useEditorStore((s) => s.renamePage);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renameId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renameId]);

  const commitRename = () => {
    if (!renameId) return;
    const trimmed = draftName.trim();
    if (trimmed) renamePage(renameId, trimmed);
    setRenameId(null);
  };

  return (
    <div className={cn(embedded ? "px-3 py-2" : "border-b border-app-panel-edge px-3 py-2.5")}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="section-heading">Pages</p>
        <EditorHintWrap title="Add page">
          <button
            type="button"
            onClick={() => addPage()}
            className="flex h-7 items-center gap-1 rounded-md border border-app-border px-2 text-ui font-medium text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
            aria-label="Add page"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            <span>Add</span>
          </button>
        </EditorHintWrap>
      </div>
      <div className="space-y-px">
        {pageOrder.map((pageId) => {
          const page = pages[pageId];
          if (!page) return null;
          const active = pageId === activePageId;
          const renaming = renameId === pageId;
          return (
            <div
              key={pageId}
              className={cn(
                "group flex h-7 items-center gap-1 rounded px-1 transition-colors",
                active
                  ? "bg-[rgba(13,153,255,0.14)] ring-1 ring-[rgba(13,153,255,0.35)]"
                  : "hover:bg-white/[0.05]",
              )}
            >
              <button
                type="button"
                onClick={() => setActivePage(pageId)}
                onDoubleClick={() => {
                  setRenameId(pageId);
                  setDraftName(page.name);
                }}
                className="flex min-w-0 flex-1 items-center gap-2 px-1 text-left"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-black/20",
                    active ? "bg-accent" : "bg-[#5c5c5c]",
                  )}
                />
                {renaming ? (
                  <input
                    ref={inputRef}
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      handlePanelFieldKeyDown(e, {
                        onEnter: () => commitRename(),
                        onEscape: () => setRenameId(null),
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-0 flex-1 rounded border border-[rgba(13,153,255,0.45)] bg-app-field px-1 py-0 text-ui-sm text-white outline-none"
                  />
                ) : (
                  <span
                    className={cn(
                      "truncate text-ui-sm font-medium",
                      active ? "text-white" : "text-app-muted group-hover:text-app-fg",
                    )}
                  >
                    {page.name}
                  </span>
                )}
              </button>
              {!renaming && (
                <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <EditorHintWrap title="Duplicate page">
                    <button
                      type="button"
                      onClick={() => duplicatePage(pageId)}
                      className="flex h-5 w-5 items-center justify-center rounded text-app-subtle hover:bg-app-hover hover:text-app-fg"
                      aria-label={`Duplicate ${page.name}`}
                    >
                      <Copy className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </EditorHintWrap>
                  <EditorHintWrap title="Close page">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const { emptied } = closePage(pageId);
                        if (emptied) router.push("/dashboard");
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded text-app-subtle hover:bg-app-hover hover:text-app-fg"
                      aria-label={`Close ${page.name}`}
                    >
                      <X className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </EditorHintWrap>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <EditorHintWrap title="Add new page">
        <button
          type="button"
          onClick={() => addPage()}
          className="mt-1.5 flex h-7 w-full items-center gap-2 rounded px-2 text-left text-ui-sm font-medium text-[#8a8a8a] transition-colors hover:bg-white/[0.05] hover:text-app-fg"
          aria-label="Add new page"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          <span>Add page</span>
        </button>
      </EditorHintWrap>
    </div>
  );
}
