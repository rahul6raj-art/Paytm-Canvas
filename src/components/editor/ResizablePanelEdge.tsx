"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { forEachCoalescedPointerEvent } from "@/lib/smoothPointer";

type PanelEdge = "left" | "right";

export function ResizablePanelEdge({
  edge,
  onResizeStart,
  onResize,
  onResizeEnd,
  className,
}: {
  edge: PanelEdge;
  onResizeStart?: () => void;
  onResize: (deltaX: number) => void;
  onResizeEnd?: () => void;
  className?: string;
}) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onResizeStart?.();
      dragRef.current = { pointerId: e.pointerId, startX: e.clientX };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        forEachCoalescedPointerEvent(ev, (pe) => {
          const rawDelta = pe.clientX - d.startX;
          const delta = edge === "right" ? rawDelta : -rawDelta;
          onResize(delta);
        });
      };

      const onUp = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        forEachCoalescedPointerEvent(ev, (pe) => {
          const rawDelta = pe.clientX - d.startX;
          const delta = edge === "right" ? rawDelta : -rawDelta;
          onResize(delta);
        });
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
    [edge, onResizeStart, onResize, onResizeEnd],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      title="Drag to resize panel"
      className={cn(
        "absolute top-0 z-10 h-full w-1.5 shrink-0 touch-none",
        edge === "right" ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2",
        "cursor-col-resize",
        className,
      )}
      onPointerDown={onPointerDown}
    />
  );
}
