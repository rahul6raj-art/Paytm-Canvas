"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  CANVAS_HANDLE_SCREEN_PX,
  CANVAS_OUTLINE_SCREEN_PX,
  CANVAS_VISUAL,
  screenPxToWorld,
} from "@/lib/canvasVisual";
import {
  lineEndpointsWorld,
  lineMidpoint,
  type LineEndpoints,
} from "@/lib/shapes/lineGeometry";
import {
  beginLineBodyDrag,
  beginLineEndDrag,
  beginLineStartDrag,
  getLinePreview,
  subscribeLinePreview,
} from "@/lib/shapes/lineDrag";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import { useShapeEditHandlesGate } from "./useShapeEditHandles";

/** Figma-style start / end / midpoint handles for line layers. */
export function LineHandles() {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);
  const toWorld = useCanvasToWorld();
  const { show: editActive, id } = useShapeEditHandlesGate();
  const node = id ? nodes[id] : null;

  const linePreview = useSyncExternalStore(subscribeLinePreview, getLinePreview, () => null);

  const [dragKind, setDragKind] = useState<"start" | "end" | "body" | null>(null);

  const show =
    editActive &&
    (node?.type === "line" || node?.type === "arrow") &&
    node &&
    !node.locked;

  const endpoints = useMemo((): LineEndpoints | null => {
    if (!show || !id) return null;
    if (linePreview?.nodeId === id) {
      return {
        x1: linePreview.x1,
        y1: linePreview.y1,
        x2: linePreview.x2,
        y2: linePreview.y2,
      };
    }
    return lineEndpointsWorld(id, nodes, childOrder);
  }, [show, id, linePreview, nodes, childOrder]);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      return clientToWorldFromDocument(clientX, clientY, { pan, zoom: z });
    },
    [toWorld],
  );

  const makePointerDown = useCallback(
    (kind: "start" | "end" | "body") => (e: React.PointerEvent) => {
      if (!id) return;
      e.stopPropagation();
      e.preventDefault();
      setDragKind(kind);
      const begin =
        kind === "start" ? beginLineStartDrag : kind === "end" ? beginLineEndDrag : beginLineBodyDrag;
      begin({
        nodeId: id,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld,
        captureTarget: e.currentTarget,
      });
      const onEnd = () => {
        setDragKind(null);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
      };
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    },
    [id, clientToWorld],
  );

  if (!show || !endpoints) return null;

  const handleWorld = screenPxToWorld(CANVAS_HANDLE_SCREEN_PX, zoom);
  const borderWorld = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);
  const mid = lineMidpoint(endpoints);
  const dragging = dragKind != null;

  const handles: { kind: "start" | "end" | "body"; x: number; y: number; size: number }[] = [
    { kind: "start", x: endpoints.x1, y: endpoints.y1, size: handleWorld },
    { kind: "end", x: endpoints.x2, y: endpoints.y2, size: handleWorld },
    { kind: "body", x: mid.x, y: mid.y, size: handleWorld * 0.75 },
  ];

  return (
    <>
      {handles.map(({ kind, x, y, size }) => (
        <button
          key={kind}
          type="button"
          data-line-handle={kind}
          aria-label={
            kind === "start" ? "Line start" : kind === "end" ? "Line end" : "Move line"
          }
          title={
            kind === "body"
              ? "Drag to move line"
              : `Drag to move ${kind} (Shift: 45°)`
          }
          className="pointer-events-auto absolute z-[31] touch-none rounded-full border-2 border-[#18a0fb] bg-white will-change-transform"
          style={{
            left: x - size / 2,
            top: y - size / 2,
            width: size,
            height: size,
            boxShadow: `0 0 0 ${borderWorld}px ${CANVAS_VISUAL.selection}`,
            transition: dragging ? "none" : undefined,
          }}
          onPointerDown={makePointerDown(kind)}
        />
      ))}
    </>
  );
}
