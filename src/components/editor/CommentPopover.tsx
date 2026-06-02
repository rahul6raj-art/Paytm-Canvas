"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { isNonEmptyCommentBody } from "@/lib/comments";
import { Button } from "@/components/ui/button";

function useCommentPopoverPosition(activeId: string | null, worldX: number, worldY: number) {
  const zoom = useEditorStore((s) => s.zoom);
  const pan = useEditorStore((s) => s.pan);
  const [box, setBox] = useState<{ left: number; top: number; maxW: number }>({ left: 0, top: 0, maxW: 320 });

  useLayoutEffect(() => {
    if (!activeId) return;
    const el = document.querySelector<HTMLElement>("[data-canvas-viewport]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pinLeft = r.left + pan.x + worldX * zoom;
    const pinTop = r.top + pan.y + worldY * zoom;
    const maxW = Math.min(320, Math.max(220, r.width - 24));
    let left = pinLeft + 14;
    let top = pinTop + 14;
    const pad = 8;
    if (left + maxW > r.right - pad) left = Math.max(pad + r.left, r.right - pad - maxW);
    if (top + 420 > r.bottom - pad) top = Math.max(pad + r.top, pinTop - 8 - 420);
    top = Math.max(pad + r.top, Math.min(top, r.bottom - pad - 120));
    setBox({ left, top, maxW });
  }, [activeId, worldX, worldY, zoom, pan.x, pan.y]);

  return box;
}

export function CommentPopover() {
  const activeCommentId = useEditorStore((s) => s.activeCommentId);
  const comment = useEditorStore((s) => s.comments.find((c) => c.id === s.activeCommentId) ?? null);
  const addCommentReply = useEditorStore((s) => s.addCommentReply);
  const resolveComment = useEditorStore((s) => s.resolveComment);
  const reopenComment = useEditorStore((s) => s.reopenComment);
  const deleteComment = useEditorStore((s) => s.deleteComment);

  const [draft, setDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!comment) return;
    if (lastId.current !== comment.id) {
      lastId.current = comment.id;
      setDraft(comment.body);
      setReplyDraft("");
    }
  }, [comment]);

  const pos = useCommentPopoverPosition(activeCommentId, comment?.x ?? 0, comment?.y ?? 0);

  const commitBody = useCallback(() => {
    const id = activeCommentId;
    if (!id) return;
    const st = useEditorStore.getState();
    const c = st.comments.find((x) => x.id === id);
    if (!c) return;
    const next = draft;
    if (!isNonEmptyCommentBody(next) && c.replies.length === 0) {
      st.deleteComment(id, { skipHistory: true });
      st.setActiveCommentId(null);
      return;
    }
    if (isNonEmptyCommentBody(next) && next.trim() !== c.body) {
      st.updateComment(id, next.trim());
    }
  }, [activeCommentId, draft]);

  const finalizeClose = useCallback(() => {
    commitBody();
    const st = useEditorStore.getState();
    const id = st.activeCommentId;
    if (!id) return;
    const c = st.comments.find((x) => x.id === id);
    if (!c) {
      st.setActiveCommentId(null);
      return;
    }
    if (!isNonEmptyCommentBody(c.body) && c.replies.length === 0) {
      st.deleteComment(id, { skipHistory: true });
    }
    st.setActiveCommentId(null);
  }, [commitBody]);

  useEffect(() => {
    if (!activeCommentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      finalizeClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [activeCommentId, finalizeClose]);

  const submitReply = useCallback(() => {
    if (!comment || !isNonEmptyCommentBody(replyDraft)) return;
    addCommentReply(comment.id, replyDraft);
    setReplyDraft("");
  }, [addCommentReply, comment, replyDraft]);

  const onBodyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        commitBody();
      }
    },
    [commitBody],
  );

  const onReplyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        submitReply();
      }
    },
    [submitReply],
  );

  useEffect(() => {
    if (!comment) return;
    const t = window.setTimeout(() => bodyRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [comment?.id]);

  const node = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.body;
  }, []);

  if (!comment || !node) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close comment"
        className="fixed inset-0 z-[60] cursor-default bg-app-toolbar-well"
        onPointerDown={(e) => {
          e.preventDefault();
          finalizeClose();
        }}
      />
      <div
        role="dialog"
        aria-label="Comment"
        className="fixed z-[61] flex max-h-[min(480px,calc(100vh-24px))] flex-col overflow-hidden rounded-lg border border-white/15 bg-app-panel shadow-xl"
        style={{ left: pos.left, top: pos.top, width: pos.maxW }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 border-b border-white/10 px-3 py-2">
          <div
            className="mt-0.5 h-7 w-7 shrink-0 rounded-full border border-white/10"
            style={{ backgroundColor: comment.author.color }}
            title={comment.author.name}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-white">{comment.author.name}</div>
            <div className="text-[10px] text-app-subtle">
              {new Date(comment.createdAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
          </div>
          <button
            type="button"
            className="rounded p-1 text-[#a3a3a3] hover:bg-white/10 hover:text-app-fg"
            title="Close"
            onClick={finalizeClose}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <textarea
            ref={bodyRef}
            className="min-h-[72px] w-full resize-y rounded-md border border-white/10 bg-app-surface px-2 py-1.5 text-[12px] text-app-fg outline-none ring-0 placeholder:text-[#666] focus:border-[#0d99ff]/60"
            placeholder="Write a comment…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitBody}
            onKeyDown={onBodyKeyDown}
          />

          {comment.replies.length > 0 ? (
            <ul className="mt-3 space-y-2 border-t border-app-border-subtle pt-3">
              {comment.replies.map((r) => (
                <li key={r.id} className="rounded-md bg-app-toolbar-well px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: r.author.color }}
                    />
                    <span className="text-[11px] font-medium text-app-fg">{r.author.name}</span>
                    <span className="text-[10px] text-app-subtle">
                      {new Date(r.createdAt).toLocaleTimeString(undefined, { timeStyle: "short" })}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap pl-4 text-[11px] leading-snug text-app-muted">{r.body}</p>
                </li>
              ))}
            </ul>
          ) : null}

          {!comment.resolved ? (
            <div className="mt-3 border-t border-app-border-subtle pt-3">
              <textarea
                className="min-h-[52px] w-full resize-y rounded-md border border-white/10 bg-app-surface px-2 py-1.5 text-[12px] text-app-fg outline-none placeholder:text-[#666] focus:border-[#0d99ff]/60"
                placeholder="Reply… (⌘↵)"
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                onKeyDown={onReplyKeyDown}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#252525] px-3 py-2">
          {!comment.resolved ? (
            <>
              <Button
                type="button"
                variant="toolbar"
                className="h-7 gap-1 px-2 text-[11px]"
                onClick={() => {
                  commitBody();
                  resolveComment(comment.id);
                }}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2} />
                Resolve
              </Button>
              <Button
                type="button"
                variant="toolbar"
                className="h-7 px-2 text-[11px]"
                disabled={!isNonEmptyCommentBody(replyDraft)}
                onClick={submitReply}
              >
                Reply
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="toolbar"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => {
                commitBody();
                reopenComment(comment.id);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
              Reopen
            </Button>
          )}
          <Button
            type="button"
            variant="toolbar"
            className="ml-auto h-7 gap-1 px-2 text-[11px] text-red-300 hover:text-red-200"
            onClick={() => deleteComment(comment.id, { pendingBody: draft })}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            Delete
          </Button>
        </div>
      </div>
    </>,
    node,
  );
}
