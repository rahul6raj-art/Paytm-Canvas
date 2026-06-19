"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "./EditorHoverHint";

export function CommentPinLayer() {
  const comments = useEditorStore((s) => s.comments);
  const activeCommentId = useEditorStore((s) => s.activeCommentId);
  const setActiveCommentId = useEditorStore((s) => s.setActiveCommentId);

  const ordered = useMemo(
    () => [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [comments],
  );
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    ordered.forEach((c, i) => m.set(c.id, i + 1));
    return m;
  }, [ordered]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[22]">
      {ordered.map((c) => {
        const num = indexById.get(c.id) ?? 0;
        const active = c.id === activeCommentId;
        return (
          <EditorHintWrap
            key={c.id}
            title={c.resolved ? "Resolved comment" : "Open comment"}
            anchorClassName="contents"
          >
            <button
              type="button"
              data-comment-pin
              aria-label={c.resolved ? "Resolved comment" : "Open comment"}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setActiveCommentId(c.id);
              }}
              className={cn(
                "pointer-events-auto absolute flex h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-ui font-semibold leading-none transition-transform",
                c.resolved
                  ? "border-[#d4d4d4] bg-white text-[#999] opacity-50 hover:opacity-90"
                  : "border-white bg-[#18a0fb] text-white hover:scale-105",
                active && "z-10 scale-105 ring-2 ring-[#18a0fb]/40 ring-offset-1 ring-offset-white",
              )}
              style={{ left: c.x, top: c.y, borderColor: active ? CANVAS_VISUAL.comment : undefined }}
            >
              {num}
            </button>
          </EditorHintWrap>
        );
      })}
    </div>
  );
}
