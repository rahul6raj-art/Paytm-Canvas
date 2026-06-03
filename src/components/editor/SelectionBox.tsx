"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { findInstanceRoot } from "@/lib/componentModel";
import {
  CANVAS_HANDLE_SCREEN_PX,
  CANVAS_OUTLINE_SCREEN_PX,
  CANVAS_VISUAL,
  screenPxToWorld,
} from "@/lib/canvasVisual";
import {
  getMatrixRotationDegrees,
  getNodeTransformedWorldCorners,
  getNodeWorldInverseMatrix,
  getWorldHandlesFromMatrix,
  matrixHasRotation,
  matrixIsFinite,
  matrixToCssTransform,
  resizeCursorForRotatedHandle,
  normalizeRotationDegrees,
  worldToParentLocal,
} from "@/lib/transformMath";
import {
  getNodeWorldMatrixFromChildOrder,
  getRenderedWorldBounds,
} from "@/lib/editorGraph";
import {
  CANVAS_ROTATE_CURSOR,
  rotateZonesForAxisBounds,
  rotateZonesForCornerHandles,
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
} from "@/lib/rotation";
import { anchorWorldAtBounds } from "@/lib/resizeTransform";
import type { ResizeHandle } from "@/lib/resize";
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
  const resizeNode = useEditorStore((s) => s.resizeNode);
  const updateNode = useEditorStore((s) => s.updateNode);
  const updateNodes = useEditorStore((s) => s.updateNodes);
  const tool = useEditorStore((s) => s.tool);
  const editorMode = useEditorStore((s) => s.editorMode);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const pencilDrawingNodeId = useEditorStore((s) => s.pencilDrawingNodeId);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const toWorld = useCanvasToWorld();

  const canTransformSelection =
    editorMode === "design" &&
    tool !== "hand" &&
    !(tool === "pen" && penDrawingNodeId) &&
    !(tool === "pencil" && pencilDrawingNodeId) &&
    !(tool === "comment" && isPlacingComment);

  const handleWorld = screenPxToWorld(CANVAS_HANDLE_SCREEN_PX, zoom);
  const borderWorld = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);
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

  const worldMatrix = useMemo(() => {
    if (!id) return null;
    return getNodeWorldMatrixFromChildOrder(id, nodes, childOrder);
  }, [id, nodes, childOrder]);

  const oriented = Boolean(
    id &&
      node &&
      visibleSelected.length === 1 &&
      worldMatrix &&
      matrixIsFinite(worldMatrix) &&
      matrixHasRotation(worldMatrix),
  );

  const orientedHandles = useMemo(() => {
    if (!oriented || !id || !node || !worldMatrix) return null;
    const handles = getWorldHandlesFromMatrix(worldMatrix, node.width, node.height);
    if (!handles.every((h) => Number.isFinite(h.x) && Number.isFinite(h.y))) return null;
    return handles;
  }, [oriented, id, node, worldMatrix]);

  const useOrientedOverlay = oriented && orientedHandles != null;

  const worldRotation = worldMatrix ? getMatrixRotationDegrees(worldMatrix) : 0;

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

  const rotateDragRef = useRef<{ pointerId: number; session: RotateDragSession } | null>(null);
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

  const onHandleDown = useCallback(
    (handle: ResizeHandle) => (e: React.PointerEvent) => {
      if (editorMode === "inspect") return;
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
      const fixedWorld = anchorWorldAtBounds(id, nodesSnapshot, handle, startBounds);

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
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const flushResize = () => {
        const d = dragRef.current;
        if (!d || !d.pending) return;
        const { world, shiftKey, altKey } = d.pending;
        d.pending = null;
        d.rafId = null;

        const parentLocal = worldToParentLocal(world.x, world.y, id, d.nodesSnapshot);

        resizeNode(
          id,
          d.handle,
          d.startBounds,
          parentLocal,
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
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [id, node, canTransformSelection, resizeNode, clientToWorld, editorMode, oriented, worldRotation],
  );

  const multi = visibleSelected.length > 1;
  const locked = multi ? visibleSelected.some((sid) => nodes[sid]?.locked) : Boolean(node?.locked);
  const canTransform = Boolean(union && !locked && !multi && canTransformSelection);
  const canRotate = Boolean(union && !locked && canTransformSelection);
  const showResizeHandles = canTransform && node?.type !== "line" && node?.type !== "arrow";
  const showRotateHandles = canRotate;

  const beginRotateDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!union || locked || !canTransformSelection) return;
      if (multi && visibleSelected.every((sid) => nodes[sid]?.locked)) return;
      if (!multi && (!id || !node || node.locked)) return;
      e.stopPropagation();
      e.preventDefault();
      document.body.style.userSelect = "none";
      document.body.style.cursor = CANVAS_ROTATE_CURSOR;
      useEditorStore.getState().pushHistory();
      const st = useEditorStore.getState();
      const w0 = clientToWorld(e.clientX, e.clientY);
      const session: RotateDragSession = multi
        ? createMultiRotateSession(visibleSelected, st.nodes, st.childOrder, union, w0)
        : createSingleRotateSession(id!, node!, st.nodes, st.childOrder, w0);
      rotateDragRef.current = { pointerId: e.pointerId, session };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const labelOffset = screenPxToWorld(12, zoom);

      const rotateScheduler = createRafPointerScheduler<{
        world: { x: number; y: number };
        shiftKey: boolean;
      }>(({ world, shiftKey }) => {
        const d = rotateDragRef.current;
        if (!d) return;
        const cur = useEditorStore.getState();
        if (d.session.kind === "single") {
          const { rotation } = applySingleRotate(d.session, world, shiftKey);
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
        rotateDragRef.current = null;
        setRotateLabel(null);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
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
    ],
  );

  const rotateZones = useMemo(() => {
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

  const axisHandles: { h: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
    { h: "nw", style: { left: wr.x - off, top: wr.y - off }, cursor: CURSOR.nw },
    { h: "n", style: { left: wr.x + wr.width / 2 - off, top: wr.y - off }, cursor: CURSOR.n },
    { h: "ne", style: { left: wr.x + wr.width - off, top: wr.y - off }, cursor: CURSOR.ne },
    { h: "e", style: { left: wr.x + wr.width - off, top: wr.y + wr.height / 2 - off }, cursor: CURSOR.e },
    { h: "se", style: { left: wr.x + wr.width - off, top: wr.y + wr.height - off }, cursor: CURSOR.se },
    { h: "s", style: { left: wr.x + wr.width / 2 - off, top: wr.y + wr.height - off }, cursor: CURSOR.s },
    { h: "sw", style: { left: wr.x - off, top: wr.y + wr.height - off }, cursor: CURSOR.sw },
    { h: "w", style: { left: wr.x - off, top: wr.y + wr.height / 2 - off }, cursor: CURSOR.w },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {useOrientedOverlay && node && worldMatrix ? (
        <div
          className="pointer-events-none absolute box-border"
          style={{
            left: 0,
            top: 0,
            width: node.width,
            height: node.height,
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
        ? orientedHandles.map(({ handle, x, y }) => (
            <button
              key={handle}
              type="button"
              data-resize-handle
              className="pointer-events-auto touch-none absolute box-border select-none bg-app-card"
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
      {showResizeHandles && !useOrientedOverlay
        ? axisHandles.map(({ h, style, cursor }) => (
            <button
              key={h}
              type="button"
              data-resize-handle
              className="pointer-events-auto touch-none absolute box-border select-none bg-app-card"
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
      {showRotateHandles
        ? rotateZones.map((zone) => (
            <button
              key={`rotate-${zone.handle}`}
              type="button"
              data-rotate-zone
              aria-label={`Rotate from ${zone.handle} corner`}
              className="pointer-events-auto absolute touch-none rounded-full bg-transparent"
              style={{
                left: zone.x - zone.size / 2,
                top: zone.y - zone.size / 2,
                width: zone.size,
                height: zone.size,
                cursor: CANVAS_ROTATE_CURSOR,
              }}
              onPointerDown={beginRotateDrag}
            />
          ))
        : null}
      {showRotateHandles && topRotatePos ? (
        <button
          type="button"
          data-rotate-handle
          aria-label="Rotate"
          className="pointer-events-auto absolute touch-none rounded-full border border-[#18a0fb] bg-white"
          style={{
            left: topRotatePos.x - off,
            top: topRotatePos.y - off,
            width: handleWorld,
            height: handleWorld,
            cursor: CANVAS_ROTATE_CURSOR,
          }}
          onPointerDown={beginRotateDrag}
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
    </div>
  );
}
