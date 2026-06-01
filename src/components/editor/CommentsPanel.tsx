"use client";

import { useMemo, useState } from "react";
import { Inbox, MessageSquare } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";
import { isPaytmCraftApiMode } from "@/lib/env";
function previewBody(body: string): string {
  const t = body.trim();
  if (!t) return "(empty)";
  return t.length > 72 ? `${t.slice(0, 72)}…` : t;
}

export function CommentsPanel() {
  const comments = useEditorStore((s) => s.comments);
  const activeCommentId = useEditorStore((s) => s.activeCommentId);
  const focusComment = useEditorStore((s) => s.focusComment);
  const isApiBackedFile = useEditorStore((s) => s.isApiBackedFile);
  const apiCommentsStatus = useEditorStore((s) => s.apiCommentsStatus);

  const isApi = isPaytmCraftApiMode();

  const { open, resolved } = useMemo(() => {
    const o = comments.filter((c) => !c.resolved);
    const r = comments.filter((c) => c.resolved);
    o.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    r.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { open: o, resolved: r };
  }, [comments]);

  const [resolvedOpen, setResolvedOpen] = useState(false);

  const apiSyncHint = useMemo(() => {
    if (!isApi || !isApiBackedFile) return null;
    switch (apiCommentsStatus) {
      case "loading":
        return "API comments loading";
      case "synced":
        return "API comments synced";
      case "failed":
        return "API comments failed";
      default:
        return null;
    }
  }, [isApi, isApiBackedFile, apiCommentsStatus]);

  return (
    <aside className="flex h-full min-h-0 w-[240px] shrink-0 flex-col border-r border-black/30 bg-chrome-panel shadow-panel">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-black/30 bg-[#383838] px-3">
        <MessageSquare className="h-3.5 w-3.5 text-[#a3a3a3]" strokeWidth={2} />
        <span className="text-[11px] font-semibold tracking-wide text-[#c4c4c4]">Comments</span>
        {apiSyncHint ? (
          <span
            className={cn(
              "min-w-0 max-w-[120px] truncate text-[9px] font-semibold uppercase tracking-wide",
              apiCommentsStatus === "failed" && "text-red-400/90",
              apiCommentsStatus === "loading" && "text-amber-200/90",
              apiCommentsStatus === "synced" && "text-emerald-400/85",
            )}
            title={apiSyncHint}
          >
            {apiSyncHint}
          </span>
        ) : null}
        <span className="ml-auto shrink-0 tabular-nums text-[10px] font-medium text-[#7a7a7a]">{open.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {open.length === 0 && resolved.length === 0 ? (
          <div className="mx-1 mt-2 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-8 text-center">
            <Inbox className="mx-auto mb-2 h-8 w-8 text-[#4a4a4a]" strokeWidth={1.25} />
            <p className="text-[12px] font-medium text-[#9a9a9a]">No comments on this file</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#6b6b6b]">
              Choose the comment tool in the toolbar, then click the canvas to pin feedback. Resolved threads appear
              below when expanded.
            </p>
          </div>
        ) : null}
        <ul className="space-y-1">
          {open.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => focusComment(c.id)}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left transition-colors",
                  activeCommentId === c.id
                    ? "border-[#0d99ff]/50 bg-[#0d99ff]/12"
                    : "border-transparent hover:bg-white/[0.06]",
                )}
              >
                <span className="text-[10px] font-medium text-[#9a9a9a]">
                  {c.author.name}
                  {c.replies.length > 0 ? (
                    <span className="text-[#6b6b6b]"> · {c.replies.length} repl{c.replies.length === 1 ? "y" : "ies"}</span>
                  ) : null}
                </span>
                <span className="line-clamp-2 text-[11px] text-[#e0e0e0]">{previewBody(c.body)}</span>
              </button>
            </li>
          ))}
        </ul>

        {resolved.length > 0 ? (
          <details
            className="mt-3 border-t border-white/[0.06] pt-2"
            open={resolvedOpen}
            onToggle={(e) => setResolvedOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer select-none px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#7a7a7a] hover:text-[#b0b0b0]">
              Resolved ({resolved.length})
            </summary>
            <ul className="mt-1 space-y-1">
              {resolved.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => focusComment(c.id)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left opacity-70 transition-colors hover:bg-white/[0.05] hover:opacity-100",
                      activeCommentId === c.id ? "border-[#0d99ff]/40 bg-[#0d99ff]/10" : "border-transparent",
                    )}
                  >
                    <span className="text-[10px] font-medium text-[#8a8a8a]">
                      {c.author.name}
                      {c.replies.length > 0 ? (
                        <span> · {c.replies.length} repl{c.replies.length === 1 ? "y" : "ies"}</span>
                      ) : null}
                    </span>
                    <span className="line-clamp-2 text-[11px] text-[#c8c8c8]">{previewBody(c.body)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </aside>
  );
}
