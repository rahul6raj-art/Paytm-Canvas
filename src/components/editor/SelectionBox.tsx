"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useEditorStore, finalizeResizeWasmSync, type EditorNode } from "@/stores/useEditorStore";
import { findInstanceRoot } from "@/lib/componentModel";
import { compositeSelectionBoundsId } from "@/lib/compositeSelection";
import {
  CANVAS_HANDLE_SCREEN_PX,
  CANVAS_ROTATE_HANDLE_GLYPH_SCREEN_PX,
  CANVAS_ROTATE_HANDLE_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_FONT_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_GAP_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_PAD_X_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_PAD_Y_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_RADIUS_SCREEN_PX,
  CANVAS_VISUAL,
  canvasResizeHandleStyle,
  canvasRotateHandleStyle,
  formatSelectionDimensions,
  screenPxToWorld,
} from "@/lib/canvasVisual";
import {
  applyMatrixToPoint,
  getMatrixRotationDegrees,
  getNodeTransformedWorldCorners,
  getWorldHandlesFromMatrix,
  matrixIsFinite,
  matrixToCssTransform,
  resizeCursorForRotatedHandle,
  normalizeRotationDegrees,
} from "@/lib/transformMath";
import {
  getNodeWorldInverseMatrixFromChildOrder,
  getNodeWorldMatrixFromChildOrder,
  getRenderedWorldBounds,
  worldToNodeLocalFromChildOrder,
} from "@/lib/editorGraph";
import { isCanvasBgCreationTool } from "@/lib/canvasInteractionGuards";
import {
  applyRotateDragCursor,
  clearRotateDragCursor,
  cornerOnOverlayBounds,
  rotateCursorCssForHandle,
  rotateCursorCssForWorldOutward,
  rotateCursorGeometryForHandle,
  rotateEdgeBandsForAxisBounds,
  rotateEdgeBandsForCorners,
  rotateZonesForAxisBounds,
  rotateZonesForCornerHandles,
  ROTATE_CORNER_HANDLES,
  topRotateHandleWorld,
} from "@/lib/selectionRotateZones";
import {
  applyMultiRotatePatches,
  applySingleRotate,
  createMultiRotateSession,
  createSingleRotateSession,
  formatRotationLabel,
  getNodeWorldCenterFromChildOrder,
  multiRotateLabelDegrees,
  singleRotateLabelDegrees,
  type RotateDragSession,
} from "@/lib/rotation";
import { anchorWorldAtBoundsFromChildOrder } from "@/lib/resizeTransform";
import { EDGE_RESIZE_HANDLES, type ResizeHandle } from "@/lib/resize";
import { CANVAS_CLICK_SLOP_SCREEN_PX } from "@/lib/canvasInteractionGuards";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import {
  createRafPointerScheduler,
  forEachCoalescedPointerEvent,
} from "@/lib/smoothPointer";
import {
  clearResizePreview,
  getDragPreviewSnapshot,
  getResizePreviewEpoch,
  subscribeDragPreview,
  subscribeResizePreview,
} from "@/lib/canvasEphemeralTransform";
import {
  overlayZoomForRotateHelpers,
  screenPxToOverlay,
  worldPointToOverlay,
  worldRectToOverlay,
} from "@/lib/canvasOverlaySpace";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";
import { RotateHandleGlyph } from "./RotateHandleGlyph";
import { rotateCursorAngleForHandle } from "@/lib/canvasRotateCursor";

const CURSOR: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

