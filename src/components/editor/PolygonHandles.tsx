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
  effectivePolygonParams,
  isPolygonNode,
  polygonCornerRadiusHandleLocal,
} from "@/lib/shapes/polygonGeometry";
import {
  beginPolygonCornerRadiusDrag,
  getPolygonPreview,
  subscribePolygonPreview,
} from "@/lib/shapes/polygonDrag";
import {
  getNodeWorldMatrixFromChildOrder,
  getRenderedWorldBounds,
} from "@/lib/editorGraph";
import { applyMatrixToPoint } from "@/lib/transformMath";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";

function localToWorld(
  nodeId: string,
  local: { x: number; y: number },
  nodes: Record<string, import("@/stores/useEditorStore").EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  const matrix = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (matrix) return applyMatrixToPoint(matrix, local);
  const b = getRenderedWorldBounds(nodeId, nodes, childOrder);
  return { x: b.x + local.x, y: b.y + local.y };
}

/** Corner-radius handle on polygon top vertex (single selection). */
export function PolygonHandles() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);
  const tool = useEditorStore((s) => s.tool);
  const editorMode = useEditorStore((s) => s.editorMode);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const pencilDrawingNodeId = useEditorStore((s) => s.pencilDrawingNodeId);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);
  const toWorld = useCanvasToWorld();

  const id = selectedIds.length === 1 ? selectedIds[0]! : null;
  const node = id ? nodes[id] : null;

  const polygonPreview = useSyncExternalStore(
    subscribePolygonPreview,
    getPolygonPreview,
    () => null,
  );

  const [dragging, setDragging] = useState(false);

  const show =
    editorMode === "design" &&
    tool === "move" &&
    !penDrawingNodeId &&
    !pencilDrawingNodeId &&
    !isPlacingComment &&
    !pathEditModeNodeId &&
    id &&
    node &&
    isPolygonNode(node) &&
    !node.locked;

  const params = useMemo(() => {
    if (!node) return null;
    if (polygonPreview?.nodeId === id) {
      return {
        sides: polygonPreview.sides,
        cornerRadius: polygonPreview.cornerRadius,
      };
    }
    return effectivePolygonParams(node);
  }, [node, polygonPreview, id]);

  const handleWorld = useMemo(() => {
    if (!show || !id || !node || !params) return null;
    const local = polygonCornerRadiusHandleLocal(
      params.sides,
      node.width,
      node.height,
      params.cornerRadius,
    );
    return localToWorld(id, local, nodes, childOrder);
  }, [show, id, node, params, nodes, childOrder]);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      return clientToWorldFromDocument(clientX, clientY, { pan, zoom: z });
    },
    [toWorld],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!id) return;
      e.stopPropagation();
      e.preventDefault();
      setDragging(true);
      beginPolygonCornerRadiusDrag({
        nodeId: id,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld,
        captureTarget: e.currentTarget,
      });
      const onEnd = () => {
        setDragging(false);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
      };
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    },
    [id, clientToWorld],
  );

  if (!show || !handleWorld) return null;

  const size = screenPxToWorld(CANVAS_HANDLE_SCREEN_PX, zoom);
  const borderWorld = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);

  return (
    <button
      type="button"
      data-polygon-corner-handle
      aria-label="Adjust polygon corner radius"
      title="Drag to round polygon corners"
      className="pointer-events-auto absolute z-[31] touch-none rounded-full border-2 border-[#18a0fb] bg-white/90 will-change-transform"
      style={{
        left: handleWorld.x - size / 2,
        top: handleWorld.y - size / 2,
        width: size,
        height: size,
        boxShadow: `0 0 0 ${borderWorld}px ${CANVAS_VISUAL.selection}`,
        opacity: (params?.cornerRadius ?? 0) > 0 || dragging ? 1 : 0.65,
        transition: dragging ? "none" : undefined,
      }}
      onPointerDown={onPointerDown}
    />
  );
}
