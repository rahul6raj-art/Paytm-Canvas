"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { findInstanceRoot } from "@/lib/componentModel";
import {
  CANVAS_HANDLE_SCREEN_PX,
  CANVAS_OUTLINE_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_FONT_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_GAP_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_PAD_X_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_PAD_Y_SCREEN_PX,
  CANVAS_SELECTION_DIMENSION_BADGE_RADIUS_SCREEN_PX,
  CANVAS_VISUAL,
  formatSelectionDimensions,
  screenPxToWorld,
} from "@/lib/canvasVisual";
import {
  getMatrixRotationDegrees,
  getNodeTransformedWorldCorners,
  getNodeWorldInverseMatrix,
  getWorldHandlesFromMatrix,
  matrixIsFinite,
  matrixToCssTransform,
  hasRotation,
  resizeCursorForRotatedHandle,
  normalizeRotationDegrees,
  worldToParentLocal,
} from "@/lib/transformMath";
import {
  getNodeWorldMatrixFromChildOrder,
  getRenderedWorldBounds,
  syncGroupFrameToVisible,
  worldToNodeLocalFromChildOrder,
} from "@/lib/editorGraph";
import { isBooleanGroup, isMaskGroup } from "@/lib/booleanGeometry";
import { isCanvasBgCreationTool } from "@/lib/canvasInteractionGuards";
import {
  applyRotateDragCursor,
  clearRotateDragCursor,
  outwardScreenFromCorner,
  pointerOnCornerHandleRotateHalf,
  rotateCursorCssForHandle,
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
  multiRotateLabelDegrees,
  singleRotateLabelDegrees,
  type RotateDragSession,
  getNodeWorldCenterFromChildOrder,
} from "@/lib/rotation";
import { anchorWorldAtBounds } from "@/lib/resizeTransform";
import { EDGE_RESIZE_HANDLES, type ResizeHandle } from "@/lib/resize";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import {
  createRafPointerScheduler,
  forEachCoalescedPointerEvent,
} from "@/lib/smoothPointer";

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
  const transformMode = useEditorStore((s) => s.transformInteractionMode);
  const editorMode = useEditorStore((s) => s.editorMode);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const pencilDrawingNodeId = useEditorStore((s) => s.pencilDrawingNodeId);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const toWorld = useCanvasToWorld();
  const setRotateHandleHovered = useEditorStore((s) => s.setRotateHandleHovered);

  const [shiftHeld, setShiftHeld] = useState(false);
  const [altHeld, setAltHeld] = useState(false);

  useEffect(() => {
    const syncModifiers = (e: KeyboardEvent) => {
      setShiftHeld(e.shiftKey);
      setAltHeld(e.altKey);
    };
    const clearModifiers = () => {
      setShiftHeld(false);
      setAltHeld(false);
    };
    window.addEventListener("keydown", syncModifiers);
    window.addEventListener("keyup", syncModifiers);
    window.addEventListener("blur", clearModifiers);
    return () => {
      window.removeEventListener("keydown", syncModifiers);
      window.removeEventListener("keyup", syncModifiers);
      window.removeEventListener("blur", clearModifiers);
    };
  }, []);

  const isCornerScalePointer = (e: { shiftKey: boolean; altKey: boolean }) =>
    e.shiftKey && e.altKey;

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

  const handleWorld = screenPxToWorld(CANVAS_HANDLE_SCREEN_PX, zoom);
  const borderWorld = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);
  const dimensionBadgeFont = screenPxToWorld(CANVAS_SELECTION_DIMENSION_BADGE_FONT_SCREEN_PX, zoom);
  const dimensionBadgePadX = screenPxToWorld(
    CANVAS_SELECTION_DIMENSION_BADGE_PAD_X_SCREEN_PX,
    zoom,
  );
  const dimensionBadgePadY = screenPxToWorld(
    CANVAS_SELECTION_DIMENSION_BADGE_PAD_Y_SCREEN_PX,
    zoom,
  );
  const dimensionBadgeRadius = screenPxToWorld(
    CANVAS_SELECTION_DIMENSION_BADGE_RADIUS_SCREEN_PX,
    zoom,
  );
  const dimensionLabelOffset = screenPxToWorld(
    CANVAS_SELECTION_DIMENSION_BADGE_GAP_SCREEN_PX,
    zoom,
  );
  const off = handleWorld / 2;

  const visibleSelected = useMemo(
    () => selectedIds.filter((id) => nodes[id]?.visible),
    [selectedIds, nodes],
  );

  const union = useMemo(() => {
    if (visibleSelected.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const sid of visibleSelected) {
      const tb = getRenderedWorldBounds(sid, nodes, childOrder);
      minX = Math.min(minX, tb.x);
      minY = Math.min(minY, tb.y);
      maxX = Math.max(maxX, tb.x + tb.width);
      maxY = Math.max(maxY, tb.y + tb.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [visibleSelected, nodes, childOrder]);

  const id = visibleSelected.length === 1 ? visibleSelected[0]! : null;
  const node = id ? nodes[id] : null;
  const frameNodeId = id;
  const frameNode = frameNodeId ? nodes[frameNodeId] : null;

  const worldMatrix = useMemo(() => {
    if (!frameNodeId) return null;
    return getNodeWorldMatrixFromChildOrder(frameNodeId, nodes, childOrder);
  }, [frameNodeId, nodes, childOrder]);

  const oriented = Boolean(
    id &&
      node &&
      !isMaskGroup(node) &&
      !isBooleanGroup(node) &&
      frameNode &&
      visibleSelected.length === 1 &&
      worldMatrix &&
      matrixIsFinite(worldMatrix),
  );

  const orientedHandles = useMemo(() => {
    if (!oriented || !frameNodeId || !frameNode || !worldMatrix) return null;
    const handles = getWorldHandlesFromMatrix(worldMatrix, frameNode.width, frameNode.height);
    if (!handles.every((h) => Number.isFinite(h.x) && Number.isFinite(h.y))) return null;
    return handles;
  }, [oriented, frameNodeId, frameNode, worldMatrix]);

  const useOrientedOverlay = oriented && orientedHandles != null;

  const worldRotation = worldMatrix ? getMatrixRotationDegrees(worldMatrix) : 0;

  const cornerScaleCursorForHandle = useCallback(
    (handle: ResizeHandle) =>
      oriented ? resizeCursorForRotatedHandle(handle, worldRotation) : CURSOR[handle],
    [oriented, worldRotation],
  );

  const outwardScreenForCorner = useCallback(
    (handle: ResizeHandle) => {
      if (!union || !orientedHandles) return undefined;
      const corner = orientedHandles.find((h) => h.handle === handle);
      if (!corner) return undefined;
      const cx = union.x + union.width / 2;
      const cy = union.y + union.height / 2;
      return outwardScreenFromCorner(corner.x, corner.y, cx, cy, zoom);
    },
    [union, orientedHandles, zoom],
  );

  const updateCornerRotateHover = useCallback(
    (e: React.PointerEvent, handle: ResizeHandle) => {
      const el = e.currentTarget as HTMLElement;
      if (isCornerScalePointer(e)) {
        setRotateHandleHovered(false, handle);
        el.style.cursor = cornerScaleCursorForHandle(handle);
        return;
      }
      const outward = outwardScreenForCorner(handle);
      const onRotateHalf = pointerOnCornerHandleRotateHalf(
        handle,
        e.clientX,
        e.clientY,
        el,
        outward,
      );
      if (onRotateHalf) {
        setRotateHandleHovered(true, handle);
        el.style.cursor = rotateCursorCssForHandle(handle, worldRotation);
      } else {
        setRotateHandleHovered(false, handle);
        el.style.cursor = "default";
      }
    },
    [
      setRotateHandleHovered,
      cornerScaleCursorForHandle,
      outwardScreenForCorner,
      worldRotation,
    ],
  );

  const cornerHoverHandlers = useCallback(
    (handle: ResizeHandle) => ({
      onPointerEnter: (e: React.PointerEvent) => updateCornerRotateHover(e, handle),
      onPointerLeave: (e: React.PointerEvent) => {
        setRotateHandleHovered(false, handle);
        (e.currentTarget as HTMLElement).style.cursor = "default";
      },
      onPointerMove: (e: React.PointerEvent) => updateCornerRotateHover(e, handle),
    }),
    [setRotateHandleHovered, updateCornerRotateHover],
  );

  const dragRef = useRef<{
    pointerId: number;
    handle: ResizeHandle;
    startBounds: { x: number; y: number; width: number; height: number };
    startInv: ReturnType<typeof getNodeWorldInverseMatrix>;
    nodesSnapshot: Record<string, EditorNode>;
    fixedWorld: { x: number; y: number } | null;
    rafId: number | null;
    pending: {
      world: { x: number; y: number };
      shiftKey: boolean;
      altKey: boolean;
    } | null;
  } | null>(null);

  const rotateDragRef = useRef<{
    pointerId: number;
    session: RotateDragSession;
    captureEl: HTMLElement;
    rotateHandle: ResizeHandle | "top";
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
    showTransformHandles && canTransform && node?.type !== "line" && node?.type !== "arrow";
  const showRotateHandles = showTransformHandles && canRotate;

  const beginRotateDrag = useCallback(
    (e: React.PointerEvent, rotateHandle: ResizeHandle | "top" = "nw") => {
      if (!union || locked || !canTransformSelection) return;
      if (multi && visibleSelected.every((sid) => nodes[sid]?.locked)) return;
      if (!multi && (!id || !node || node.locked)) return;
      e.stopPropagation();
      e.preventDefault();
      const captureEl = e.currentTarget as HTMLElement;
      document.body.style.userSelect = "none";
      useEditorStore.getState().setTransformInteractionMode("rotate");
      applyRotateDragCursor(captureEl, rotateHandle, worldRotation);
      useEditorStore.getState().pushHistory();
      const st = useEditorStore.getState();
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
          const { rotation } = applySingleRotate(
            d.session,
            world,
            shiftKey,
            cur.nodes,
            cur.childOrder,
          );
          updateNode(d.session.id, { rotation }, { skipHistory: true });
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

      const onMove = (ev: PointerEvent) => {
        const d = rotateDragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        applyRotateDragCursor(d.captureEl, d.rotateHandle, worldRotation);
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
        const { captureEl } = d;
        rotateDragRef.current = null;
        setRotateLabel(null);
        document.body.style.userSelect = "";
        clearRotateDragCursor(captureEl);
        useEditorStore.getState().setTransformInteractionMode("none");
        if (d.session.kind === "single") {
          const sid = d.session.id;
          useEditorStore.setState((s) => {
            const n = s.nodes[sid];
            if (!n) return s;
            let nodes = s.nodes;
            if (isBooleanGroup(n) || isMaskGroup(n)) {
              nodes = syncGroupFrameToVisible(sid, nodes, s.childOrder);
            } else if (n.parentId) {
              const parent = nodes[n.parentId];
              if (parent && (isBooleanGroup(parent) || isMaskGroup(parent))) {
                nodes = syncGroupFrameToVisible(parent.id, nodes, s.childOrder);
              }
            }
            return nodes === s.nodes ? s : { nodes };
          });
        }
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
    ],
  );

  const onHandleDown = useCallback(
    (handle: ResizeHandle) => (e: React.PointerEvent) => {
      if (editorMode === "inspect") return;
      if (useEditorStore.getState().transformInteractionMode === "rotate") return;
      if (!id || !node || node.locked) return;
      if (!canTransformSelection) return;
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
      const startInv = getNodeWorldInverseMatrix(id, nodesSnapshot);
      const scaleFromCenter = isCornerScalePointer(e);
      const fixedWorld = scaleFromCenter
        ? getNodeWorldCenterFromChildOrder(id, nodesSnapshot, st0.childOrder)
        : anchorWorldAtBounds(id, nodesSnapshot, handle, startBounds);

      dragRef.current = {
        pointerId: e.pointerId,
        handle,
        startBounds,
        startInv,
        nodesSnapshot,
        fixedWorld,
        rafId: null,
        pending: null,
      };
      useEditorStore.getState().pushHistory();
      useEditorStore.getState().setTransformInteractionMode("resize");
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const flushResize = () => {
        const d = dragRef.current;
        if (!d || !d.pending) return;
        const { world, shiftKey, altKey } = d.pending;
        d.pending = null;
        d.rafId = null;

        const n0 = d.nodesSnapshot[id];
        const co = useEditorStore.getState().childOrder;
        const resizePoint =
          n0 && hasRotation(n0.rotation)
            ? worldToNodeLocalFromChildOrder(world.x, world.y, id, d.nodesSnapshot, co)
            : worldToParentLocal(world.x, world.y, id, d.nodesSnapshot);

        resizeNode(
          id,
          d.handle,
          d.startBounds,
          resizePoint,
          { shiftKey, altKey },
          { skipHistory: true, fixedWorld: d.fixedWorld },
        );
      };

      const scheduleResize = (world: { x: number; y: number }, shiftKey: boolean, altKey: boolean) => {
        const d = dragRef.current;
        if (!d) return;
        d.pending = { world, shiftKey, altKey };
        if (d.rafId != null) return;
        d.rafId = requestAnimationFrame(flushResize);
      };

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        forEachCoalescedPointerEvent(ev, (pe) => {
          scheduleResize(clientToWorld(pe.clientX, pe.clientY), pe.shiftKey, pe.altKey);
        });
      };

      const onUp = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        forEachCoalescedPointerEvent(ev, (pe) => {
          scheduleResize(clientToWorld(pe.clientX, pe.clientY), pe.shiftKey, pe.altKey);
        });
        if (d.pending) flushResize();
        if (d.rafId != null) cancelAnimationFrame(d.rafId);
        dragRef.current = null;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        useEditorStore.getState().setTransformInteractionMode("none");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

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
      oriented,
      beginRotateDrag,
    ],
  );

  /** Corners rotate by default; Shift+Option+drag scales proportionally from center (Figma-style). */
  const onCornerPointerDown = useCallback(
    (handle: ResizeHandle) => (e: React.PointerEvent) => {
      if (isCornerScalePointer(e) && canTransform) {
        onHandleDown(handle)(e);
        return;
      }
      beginRotateDrag(e, handle);
    },
    [onHandleDown, beginRotateDrag, canTransform],
  );

  /** Figma-style rotate-from-corner targets (outside each corner, along the diagonal). */
  const cornerRotateZones = useMemo(() => {
    if (!showRotateHandles || !union) return [];
    if (useOrientedOverlay && orientedHandles) {
      return rotateZonesForCornerHandles(orientedHandles, union, zoom);
    }
    return rotateZonesForAxisBounds(union, zoom);
  }, [showRotateHandles, union, useOrientedOverlay, orientedHandles, zoom]);

  const topRotatePos = useMemo(() => {
    if (!showRotateHandles || !union) return null;
    if (oriented && id) {
      const corners = getNodeTransformedWorldCorners(id, nodes);
      if (corners) {
        const [nw, ne] = corners;
        const topMid = { x: (nw.x + ne.x) / 2, y: (nw.y + ne.y) / 2 };
        return topRotateHandleWorld(union, zoom, topMid);
      }
    }
    return topRotateHandleWorld(union, zoom);
  }, [showRotateHandles, union, oriented, id, nodes, zoom]);

  if (!union || visibleSelected.length === 0) return null;
  if (editorMode !== "inspect" && !canTransformSelection) return null;
  if (editorMode === "inspect" && tool !== "move" && tool !== "hand") return null;

  const instanceSelection = Boolean(id && findInstanceRoot(nodes, id));
  const anyInstanceInMulti = visibleSelected.some((sid) => findInstanceRoot(nodes, sid));

  const wr = union;

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

  const axisEdgeHandles: { h: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
    { h: "n", style: { left: wr.x + wr.width / 2 - off, top: wr.y - off }, cursor: CURSOR.n },
    { h: "e", style: { left: wr.x + wr.width - off, top: wr.y + wr.height / 2 - off }, cursor: CURSOR.e },
    { h: "s", style: { left: wr.x + wr.width / 2 - off, top: wr.y + wr.height - off }, cursor: CURSOR.s },
    { h: "w", style: { left: wr.x - off, top: wr.y + wr.height / 2 - off }, cursor: CURSOR.w },
  ];

  const axisCornerRotate: { h: ResizeHandle; style: React.CSSProperties }[] = [
    { h: "nw", style: { left: wr.x - off, top: wr.y - off } },
    { h: "ne", style: { left: wr.x + wr.width - off, top: wr.y - off } },
    { h: "se", style: { left: wr.x + wr.width - off, top: wr.y + wr.height - off } },
    { h: "sw", style: { left: wr.x - off, top: wr.y + wr.height - off } },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {useOrientedOverlay && frameNode && worldMatrix ? (
        <div
          className="pointer-events-none absolute box-border"
          style={{
            left: 0,
            top: 0,
            width: frameNode.width,
            height: frameNode.height,
            transform: matrixToCssTransform(worldMatrix),
            transformOrigin: "0 0",
            border: `${borderWorld}px solid ${outlineColor}`,
          }}
        />
      ) : (
        <div
          className="pointer-events-none absolute box-border"
          style={{
            left: wr.x,
            top: wr.y,
            width: wr.width,
            height: wr.height,
            border: `${borderWorld}px solid ${outlineColor}`,
          }}
        />
      )}
      {showResizeHandles && useOrientedOverlay && orientedHandles
        ? orientedHandles
            .filter(({ handle }) => EDGE_RESIZE_HANDLES.includes(handle))
            .map(({ handle, x, y }) => (
              <button
                key={handle}
                type="button"
                data-resize-handle
                className="pointer-events-auto z-[32] touch-none absolute box-border select-none bg-app-card"
                style={{
                  left: x - off,
                  top: y - off,
                  width: handleWorld,
                  height: handleWorld,
                  cursor: resizeCursorForRotatedHandle(handle, worldRotation),
                  border: `${borderWorld}px solid ${handleBorderColor}`,
                }}
                onPointerDown={onHandleDown(handle)}
              />
            ))
        : null}
      {showRotateHandles && useOrientedOverlay && orientedHandles
        ? orientedHandles
            .filter(({ handle }) => ROTATE_CORNER_HANDLES.includes(handle))
            .map(({ handle, x, y }) => (
              <button
                key={`rotate-${handle}`}
                type="button"
                data-rotate-handle
                title="Drag to rotate · Shift+Option+drag to scale"
                className="pointer-events-auto z-[35] touch-none absolute box-border select-none bg-app-card"
                style={{
                  left: x - off,
                  top: y - off,
                  width: handleWorld,
                  height: handleWorld,
                  cursor: "default",
                  border: `${borderWorld}px solid ${handleBorderColor}`,
                }}
                onPointerDown={onCornerPointerDown(handle)}
                {...cornerHoverHandlers(handle)}
              />
            ))
        : null}
      {showResizeHandles && !useOrientedOverlay
        ? axisEdgeHandles.map(({ h, style, cursor }) => (
            <button
              key={h}
              type="button"
              data-resize-handle
              className="pointer-events-auto z-[32] touch-none absolute box-border select-none bg-app-card"
              style={{
                ...style,
                width: handleWorld,
                height: handleWorld,
                cursor,
                border: `${borderWorld}px solid ${handleBorderColor}`,
              }}
              onPointerDown={onHandleDown(h)}
            />
          ))
        : null}
      {showRotateHandles && !useOrientedOverlay
        ? axisCornerRotate.map(({ h, style }) => (
            <button
              key={`rotate-${h}`}
              type="button"
              data-rotate-handle
              title="Drag to rotate · Shift+Option+drag to scale"
              className="pointer-events-auto z-[35] touch-none absolute box-border select-none bg-app-card"
              style={{
                ...style,
                width: handleWorld,
                height: handleWorld,
                cursor: "default",
                border: `${borderWorld}px solid ${handleBorderColor}`,
              }}
              onPointerDown={onCornerPointerDown(h)}
              {...cornerHoverHandlers(h)}
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
                  cursor: rotateCursorCssForHandle(zone.handle, worldRotation),
                }}
                onPointerDown={(e) => beginRotateDrag(e, zone.handle)}
                {...rotateHoverHandlers(zone.handle)}
              />
            );
          })
        : null}
      {showRotateHandles && topRotatePos ? (
        <button
          type="button"
          data-rotate-handle
          aria-label="Rotate"
          className="pointer-events-auto absolute z-[32] touch-none rounded-full border border-[#18a0fb] bg-white"
          style={{
            left: topRotatePos.x - off,
            top: topRotatePos.y - off,
            width: handleWorld,
            height: handleWorld,
            cursor: rotateCursorCssForHandle("top", worldRotation),
          }}
          onPointerDown={(e) => beginRotateDrag(e, "top")}
          {...rotateHoverHandlers("top")}
        />
      ) : null}
      {rotateLabel ? (
        <div
          className="pointer-events-none absolute z-[32] whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white"
          style={{
            left: rotateLabel.x,
            top: rotateLabel.y,
            transform: "translate(-50%, -100%)",
            background: CANVAS_VISUAL.selection,
          }}
        >
          {rotateLabel.text}
        </div>
      ) : null}
      {editorMode === "design" ? (
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