export function SelectionBox() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);
  const pan = useEditorStore((s) => s.pan);
  const resizeNode = useEditorStore((s) => s.resizeNode);
  const updateNode = useEditorStore((s) => s.updateNode);
  const updateNodes = useEditorStore((s) => s.updateNodes);
  const tool = useEditorStore((s) => s.tool);
  const transformInteractionMode = useEditorStore((s) => s.transformInteractionMode);
  const editorMode = useEditorStore((s) => s.editorMode);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const pencilDrawingNodeId = useEditorStore((s) => s.pencilDrawingNodeId);
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const editingTextId = useEditorStore((s) => s.editingTextId);
  const objectEditModeNodeId = useEditorStore((s) => s.objectEditModeNodeId);
  const toWorld = useCanvasToWorld();
  const setRotateHandleHovered = useEditorStore((s) => s.setRotateHandleHovered);
  const overlay = useCanvasOverlaySpace();
  const rotateZoom = overlayZoomForRotateHelpers(overlay);

  const rotateHoverHandlers = useCallback(
    (handle: ResizeHandle | "top") => ({
      onPointerEnter: () => setRotateHandleHovered(true, handle),
      onPointerLeave: () => setRotateHandleHovered(false, handle),
    }),
    [setRotateHandleHovered],
  );

  const creationToolActive = isCanvasBgCreationTool(tool, editorMode, { isPlacingComment });

  const canTransformSelection =
    editorMode === "design" &&
    tool !== "hand" &&
    !(tool === "pen" && penDrawingNodeId) &&
    !(tool === "pencil" && pencilDrawingNodeId) &&
    !(tool === "comment" && isPlacingComment);

  const handlePx = screenPxToOverlay(CANVAS_HANDLE_SCREEN_PX, overlay);
  const handleHalf = handlePx / 2;
  const rotateHandlePx = screenPxToOverlay(CANVAS_ROTATE_HANDLE_SCREEN_PX, overlay);
  const rotateGlyphPx = screenPxToOverlay(CANVAS_ROTATE_HANDLE_GLYPH_SCREEN_PX, overlay);
  const rotateHandleHalf = rotateHandlePx / 2;
  const dimensionBadgeFont = screenPxToOverlay(
    CANVAS_SELECTION_DIMENSION_BADGE_FONT_SCREEN_PX,
    overlay,
  );
  const dimensionBadgePadX = screenPxToOverlay(
    CANVAS_SELECTION_DIMENSION_BADGE_PAD_X_SCREEN_PX,
    overlay,
  );
  const dimensionBadgePadY = screenPxToOverlay(
    CANVAS_SELECTION_DIMENSION_BADGE_PAD_Y_SCREEN_PX,
    overlay,
  );
  const dimensionBadgeRadius = screenPxToOverlay(
    CANVAS_SELECTION_DIMENSION_BADGE_RADIUS_SCREEN_PX,
    overlay,
  );
  const dimensionLabelOffset = screenPxToOverlay(
    CANVAS_SELECTION_DIMENSION_BADGE_GAP_SCREEN_PX,
    overlay,
  );
  const visibleSelected = useMemo(
    () => selectedIds.filter((id) => nodes[id]?.visible),
    [selectedIds, nodes],
  );

  const resizeEpoch = useSyncExternalStore(subscribeResizePreview, getResizePreviewEpoch, () => 0);
  const dragPreview = useSyncExternalStore(subscribeDragPreview, getDragPreviewSnapshot, () => null);
  const nodesForLayout = useMemo(() => {
    if (transformInteractionMode !== "resize") return nodes;
    void resizeEpoch;
    return useEditorStore.getState().nodes;
  }, [nodes, transformInteractionMode, resizeEpoch]);

  const selectionOutlineIds = useMemo(() => {
    const out = new Set<string>();
    for (const sid of visibleSelected) {
      out.add(
        compositeSelectionBoundsId(sid, nodesForLayout, {
          objectEditModeNodeId,
          selectedIds,
        }),
      );
    }
    return [...out];
  }, [visibleSelected, nodesForLayout, objectEditModeNodeId, selectedIds]);

  const union = useMemo(() => {
    if (selectionOutlineIds.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const sid of selectionOutlineIds) {
      const tb = getRenderedWorldBounds(sid, nodesForLayout, childOrder);
      minX = Math.min(minX, tb.x);
      minY = Math.min(minY, tb.y);
      maxX = Math.max(maxX, tb.x + tb.width);
      maxY = Math.max(maxY, tb.y + tb.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [selectionOutlineIds, nodesForLayout, childOrder]);

  const isDraggingSelection = useMemo(() => {
    if (!dragPreview?.movingIds.length) return false;
    const moving = new Set(dragPreview.movingIds);
    return visibleSelected.some((sid) => moving.has(sid));
  }, [dragPreview, visibleSelected]);

  const dragOffset = useMemo(() => {
    if (!isDraggingSelection || !dragPreview) return { dx: 0, dy: 0 };
    return { dx: dragPreview.dx, dy: dragPreview.dy };
  }, [dragPreview, isDraggingSelection]);

  const id =
    selectionOutlineIds.length === 1 && visibleSelected.length === 1
      ? selectionOutlineIds[0]!
      : null;
  const node = id ? nodesForLayout[id] : null;
  const frameNodeId = id;
  const frameNode = frameNodeId ? nodesForLayout[frameNodeId] : null;

  const worldMatrix = useMemo(() => {
    if (!frameNodeId) return null;
    return getNodeWorldMatrixFromChildOrder(frameNodeId, nodesForLayout, childOrder);
  }, [frameNodeId, nodesForLayout, childOrder]);

  const oriented = Boolean(
    id &&
      node &&
      frameNode &&
      visibleSelected.length === 1 &&
      node.type !== "line" &&
      node.type !== "arrow" &&
      worldMatrix &&
      matrixIsFinite(worldMatrix),
  );

  const orientedHandles = useMemo(() => {
    if (!oriented || !frameNodeId || !frameNode || !worldMatrix) return null;
    const handles = getWorldHandlesFromMatrix(worldMatrix, frameNode.width, frameNode.height);
    if (!handles.every((h) => Number.isFinite(h.x) && Number.isFinite(h.y))) return null;
    if (dragOffset.dx === 0 && dragOffset.dy === 0) return handles;
    return handles.map((h) => ({
      ...h,
      x: h.x + dragOffset.dx,
      y: h.y + dragOffset.dy,
    }));
  }, [oriented, frameNodeId, frameNode, worldMatrix, dragOffset]);

  const useOrientedOverlay = oriented && orientedHandles != null;

  const overlayOrientedHandles = useMemo(() => {
    if (!orientedHandles) return null;
    return orientedHandles.map((h) => {
      const p = worldPointToOverlay(h.x, h.y, overlay);
      return { ...h, x: p.x, y: p.y };
    });
  }, [orientedHandles, overlay]);

  const worldRotation = worldMatrix ? getMatrixRotationDegrees(worldMatrix) : 0;

  const dragRef = useRef<{
    pointerId: number;
    handle: ResizeHandle;
    startBounds: { x: number; y: number; width: number; height: number };
    startInv: ReturnType<typeof getNodeWorldInverseMatrixFromChildOrder>;
    nodesSnapshot: Record<string, EditorNode>;
    childOrderSnapshot: Record<string, string[]>;
    fixedWorldCorner: { x: number; y: number } | null;
    fixedWorldCenter: { x: number; y: number } | null;
    startPointerWorld: { x: number; y: number };
    startClient: { x: number; y: number };
    resizeCommitted: boolean;
    detach?: () => void;
  } | null>(null);

  const rotateDragRef = useRef<{
    pointerId: number;
    session: RotateDragSession;
    captureEl: HTMLElement;
    rotateHandle: ResizeHandle | "top";
  } | null>(null);
  /** Frozen at rotate start so the axis-aligned box does not grow while R changes. */
  const rotateFrozenUnionRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [rotateFrozenUnion, setRotateFrozenUnion] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [rotateLabel, setRotateLabel] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      return clientToWorldFromDocument(clientX, clientY, { pan, zoom: z });
    },
    [toWorld],
  );

  const multi = visibleSelected.length > 1;
  const locked = multi ? visibleSelected.some((sid) => nodes[sid]?.locked) : Boolean(node?.locked);
  const canTransform = Boolean(union && !locked && !multi && canTransformSelection);
  const canRotate = Boolean(union && !locked && canTransformSelection);
  const showTransformHandles = !creationToolActive;
  const showResizeHandles =
    showTransformHandles &&
    canTransform &&
    !isDraggingSelection &&
    node?.type !== "line" &&
    node?.type !== "arrow";
  const showRotateHandles = showTransformHandles && canRotate && !isDraggingSelection;

  const displayUnion = useMemo(() => {
    let base: typeof union;
    if (transformInteractionMode === "rotate") {
      base = rotateFrozenUnionRef.current ?? rotateFrozenUnion ?? union;
    } else {
      base = union;
    }
    if (!base) return null;
    if (dragOffset.dx === 0 && dragOffset.dy === 0) return base;
    return { ...base, x: base.x + dragOffset.dx, y: base.y + dragOffset.dy };
  }, [transformInteractionMode, rotateFrozenUnion, union, dragOffset]);

  const cancelResizeDrag = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    d.detach?.();
    dragRef.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    clearResizePreview();
    if (useEditorStore.getState().transformInteractionMode === "resize") {
      useEditorStore.getState().setTransformInteractionMode("none");
    }
  }, []);

  const beginRotateDrag = useCallback(
    (e: React.PointerEvent, rotateHandle: ResizeHandle | "top" = "nw") => {
      if (!union || locked || !canTransformSelection) return;
      if (multi && visibleSelected.every((sid) => nodes[sid]?.locked)) return;
      if (!multi && (!id || !node || node.locked)) return;
      e.stopPropagation();
      e.preventDefault();
      cancelResizeDrag();
      const captureEl = e.currentTarget as HTMLElement;
      document.body.style.userSelect = "none";
      const frozenUnion = union ? { ...union } : null;
      rotateFrozenUnionRef.current = frozenUnion;
      setRotateFrozenUnion(frozenUnion);
      if (!multi && node) {
        useEditorStore.getState().beginRotateInteraction(id!, {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
        });
      } else {
        useEditorStore.getState().setTransformInteractionMode("rotate");
      }
      const st = useEditorStore.getState();
      const worldCorners =
        !multi && id ? getNodeTransformedWorldCorners(id, st.nodes) : null;
      const rotateCursorGeom = rotateCursorGeometryForHandle(
        rotateHandle,
        union,
        zoom,
        worldCorners,
      );
      applyRotateDragCursor(captureEl, rotateHandle, worldRotation, rotateCursorGeom);
      useEditorStore.getState().pushHistory();
      const w0 = clientToWorld(e.clientX, e.clientY);
      const session: RotateDragSession = multi
        ? createMultiRotateSession(visibleSelected, st.nodes, st.childOrder, union, w0)
        : createSingleRotateSession(id!, node!, st.nodes, st.childOrder, w0);
      rotateDragRef.current = { pointerId: e.pointerId, session, captureEl, rotateHandle };
      captureEl.setPointerCapture(e.pointerId);

      const labelOffset = screenPxToWorld(12, zoom);

      const rotateScheduler = createRafPointerScheduler<{
        world: { x: number; y: number };
        shiftKey: boolean;
      }>(({ world, shiftKey }) => {
        const d = rotateDragRef.current;
        if (!d) return;
        const cur = useEditorStore.getState();
        if (d.session.kind === "single") {
          const { rotation, x, y } = applySingleRotate(
            d.session,
            world,
            shiftKey,
            cur.nodes,
            cur.childOrder,
          );
          updateNode(d.session.id, { rotation, x, y }, { skipHistory: true });
          setRotateLabel({
            x: world.x,
            y: world.y - labelOffset,
            text: formatRotationLabel(singleRotateLabelDegrees(d.session, world, shiftKey)),
          });
        } else {
          const patches = applyMultiRotatePatches(
            d.session,
            world,
            shiftKey,
            cur.nodes,
            cur.childOrder,
          );
          updateNodes(patches, { skipHistory: true });
          setRotateLabel({
            x: world.x,
            y: world.y - labelOffset,
            text: formatRotationLabel(multiRotateLabelDegrees(d.session, world, shiftKey)),
          });
        }
      });

      const liveRotateCursorGeom = () => {
        const d = rotateDragRef.current;
        if (!d) return rotateCursorGeom;
        const cur = useEditorStore.getState();
        const liveCorners =
          d.session.kind === "single"
            ? getNodeTransformedWorldCorners(d.session.id, cur.nodes)
            : null;
        return rotateCursorGeometryForHandle(
          d.rotateHandle,
          union,
          zoom,
          liveCorners,
        );
      };

      const onMove = (ev: PointerEvent) => {
        const d = rotateDragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        applyRotateDragCursor(d.captureEl, d.rotateHandle, worldRotation, liveRotateCursorGeom());
        forEachCoalescedPointerEvent(ev, (pe) => {
          rotateScheduler.schedule({
            world: clientToWorld(pe.clientX, pe.clientY),
            shiftKey: pe.shiftKey,
          });
        });
      };
      const onUp = (ev: PointerEvent) => {
        const d = rotateDragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        forEachCoalescedPointerEvent(ev, (pe) => {
          rotateScheduler.schedule({
            world: clientToWorld(pe.clientX, pe.clientY),
            shiftKey: pe.shiftKey,
          });
        });
        rotateScheduler.flush();
        rotateScheduler.cancel();
        const { captureEl, session } = d;
        const stEnd = useEditorStore.getState();
        if (session.kind === "single") {
          const finalRotation =
            stEnd.nodes[session.id]?.rotation ?? session.startRotation;
          stEnd.endRotateInteraction(session.id, finalRotation);
        } else {
          stEnd.setTransformInteractionMode("none");
        }
        rotateDragRef.current = null;
        rotateFrozenUnionRef.current = null;
        setRotateFrozenUnion(null);
        setRotateLabel(null);
        document.body.style.userSelect = "";
        clearRotateDragCursor(captureEl);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [
      union,
      locked,
      multi,
      visibleSelected,
      nodes,
      canTransformSelection,
      clientToWorld,
      updateNode,
      updateNodes,
      id,
      node,
      zoom,
      worldRotation,
      cancelResizeDrag,
    ],
  );

  const onHandleDown = useCallback(
    (handle: ResizeHandle) => (e: React.PointerEvent) => {
      if (editorMode === "inspect") return;
      const stGuard = useEditorStore.getState();
      if (stGuard.transformInteractionMode === "rotate" || stGuard.rotateGeomSnapshot) return;
      if (!id || !node || node.locked) return;
      if (!canTransformSelection) return;
      rotateDragRef.current = null;
      e.stopPropagation();
      e.preventDefault();
      const cursor = oriented
        ? resizeCursorForRotatedHandle(handle, worldRotation)
        : CURSOR[handle];
      document.body.style.userSelect = "none";
      document.body.style.cursor = cursor;

      const st0 = useEditorStore.getState();
      const startBounds = { x: node.x, y: node.y, width: node.width, height: node.height };
      const nodesSnapshot = st0.nodes;
      const childOrderSnapshot = st0.childOrder;
      const startInv = getNodeWorldInverseMatrixFromChildOrder(
        id,
        nodesSnapshot,
        childOrderSnapshot,
      );
      const fixedWorldCorner = anchorWorldAtBoundsFromChildOrder(
        id,
        nodesSnapshot,
        childOrderSnapshot,
        handle,
        startBounds,
      );
      const fixedWorldCenter = getNodeWorldCenterFromChildOrder(id, nodesSnapshot, childOrderSnapshot);
      const startPointerWorld = clientToWorld(e.clientX, e.clientY);
      const startClient = { x: e.clientX, y: e.clientY };

      const beginResizeIfNeeded = (clientX: number, clientY: number) => {
        const d = dragRef.current;
        if (!d || d.resizeCommitted) return true;
        const slop = CANVAS_CLICK_SLOP_SCREEN_PX;
        if (Math.hypot(clientX - d.startClient.x, clientY - d.startClient.y) <= slop) {
          return false;
        }
        d.resizeCommitted = true;
        useEditorStore.getState().pushHistory();
        useEditorStore.getState().setTransformInteractionMode("resize");
        return true;
      };

      const applyResizeFromPointer = (
        world: { x: number; y: number },
        shiftKey: boolean,
        altKey: boolean,
      ) => {
        const d = dragRef.current;
        if (!d || !id) return;
        const st = useEditorStore.getState();
        if (st.transformInteractionMode !== "resize" || st.rotateGeomSnapshot) return;

        const resizePoint = d.startInv
          ? applyMatrixToPoint(d.startInv, world)
          : worldToNodeLocalFromChildOrder(
              world.x,
              world.y,
              id,
              d.nodesSnapshot,
              d.childOrderSnapshot,
            );
        const fixedWorld = altKey ? d.fixedWorldCenter : d.fixedWorldCorner;

        resizeNode(
          id,
          d.handle,
          d.startBounds,
          resizePoint,
          { shiftKey, altKey },
          {
            skipHistory: true,
            fixedWorld,
            pointerWorld: world,
            startPointerWorld: d.startPointerWorld,
          },
        );
      };

      const resizeMoveScheduler = createRafPointerScheduler<{
        world: { x: number; y: number };
        shiftKey: boolean;
        altKey: boolean;
      }>(({ world, shiftKey, altKey }) => {
        applyResizeFromPointer(world, shiftKey, altKey);
      });

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        forEachCoalescedPointerEvent(ev, (pe) => {
          if (!beginResizeIfNeeded(pe.clientX, pe.clientY)) return;
          resizeMoveScheduler.schedule({
            world: clientToWorld(pe.clientX, pe.clientY),
            shiftKey: pe.shiftKey,
            altKey: pe.altKey,
          });
        });
      };

      const onUp = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        const shouldCommit = d.resizeCommitted;
        if (shouldCommit) {
          forEachCoalescedPointerEvent(ev, (pe) => {
            resizeMoveScheduler.schedule({
              world: clientToWorld(pe.clientX, pe.clientY),
              shiftKey: pe.shiftKey,
              altKey: pe.altKey,
            });
          });
          resizeMoveScheduler.flush();
        }
        resizeMoveScheduler.cancel();
        dragRef.current = null;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        clearResizePreview();
        if (shouldCommit) {
          finalizeResizeWasmSync();
          useEditorStore.getState().setTransformInteractionMode("none");
        }
        detachResizeListeners();
      };

      const detachResizeListeners = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      dragRef.current = {
        pointerId: e.pointerId,
        handle,
        startBounds,
        startInv,
        nodesSnapshot,
        childOrderSnapshot,
        fixedWorldCorner,
        fixedWorldCenter,
        startPointerWorld,
        startClient,
        resizeCommitted: false,
        detach: detachResizeListeners,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [
      id,
      node,
      canTransformSelection,
      resizeNode,
      clientToWorld,
      editorMode,
      oriented,
      worldRotation,
      beginRotateDrag,
    ],
  );

  const overlayUnion = useMemo(
    () => (displayUnion ? worldRectToOverlay(displayUnion, overlay) : null),
    [displayUnion, overlay],
  );

  const overlayCenter = useMemo(() => {
    if (!overlayUnion) return null;
    return {
      x: overlayUnion.x + overlayUnion.width / 2,
      y: overlayUnion.y + overlayUnion.height / 2,
    };
  }, [overlayUnion]);

  const rotateCursorAtOverlay = useCallback(
    (hit: { x: number; y: number }) => {
      if (overlayCenter) {
        return rotateCursorCssForWorldOutward(hit, overlayCenter);
      }
      return rotateCursorCssForHandle("top", worldRotation);
    },
    [overlayCenter, worldRotation],
  );

  const overlayCornerForHandle = useCallback(
    (handle: ResizeHandle) => {
      if (overlayOrientedHandles) {
        const h = overlayOrientedHandles.find((t) => t.handle === handle);
        if (h) return { x: h.x, y: h.y };
      }
      if (!overlayUnion) return { x: 0, y: 0 };
      return cornerOnOverlayBounds(handle, overlayUnion);
    },
    [overlayOrientedHandles, overlayUnion],
  );

  const rotateEdgeBands = useMemo(() => {
    if (!showRotateHandles || !overlayUnion) return [];
    if (useOrientedOverlay && overlayOrientedHandles) {
      return rotateEdgeBandsForCorners(overlayOrientedHandles, overlayUnion, rotateZoom);
    }
    return rotateEdgeBandsForAxisBounds(overlayUnion, rotateZoom);
  }, [showRotateHandles, overlayUnion, useOrientedOverlay, overlayOrientedHandles, rotateZoom]);

  /** Figma-style rotate-from-corner targets (outside each corner, along the diagonal). */
  const cornerRotateZones = useMemo(() => {
    if (!showRotateHandles || !overlayUnion) return [];
    if (useOrientedOverlay && overlayOrientedHandles) {
      return rotateZonesForCornerHandles(overlayOrientedHandles, overlayUnion, rotateZoom);
    }
    return rotateZonesForAxisBounds(overlayUnion, rotateZoom);
  }, [showRotateHandles, overlayUnion, useOrientedOverlay, overlayOrientedHandles, rotateZoom]);

  const frameOutlinePoints = useMemo(() => {
    if (!overlayUnion) return null;
    if (
      frameNodeId &&
      visibleSelected.length === 1 &&
      node?.type !== "line" &&
      node?.type !== "arrow"
    ) {
      const corners = getNodeTransformedWorldCorners(frameNodeId, nodesForLayout);
      if (corners) {
        return corners.map((c) =>
          worldPointToOverlay(c.x + dragOffset.dx, c.y + dragOffset.dy, overlay),
        );
      }
    }
    const { x, y, width, height } = overlayUnion;
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }, [
    overlayUnion,
    frameNodeId,
    visibleSelected.length,
    node?.type,
    nodesForLayout,
    dragOffset,
    overlay,
  ]);

  const topRotatePos = useMemo(() => {
    if (!showRotateHandles || !displayUnion) return null;
    if (oriented && id) {
      const corners = getNodeTransformedWorldCorners(id, nodesForLayout);
      if (corners) {
        const [nw, ne] = corners;
        const topMid = {
          x: (nw.x + ne.x) / 2 + dragOffset.dx,
          y: (nw.y + ne.y) / 2 + dragOffset.dy,
        };
        return topRotateHandleWorld(displayUnion, zoom, topMid);
      }
    }
    return topRotateHandleWorld(displayUnion, zoom);
  }, [showRotateHandles, displayUnion, oriented, id, nodesForLayout, zoom, dragOffset]);

  if (!displayUnion || !overlayUnion || visibleSelected.length === 0) return null;
  if (editorMode !== "inspect" && !canTransformSelection) return null;
  if (editorMode === "inspect" && tool !== "move" && tool !== "hand") return null;

  const hideFrameForEmptyTextEdit =
    editingTextId &&
    visibleSelected.length === 1 &&
    visibleSelected[0] === editingTextId &&
    !(nodes[editingTextId]?.content?.length);
  if (hideFrameForEmptyTextEdit) return null;

  const hideFrameForPathEdit =
    pathEditModeNodeId != null &&
    visibleSelected.length === 1 &&
    visibleSelected[0] === pathEditModeNodeId;
  if (hideFrameForPathEdit) return null;

  const instanceSelection = Boolean(id && findInstanceRoot(nodes, id));
  const anyInstanceInMulti = visibleSelected.some((sid) => findInstanceRoot(nodes, sid));

  const wr = overlayUnion;
  const topRotateScreenPos = topRotatePos
    ? worldPointToOverlay(topRotatePos.x, topRotatePos.y, overlay)
    : null;
  const rotateLabelScreen = rotateLabel
    ? worldPointToOverlay(rotateLabel.x, rotateLabel.y, overlay)
    : null;

  const outlineColor =
    editorMode === "inspect"
      ? "#f472b6"
      : locked
        ? CANVAS_VISUAL.locked
        : !multi && instanceSelection
          ? CANVAS_VISUAL.instance
          : multi && anyInstanceInMulti
            ? CANVAS_VISUAL.instance
            : CANVAS_VISUAL.selection;

  const handleBorderColor =
    !multi && instanceSelection
      ? CANVAS_VISUAL.instance
      : multi && anyInstanceInMulti
        ? CANVAS_VISUAL.instance
        : CANVAS_VISUAL.selection;

  const resizeHandleStyle = canvasResizeHandleStyle(handleBorderColor, handlePx);
  const topRotateStyle = canvasRotateHandleStyle(handleBorderColor, rotateHandlePx);
  const topRotateGlyphAngle = rotateCursorAngleForHandle("top", worldRotation);

  const axisEdgeHandles: { h: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
    { h: "n", style: { left: wr.x + wr.width / 2 - handleHalf, top: wr.y - handleHalf }, cursor: CURSOR.n },
    { h: "e", style: { left: wr.x + wr.width - handleHalf, top: wr.y + wr.height / 2 - handleHalf }, cursor: CURSOR.e },
    { h: "s", style: { left: wr.x + wr.width / 2 - handleHalf, top: wr.y + wr.height - handleHalf }, cursor: CURSOR.s },
    { h: "w", style: { left: wr.x - handleHalf, top: wr.y + wr.height / 2 - handleHalf }, cursor: CURSOR.w },
  ];

  const axisCornerResize: { h: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
    { h: "nw", style: { left: wr.x - handleHalf, top: wr.y - handleHalf }, cursor: CURSOR.nw },
    { h: "ne", style: { left: wr.x + wr.width - handleHalf, top: wr.y - handleHalf }, cursor: CURSOR.ne },
    { h: "se", style: { left: wr.x + wr.width - handleHalf, top: wr.y + wr.height - handleHalf }, cursor: CURSOR.se },
    { h: "sw", style: { left: wr.x - handleHalf, top: wr.y + wr.height - handleHalf }, cursor: CURSOR.sw },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {frameOutlinePoints ? (
        <svg
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          width="100%"
          height="100%"
          aria-hidden
        >
          <polygon
            points={frameOutlinePoints.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={outlineColor}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
      {showResizeHandles && useOrientedOverlay && overlayOrientedHandles
        ? overlayOrientedHandles
            .filter(
              ({ handle }) =>
                EDGE_RESIZE_HANDLES.includes(handle) || ROTATE_CORNER_HANDLES.includes(handle),
            )
            .map(({ handle, x, y }) => (
              <button
                key={handle}
                type="button"
                data-resize-handle
                title="Drag to resize"
                className={`pointer-events-auto touch-none absolute select-none ${
                  ROTATE_CORNER_HANDLES.includes(handle) ? "z-[35]" : "z-[32]"
                }`}
                style={{
                  ...resizeHandleStyle,
                  left: x - handleHalf,
                  top: y - handleHalf,
                  cursor: resizeCursorForRotatedHandle(handle, worldRotation),
                }}
                onPointerDown={onHandleDown(handle)}
              />
            ))
        : null}
      {showResizeHandles && !useOrientedOverlay
        ? axisEdgeHandles.map(({ h, style, cursor }) => (
            <button
              key={h}
              type="button"
              data-resize-handle
              title="Drag to resize"
              className="pointer-events-auto z-[32] touch-none absolute select-none"
              style={{
                ...resizeHandleStyle,
                ...style,
                cursor,
              }}
              onPointerDown={onHandleDown(h)}
            />
          ))
        : null}
      {showResizeHandles && !useOrientedOverlay
        ? axisCornerResize.map(({ h, style, cursor }) => (
            <button
              key={h}
              type="button"
              data-resize-handle
              title="Drag to resize"
              className="pointer-events-auto z-[35] touch-none absolute select-none"
              style={{
                ...resizeHandleStyle,
                ...style,
                cursor,
              }}
              onPointerDown={onHandleDown(h)}
            />
          ))
        : null}
      {showRotateHandles
        ? rotateEdgeBands.map((band) => (
            <button
              key={band.id}
              type="button"
              data-rotate-edge
              aria-label={`Rotate from ${band.handle} corner`}
              title="Drag to rotate"
              className="pointer-events-auto absolute z-[33] touch-none bg-transparent"
              style={{
                left: band.x,
                top: band.y,
                width: band.width,
                height: band.height,
                transform: band.transform,
                transformOrigin: band.transformOrigin ?? "0 0",
                cursor: rotateCursorAtOverlay(overlayCornerForHandle(band.handle)),
              }}
              onPointerDown={(e) => beginRotateDrag(e, band.handle)}
              {...rotateHoverHandlers(band.handle)}
            />
          ))
        : null}
      {showRotateHandles
        ? cornerRotateZones.map((zone) => {
            const half = zone.size / 2;
            return (
              <button
                key={`rotate-zone-${zone.handle}`}
                type="button"
                data-rotate-zone
                aria-label={`Rotate from ${zone.handle} corner`}
                title="Drag to rotate"
                className="pointer-events-auto absolute z-[34] touch-none bg-transparent"
                style={{
                  left: zone.x - half,
                  top: zone.y - half,
                  width: zone.size,
                  height: zone.size,
                  cursor: rotateCursorAtOverlay({ x: zone.x, y: zone.y }),
                }}
                onPointerDown={(e) => beginRotateDrag(e, zone.handle)}
                {...rotateHoverHandlers(zone.handle)}
              />
            );
          })
        : null}
      {showRotateHandles && topRotateScreenPos ? (
        <button
          type="button"
          data-rotate-handle
          aria-label="Rotate"
          title="Drag to rotate"
          className="pointer-events-auto absolute z-[36] touch-none select-none"
          style={{
            ...topRotateStyle,
            left: topRotateScreenPos.x - rotateHandleHalf,
            top: topRotateScreenPos.y - rotateHandleHalf,
            cursor: rotateCursorAtOverlay(topRotateScreenPos),
          }}
          onPointerDown={(e) => beginRotateDrag(e, "top")}
          {...rotateHoverHandlers("top")}
        >
          <RotateHandleGlyph size={rotateGlyphPx} angleDeg={topRotateGlyphAngle} />
        </button>
      ) : null}
      {rotateLabelScreen ? (
        <div
          className="pointer-events-none absolute z-[32] whitespace-nowrap rounded px-1.5 py-0.5 text-ui font-semibold tabular-nums text-white"
          style={{
            left: rotateLabelScreen.x,
            top: rotateLabelScreen.y,
            transform: "translate(-50%, -100%)",
            background: CANVAS_VISUAL.selection,
          }}
        >
          {rotateLabel!.text}
        </div>
      ) : null}
      {editorMode === "design" && !isDraggingSelection ? (
        <div
          data-selection-dimension-badge
          className="pointer-events-none absolute z-[32] whitespace-nowrap font-semibold tabular-nums text-white shadow-sm"
          style={{
            left: wr.x + wr.width / 2,
            top: wr.y + wr.height + dimensionLabelOffset,
            transform: "translate(-50%, 0)",
            background: CANVAS_VISUAL.selection,
            fontSize: dimensionBadgeFont,
            lineHeight: `${dimensionBadgeFont}px`,
            padding: `${dimensionBadgePadY}px ${dimensionBadgePadX}px`,
            borderRadius: dimensionBadgeRadius,
          }}
        >
          {formatSelectionDimensions(
            frameNode && visibleSelected.length === 1 ? frameNode.width : wr.width,
            frameNode && visibleSelected.length === 1 ? frameNode.height : wr.height,
          )}
        </div>
      ) : null}
    </div>
  );
}
