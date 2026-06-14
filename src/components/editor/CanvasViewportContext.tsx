"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  getDragPreviewSnapshot,
  getPanPreviewSnapshot,
  PAN_PREVIEW_IDLE,
  subscribeDragPreview,
  subscribePanPreview,
} from "@/lib/canvasEphemeralTransform";
import {
  buildPinnedSceneIds,
  computeWorldViewportRect,
  isViewportCullingEnabled,
  type ViewportCullContext,
} from "@/lib/canvasViewportCull";

const disabledCullContext: ViewportCullContext = {
  enabled: false,
  worldViewport: { x: 0, y: 0, width: 6000, height: 6000 },
  pinnedIds: new Set(),
};

const CanvasViewportContext = createContext<ViewportCullContext>(disabledCullContext);

export function CanvasViewportProvider({
  viewportRef,
  children,
}: {
  viewportRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const pan = useEditorStore((s) => s.pan);
  const zoom = useEditorStore((s) => s.zoom);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const hoveredCanvasId = useEditorStore((s) => s.hoveredCanvasId);
  const objectEditModeNodeId = useEditorStore((s) => s.objectEditModeNodeId);
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);
  const editingTextId = useEditorStore((s) => s.editingTextId);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const pencilDrawingNodeId = useEditorStore((s) => s.pencilDrawingNodeId);
  const shapeDrawingNodeId = useEditorStore((s) => s.shapeDrawingSession?.nodeId ?? null);
  const frameDrawingNodeId = useEditorStore((s) => s.frameDrawingSession?.nodeId ?? null);
  const textDrawingNodeId = useEditorStore((s) => s.textDrawingSession?.nodeId ?? null);
  const placingComponentMasterId = useEditorStore((s) => s.placingComponentMasterId);

  const panPreview = useSyncExternalStore(
    subscribePanPreview,
    getPanPreviewSnapshot,
    () => PAN_PREVIEW_IDLE,
  );
  const dragPreview = useSyncExternalStore(subscribeDragPreview, getDragPreviewSnapshot, () => null);

  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const sync = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      setViewportSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewportRef]);

  const value = useMemo((): ViewportCullContext => {
    if (!isViewportCullingEnabled()) return disabledCullContext;

    const effectivePan = { x: pan.x + panPreview.dx, y: pan.y + panPreview.dy };
    const nodes = useEditorStore.getState().nodes;
    const pinnedIds = buildPinnedSceneIds({
      selectedIds,
      hoveredId: hoveredCanvasId,
      objectEditModeNodeId,
      pathEditModeNodeId,
      editingTextId,
      penDrawingNodeId,
      pencilDrawingNodeId,
      shapeDrawingNodeId,
      frameDrawingNodeId,
      textDrawingNodeId,
      placingComponentMasterId,
      dragMovingIds: dragPreview?.movingIds ?? [],
      nodes,
    });

    return {
      enabled: true,
      worldViewport: computeWorldViewportRect(
        viewportSize.width,
        viewportSize.height,
        effectivePan,
        zoom,
      ),
      pinnedIds,
    };
  }, [
    pan,
    panPreview.dx,
    panPreview.dy,
    zoom,
    viewportSize.width,
    viewportSize.height,
    selectedIds,
    hoveredCanvasId,
    objectEditModeNodeId,
    pathEditModeNodeId,
    editingTextId,
    penDrawingNodeId,
    pencilDrawingNodeId,
    shapeDrawingNodeId,
    frameDrawingNodeId,
    textDrawingNodeId,
    placingComponentMasterId,
    dragPreview,
  ]);

  return (
    <CanvasViewportContext.Provider value={value}>{children}</CanvasViewportContext.Provider>
  );
}

export function useCanvasViewportCull(): ViewportCullContext {
  return useContext(CanvasViewportContext);
}
