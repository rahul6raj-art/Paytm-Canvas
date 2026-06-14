"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPanelWidthInLayout,
  type PanelLayoutContext,
  type PanelWidthBounds,
} from "@/lib/sidebarPanelWidths";

export function useResizablePanelWidth(
  bounds: PanelWidthBounds,
  readWidth: () => number,
  writeWidth: (width: number) => void,
  layout?: PanelLayoutContext,
) {
  const [width, setWidth] = useState(bounds.default);
  const widthRef = useRef(bounds.default);
  const dragStartWidthRef = useRef(bounds.default);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const clamp = useCallback(
    (value: number) => clampPanelWidthInLayout(value, bounds, layoutRef.current),
    [bounds],
  );

  const syncWidth = useCallback(() => {
    const stored = readWidth();
    const next = clamp(stored);
    widthRef.current = next;
    setWidth(next);
    if (next !== stored) writeWidth(next);
  }, [clamp, readWidth, writeWidth]);

  useEffect(() => {
    syncWidth();
  }, [syncWidth]);

  useEffect(() => {
    if (!layout) return;
    const onResize = () => syncWidth();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [layout, syncWidth]);

  const onResizeStart = useCallback(() => {
    dragStartWidthRef.current = widthRef.current;
  }, []);

  const onResize = useCallback(
    (deltaX: number) => {
      const next = clamp(dragStartWidthRef.current + deltaX);
      widthRef.current = next;
      setWidth(next);
    },
    [clamp],
  );

  const onResizeEnd = useCallback(() => {
    writeWidth(widthRef.current);
  }, [writeWidth]);

  return { width, onResizeStart, onResize, onResizeEnd };
}
