"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { AdjacentPanelDialogPosition } from "./useAdjacentPanelDialogPosition";

const VIEWPORT_PAD = 8;

export function clampFloatingPanelPosition(
  left: number,
  top: number,
  width: number,
  maxHeight: number,
  viewport?: { width: number; height: number },
): { left: number; top: number } {
  const vw = viewport?.width ?? window.innerWidth;
  const vh = viewport?.height ?? window.innerHeight;
  return {
    left: Math.max(VIEWPORT_PAD, Math.min(left, vw - width - VIEWPORT_PAD)),
    top: Math.max(VIEWPORT_PAD, Math.min(top, vh - maxHeight - VIEWPORT_PAD)),
  };
}

/** Lets inspector floating panels (color picker, etc.) be dragged by their header. */
export function useDraggableFloatingPanel(
  open: boolean,
  basePosition: AdjacentPanelDialogPosition,
) {
  const [draggedAt, setDraggedAt] = useState<{ left: number; top: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setDraggedAt(null);
      setIsDragging(false);
      dragRef.current = null;
    }
  }, [open]);

  const position = useMemo(() => {
    if (!draggedAt) return basePosition;
    return {
      ...basePosition,
      ...clampFloatingPanelPosition(
        draggedAt.left,
        draggedAt.top,
        basePosition.width,
        basePosition.maxHeight,
      ),
    };
  }, [basePosition, draggedAt]);

  useEffect(() => {
    if (!open || !draggedAt) return;
    const onResize = () => {
      setDraggedAt((prev) =>
        prev
          ? clampFloatingPanelPosition(
              prev.left,
              prev.top,
              basePosition.width,
              basePosition.maxHeight,
            )
          : null,
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, draggedAt, basePosition.width, basePosition.maxHeight]);

  const onHeaderPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;

      e.preventDefault();
      const currentLeft = draggedAt?.left ?? basePosition.left;
      const currentTop = draggedAt?.top ?? basePosition.top;

      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originLeft: currentLeft,
        originTop: currentTop,
      };
      setIsDragging(true);

      const onMove = (ev: globalThis.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        setDraggedAt(
          clampFloatingPanelPosition(
            drag.originLeft + (ev.clientX - drag.startX),
            drag.originTop + (ev.clientY - drag.startY),
            basePosition.width,
            basePosition.maxHeight,
          ),
        );
      };

      const end = (ev: globalThis.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        dragRef.current = null;
        setIsDragging(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    [basePosition.left, basePosition.top, basePosition.width, basePosition.maxHeight, draggedAt],
  );

  return { position, onHeaderPointerDown, isDragging };
}
