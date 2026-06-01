"use client";

import { useCallback, useRef } from "react";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import {
  applyMatrixToPoint,
  getNodeWorldMatrix,
  matrixToCssTransform,
} from "@/lib/transformMath";
import { screenPxToWorld } from "@/lib/canvasVisual";
import { useCanvasToWorld } from "@/components/editor/CanvasToWorldContext";
import { cn } from "@/lib/utils";
import { pickDeepestFrameAtWorldPoint, worldRect } from "@/lib/tree";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";

function overlayWorldStyle(
  nodeId: string,
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): React.CSSProperties {
  const wm = getNodeWorldMatrix(nodeId, nodes);
  if (wm) {
    return {
      left: 0,
      top: 0,
      width: node.width,
      height: node.height,
      transform: matrixToCssTransform(wm),
      transformOrigin: "0 0",
    };
  }
  const wr = worldRect(nodeId, nodes);
  return { left: wr.x, top: wr.y, width: wr.width, height: wr.height };
}

function PathEditOverlay({ nodeId }: { nodeId: string }) {
  const nodes = useEditorStore((s) => s.nodes);
  const zoom = useEditorStore((s) => s.zoom);
  const tool = useEditorStore((s) => s.tool);
  const editorMode = useEditorStore((s) => s.editorMode);
  const selectedPathPointId = useEditorStore((s) => s.selectedPathPointId);
  const updatePathPoint = useEditorStore((s) => s.updatePathPoint);
  const setSelectedPathPointId = useEditorStore((s) => s.setSelectedPathPointId);
  const setPathEditMode = useEditorStore((s) => s.setPathEditMode);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const toWorld = useCanvasToWorld();

  const pathPointDragRef = useRef<{
    pointerId: number;
    pointId: string;
    startWorld: { x: number; y: number };
    startPt: { x: number; y: number };
  } | null>(null);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      return clientToWorldFromDocument(clientX, clientY, { pan, zoom: z });
    },
    [toWorld],
  );

  const node = nodes[nodeId];
  if (!node || node.type !== "path" || editorMode !== "design" || tool !== "move") return null;

  const pts = node.pathPoints ?? [];
  if (pts.length === 0) return null;

  const onAnchorDown = (pointId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    const w = clientToWorld(e.clientX, e.clientY);
    const pt = nodes[nodeId]?.pathPoints?.find((p) => p.id === pointId);
    if (!pt) return;
    setPathEditMode(nodeId);
    setSelectedPathPointId(pointId);
    pathPointDragRef.current = {
      pointerId: e.pointerId,
      pointId,
      startWorld: w,
      startPt: { x: pt.x, y: pt.y },
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const d = pathPointDragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      const nw = clientToWorld(ev.clientX, ev.clientY);
      updatePathPoint(
        nodeId,
        pointId,
        { x: d.startPt.x + (nw.x - d.startWorld.x), y: d.startPt.y + (nw.y - d.startWorld.y) },
        { skipHistory: true },
      );
    };
    const onUp = (ev: PointerEvent) => {
      const d = pathPointDragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      pathPointDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      className="pointer-events-none absolute z-[25]"
      data-svg-dom-overlay="path-edit"
      style={overlayWorldStyle(nodeId, node, nodes)}
    >
      {pts.map((pt) => (
        <button
          key={pt.id}
          type="button"
          aria-label="Anchor point"
          className={cn(
            "pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 border-2 border-[#18a0fb] bg-white",
            selectedPathPointId === pt.id ? "ring-2 ring-amber-300" : "",
          )}
          style={{ left: pt.x, top: pt.y }}
          onPointerDown={(ev) => onAnchorDown(pt.id, ev)}
        />
      ))}
    </div>
  );
}

function PrototypeHandleOverlay({ nodeId }: { nodeId: string }) {
  const nodes = useEditorStore((s) => s.nodes);
  const zoom = useEditorStore((s) => s.zoom);
  const startPrototypeConnection = useEditorStore((s) => s.startPrototypeConnection);
  const finishPrototypeConnection = useEditorStore((s) => s.finishPrototypeConnection);
  const updatePrototypeWirePointer = useEditorStore((s) => s.updatePrototypeWirePointer);
  const toWorld = useCanvasToWorld();

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      return clientToWorldFromDocument(clientX, clientY, { pan, zoom: z });
    },
    [toWorld],
  );

  const node = nodes[nodeId];
  if (!node?.visible) return null;
  const handleSize = screenPxToWorld(10, zoom);
  const wm = getNodeWorldMatrix(nodeId, nodes);
  const wr = worldRect(nodeId, nodes);
  const wireOrigin = wm
    ? applyMatrixToPoint(wm, { x: node.width, y: node.height / 2 })
    : { x: wr.x + wr.width, y: wr.y + wr.height / 2 };

  const onHandleDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    startPrototypeConnection(nodeId, e.pointerId, wireOrigin.x, wireOrigin.y);
    const pid = e.pointerId;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const w = clientToWorld(ev.clientX, ev.clientY);
      updatePrototypeWirePointer(w.x, w.y);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const w = clientToWorld(ev.clientX, ev.clientY);
      const s2 = useEditorStore.getState();
      const target = pickDeepestFrameAtWorldPoint(w.x, w.y, s2.nodes, s2.childOrder, {
        excludeDescendantsOf: nodeId,
      });
      finishPrototypeConnection(target);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      className="pointer-events-none absolute z-[25]"
      data-svg-dom-overlay="prototype-handle"
      style={overlayWorldStyle(nodeId, node, nodes)}
    >
      <button
        type="button"
        data-prototype-handle
        className="pointer-events-auto absolute top-1/2 z-20 -translate-y-1/2 translate-x-1/2 cursor-crosshair rounded-full border border-white bg-[#18a0fb]"
        style={{
          right: 0,
          width: handleSize,
          height: handleSize,
        }}
        aria-label="Drag to connect prototype"
        onPointerDown={onHandleDown}
      />
    </div>
  );
}

/** Minimal DOM overlays for SVG mode (text edit, path anchors, prototype handle only). */
export function SvgDomOverlays() {
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);
  const editorMode = useEditorStore((s) => s.editorMode);
  const tool = useEditorStore((s) => s.tool);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);

  const protoId =
    editorMode === "prototype" && tool === "move" && selectedIds.length === 1
      ? selectedIds[0]!
      : null;

  if (!pathEditModeNodeId && !protoId) return null;

  return (
    <>
      {pathEditModeNodeId && nodes[pathEditModeNodeId] ? (
        <PathEditOverlay nodeId={pathEditModeNodeId} />
      ) : null}
      {protoId && nodes[protoId] ? <PrototypeHandleOverlay nodeId={protoId} /> : null}
    </>
  );
}
