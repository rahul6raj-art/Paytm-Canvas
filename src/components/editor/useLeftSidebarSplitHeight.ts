"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampLayersPanelHeight,
  collapsedSplitLayersHeight,
  LEFT_SIDEBAR_SPLIT,
  readLayersPanelHeight,
  shouldSnapMitraCollapsed,
  writeLayersPanelHeight,
} from "@/lib/leftSidebarSplit";

export function useLeftSidebarSplitHeight(
  panelOpen: boolean,
  mitraOpen: boolean,
  onMitraOpenChange?: (open: boolean) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [layersHeight, setLayersHeight] = useState<number>(LEFT_SIDEBAR_SPLIT.defaultLayers);
  const [mitraPanelHeight, setMitraPanelHeight] = useState<number | undefined>(undefined);
  const preferredLayersHeightRef = useRef<number>(LEFT_SIDEBAR_SPLIT.defaultLayers);
  const mitraRequiredHeightRef = useRef<number>(LEFT_SIDEBAR_SPLIT.defaultMitra);
  const dragStartHeightRef = useRef(0);
  const availableHeightRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const prevMitraOpenRef = useRef(mitraOpen);
  const mitraOpenRef = useRef(mitraOpen);

  useEffect(() => {
    mitraOpenRef.current = mitraOpen;
  }, [mitraOpen]);

  const recomputeSplit = useCallback(
    (layersPanelOpen = panelOpen, julesOpen = mitraOpen) => {
      const available = availableHeightRef.current;
      if (!layersPanelOpen || !julesOpen || available <= 0) {
        setMitraPanelHeight(undefined);
        return;
      }

      const handle = LEFT_SIDEBAR_SPLIT.handle;
      const preferredLayers = preferredLayersHeightRef.current;
      const dragging = isDraggingRef.current;

      let layers = clampLayersPanelHeight(
        preferredLayers,
        available,
        layersPanelOpen,
        julesOpen,
      );
      let mitra = available - layers - handle;

      if (!dragging) {
        const requiredMitra = mitraRequiredHeightRef.current;
        if (requiredMitra > mitra) {
          mitra = Math.min(
            available - LEFT_SIDEBAR_SPLIT.minLayers - handle,
            Math.max(LEFT_SIDEBAR_SPLIT.minJulesHeader, Math.round(requiredMitra)),
          );
          layers = Math.max(LEFT_SIDEBAR_SPLIT.minLayers, available - mitra - handle);
          mitra = available - layers - handle;
        }
      }

      setLayersHeight(layers);
      setMitraPanelHeight(Math.max(LEFT_SIDEBAR_SPLIT.minJulesHeader, Math.round(mitra)));
    },
    [panelOpen, mitraOpen],
  );

  const applyPreferredLayersHeight = useCallback(
    (height: number, available: number, layersPanelOpen = panelOpen, julesOpen = mitraOpen) => {
      const next = clampLayersPanelHeight(height, available, layersPanelOpen, julesOpen);
      preferredLayersHeightRef.current = next;
      recomputeSplit(layersPanelOpen, julesOpen);
      return next;
    },
    [panelOpen, mitraOpen, recomputeSplit],
  );

  const syncFromContainer = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const available = el.clientHeight;
    availableHeightRef.current = available;
    setAvailableHeight(available);
    if (!panelOpen || !mitraOpen || available <= 0) return;
    if (isDraggingRef.current) return;

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      applyPreferredLayersHeight(
        readLayersPanelHeight(available, panelOpen, mitraOpen),
        available,
        panelOpen,
        mitraOpen,
      );
      return;
    }

    recomputeSplit(panelOpen, mitraOpen);
  }, [applyPreferredLayersHeight, panelOpen, mitraOpen, recomputeSplit]);

  const mitraReportRafRef = useRef(0);

  const reportMitraRequiredHeight = useCallback(
    (height: number) => {
      if (!mitraOpenRef.current || !panelOpen) return;
      if (!Number.isFinite(height) || height <= 0) return;
      const next = Math.round(height);
      if (next === mitraRequiredHeightRef.current) return;
      mitraRequiredHeightRef.current = next;
      if (isDraggingRef.current) return;

      if (mitraReportRafRef.current) {
        cancelAnimationFrame(mitraReportRafRef.current);
      }
      mitraReportRafRef.current = requestAnimationFrame(() => {
        mitraReportRafRef.current = 0;
        const available = availableHeightRef.current;
        if (available <= 0 || isDraggingRef.current) return;
        const handle = LEFT_SIDEBAR_SPLIT.handle;
        const currentMitra = available - preferredLayersHeightRef.current - handle;
        if (next <= currentMitra) return;
        recomputeSplit(panelOpen, mitraOpen);
      });
    },
    [mitraOpen, panelOpen, recomputeSplit],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncFromContainer());
    ro.observe(el);
    syncFromContainer();
    return () => {
      ro.disconnect();
      if (mitraReportRafRef.current) {
        cancelAnimationFrame(mitraReportRafRef.current);
      }
    };
  }, [syncFromContainer]);

  useEffect(() => {
    const wasMitraOpen = prevMitraOpenRef.current;
    prevMitraOpenRef.current = mitraOpen;

    if (panelOpen && mitraOpen) {
      if (!wasMitraOpen && !isDraggingRef.current) {
        const available = availableHeightRef.current;
        if (available > 0) {
          const handle = LEFT_SIDEBAR_SPLIT.handle;
          const requiredMitra = Math.max(
            LEFT_SIDEBAR_SPLIT.minJulesHeader,
            mitraRequiredHeightRef.current,
          );
          applyPreferredLayersHeight(
            clampLayersPanelHeight(
              available - requiredMitra - handle,
              available,
              panelOpen,
              true,
            ),
            available,
          );
        }
      }
      syncFromContainer();
      return;
    }

    hasInitializedRef.current = false;
    setMitraPanelHeight(undefined);
  }, [panelOpen, mitraOpen, syncFromContainer, applyPreferredLayersHeight]);

  const onResizeStart = useCallback(() => {
    isDraggingRef.current = true;
    const available = availableHeightRef.current;
    if (!mitraOpenRef.current && available > 0) {
      dragStartHeightRef.current = collapsedSplitLayersHeight(available);
      preferredLayersHeightRef.current = dragStartHeightRef.current;
      return;
    }
    dragStartHeightRef.current = preferredLayersHeightRef.current;
  }, []);

  const onResize = useCallback(
    (deltaY: number) => {
      const available = availableHeightRef.current;
      if (available <= 0) return;

      if (!mitraOpenRef.current) {
        if (deltaY > -LEFT_SIDEBAR_SPLIT.expandDragPx) return;
        onMitraOpenChange?.(true);
        mitraOpenRef.current = true;
        const next = applyPreferredLayersHeight(
          dragStartHeightRef.current + deltaY,
          available,
          panelOpen,
          true,
        );
        if (shouldSnapMitraCollapsed(available, next)) {
          onMitraOpenChange?.(false);
          mitraOpenRef.current = false;
        }
        return;
      }

      const next = applyPreferredLayersHeight(
        dragStartHeightRef.current + deltaY,
        available,
        panelOpen,
        true,
      );
      if (shouldSnapMitraCollapsed(available, next)) {
        onMitraOpenChange?.(false);
        mitraOpenRef.current = false;
      }
    },
    [applyPreferredLayersHeight, onMitraOpenChange, panelOpen],
  );

  const onResizeEnd = useCallback(() => {
    isDraggingRef.current = false;
    const available = availableHeightRef.current;
    const preferredLayers = preferredLayersHeightRef.current;

    if (panelOpen && mitraOpenRef.current && shouldSnapMitraCollapsed(available, preferredLayers)) {
      onMitraOpenChange?.(false);
      return;
    }

    if (panelOpen && mitraOpenRef.current) {
      writeLayersPanelHeight(preferredLayers, available, panelOpen, true);
    }

    recomputeSplit(panelOpen, mitraOpenRef.current);
  }, [onMitraOpenChange, panelOpen, recomputeSplit]);

  return {
    containerRef,
    layersHeight,
    mitraPanelHeight,
    availableHeight,
    onResizeStart,
    onResize,
    onResizeEnd,
    reportMitraRequiredHeight,
    showSplitHandle: panelOpen,
  };
}
