"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  CANVAS_HANDLE_SCREEN_PX,
  CANVAS_OUTLINE_SCREEN_PX,
  CANVAS_VISUAL,
} from "@/lib/canvasVisual";
import { screenPxToOverlay, worldPointToOverlay } from "@/lib/canvasOverlaySpace";
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
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";
import { EditorHintWrap } from "./EditorHoverHint";

/** Figma-style start / end / midpoint handles for line layers. */
export function LineHandles() {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const tool = useEditorStore((s) => s.tool);
  const editorMode = useEditorStore((s) => s.editorMode);
  const toWorld = useCanvasToWorld();
  const overlay = useCanvasOverlaySpace();
  const { show: shapeEditActive, id: shapeEditId } = useShapeEditHandlesGate();

  const selectedLineId = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const candidate = selectedIds[0]!;
    const n = nodes[candidate];
    if (!n || n.locked || n.visible === false) return null;
    if (n.type !== "line" && n.type !== "arrow") return null;
    if (editorMode !== "design" || tool !== "move") return null;
    return candidate;
  }, [selectedIds, nodes, editorMode, tool]);

  const id = shapeEditActive ? shapeEditId : selectedLineId;
  const node = id ? nodes[id] : null;

  const linePreview = useSyncExternalStore(subscribeLinePreview, getLinePreview, () => null);

  const [dragKind, setDragKind] = useState<"start" | "end" | "body" | null>(null);

  const show = Boolean(id && node && (node.type === "line" || node.type === "arrow") && !node.locked);

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

  const handleSize = screenPxToOverlay(CANVAS_HANDLE_SCREEN_PX, overlay);
  const borderSize = screenPxToOverlay(CANVAS_OUTLINE_SCREEN_PX, overlay);
  const mid = lineMidpoint(endpoints);
  const dragging = dragKind != null;

  const handles: { kind: "start" | "end" | "body"; worldX: number; worldY: number; size: number }[] =
    [
      { kind: "start", worldX: endpoints.x1, worldY: endpoints.y1, size: handleSize },
      { kind: "end", worldX: endpoints.x2, worldY: endpoints.y2, size: handleSize },
      { kind: "body", worldX: mid.x, worldY: mid.y, size: handleSize * 0.75 },
    ];

  return (
    <>
      {handles.map(({ kind, worldX, worldY, size }) => {
        const pos = worldPointToOverlay(worldX, worldY, overlay);
        if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null;
        return (
          <EditorHintWrap
            key={kind}
            title={
              kind === "body"
                ? "Drag to move line"
                : `Drag to move ${kind} (Shift: 45°)`
            }
            anchorClassName="contents"
          >
            <button
              type="button"
              data-line-handle={kind}
              aria-label={
                kind === "start" ? "Line start" : kind === "end" ? "Line end" : "Move line"
              }
              className="pointer-events-auto absolute z-[31] touch-none rounded-full border-2 border-[#18a0fb] bg-white will-change-transform"
              style={{
                left: pos.x - size / 2,
                top: pos.y - size / 2,
                width: size,
                height: size,
                boxShadow: `0 0 0 ${borderSize}px ${CANVAS_VISUAL.selection}`,
                transition: dragging ? "none" : undefined,
              }}
              onPointerDown={makePointerDown(kind)}
            />
          </EditorHintWrap>
        );
      })}
    </>
  );
}
