"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  createRafPointerScheduler,
  forEachCoalescedPointerEvent,
} from "@/lib/smoothPointer";
import { EditorHintWrap } from "./EditorHoverHint";

export function SidebarSectionSplitHandle({
  onResizeStart,
  onResize,
  onResizeEnd,
  hintLabel = "Resize panels",
  showSectionDivider = false,
  className,
}: {
  onResizeStart?: () => void;
  onResize: (deltaY: number) => void;
  onResizeEnd?: () => void;
  hintLabel?: string;
  /** Full-width edge line between stacked sidebar sections (e.g. Pages / Layers). */
  showSectionDivider?: boolean;
  className?: string;
}) {
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onResizeStart?.();
      dragRef.current = { pointerId: e.pointerId, startY: e.clientY };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";

      const moveScheduler = createRafPointerScheduler<number>((deltaY) => {
        onResize(deltaY);
      });

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        forEachCoalescedPointerEvent(ev, (pe) => {
          moveScheduler.schedule(pe.clientY - d.startY);
        });
      };

      const onUp = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        forEachCoalescedPointerEvent(ev, (pe) => {
          moveScheduler.schedule(pe.clientY - d.startY);
        });
        moveScheduler.flush();
        moveScheduler.cancel();
        dragRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onResizeEnd?.();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [onResizeStart, onResize, onResizeEnd],
  );

  return (
    <div
      className={cn(
        "relative h-2 shrink-0",
        showSectionDivider && "border-t border-app-panel-edge",
        className,
      )}
    >
      <EditorHintWrap
        hintLabel={hintLabel}
        hintSide="top"
        className="absolute inset-x-0 -top-2 -bottom-2 flex cursor-row-resize touch-none items-center justify-center"
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize panels"
          className="group flex h-full w-full items-center justify-center"
          onPointerDown={onPointerDown}
        >
          <div className="pointer-events-none h-1 w-12 rounded-full bg-app-border transition-colors group-hover:bg-app-muted group-active:bg-app-fg/40" />
        </div>
      </EditorHintWrap>
    </div>
  );
}
