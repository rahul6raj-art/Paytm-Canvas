"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPagesSectionHeight,
  LAYERS_PANEL_PAGES_SPLIT,
  readPagesSectionHeight,
  writePagesSectionHeight,
} from "@/lib/layersPanelPagesSplit";

export function useLayersPanelPagesSplit(enabled: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pagesHeight, setPagesHeight] = useState<number>(LAYERS_PANEL_PAGES_SPLIT.defaultPages);
  const preferredPagesHeightRef = useRef<number>(LAYERS_PANEL_PAGES_SPLIT.defaultPages);
  const dragStartHeightRef = useRef(0);
  const availableHeightRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const applyPreferredPagesHeight = useCallback((height: number, available: number) => {
    const next = clampPagesSectionHeight(height, available);
    preferredPagesHeightRef.current = next;
    setPagesHeight(next);
    return next;
  }, []);

  const syncFromContainer = useCallback(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    const available = el.clientHeight;
    if (available <= 0) return;
    availableHeightRef.current = available;
    if (isDraggingRef.current) return;

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      applyPreferredPagesHeight(readPagesSectionHeight(available), available);
      return;
    }

    applyPreferredPagesHeight(preferredPagesHeightRef.current, available);
  }, [applyPreferredPagesHeight, enabled]);

  useEffect(() => {
    if (!enabled) {
      hasInitializedRef.current = false;
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncFromContainer());
    ro.observe(el);
    syncFromContainer();
    return () => ro.disconnect();
  }, [enabled, syncFromContainer]);

  const onResizeStart = useCallback(() => {
    isDraggingRef.current = true;
    dragStartHeightRef.current = preferredPagesHeightRef.current;
  }, []);

  const onResize = useCallback(
    (deltaY: number) => {
      if (!enabled) return;
      const available = availableHeightRef.current;
      if (available <= 0) return;
      applyPreferredPagesHeight(dragStartHeightRef.current + deltaY, available);
    },
    [applyPreferredPagesHeight, enabled],
  );

  const onResizeEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (!enabled) return;
    const available = availableHeightRef.current;
    if (available <= 0) return;
    writePagesSectionHeight(preferredPagesHeightRef.current, available);
  }, [enabled]);

  return {
    containerRef,
    pagesHeight,
    showSplit: enabled,
    onResizeStart,
    onResize,
    onResizeEnd,
  };
}
