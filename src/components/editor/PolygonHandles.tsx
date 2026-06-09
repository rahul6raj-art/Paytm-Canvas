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
  polygonSidesHandleLocal,
} from "@/lib/shapes/polygonGeometry";
import {
  beginPolygonCornerRadiusDrag,
  getPolygonPreview,
  subscribePolygonPreview,
} from "@/lib/shapes/polygonDrag";
import {
  beginPolygonSidesDrag,
  getPolygonSidesPreview,
  subscribePolygonSidesPreview,
} from "@/lib/shapes/polygonSidesDrag";
import {
  getNodeWorldMatrixFromChildOrder,
  getRenderedWorldBounds,
} from "@/lib/editorGraph";
import { applyMatrixToPoint } from "@/lib/transformMath";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import { useShapeEditHandlesGate } from "./useShapeEditHandles";
import { CanvasEditValueBadge } from "./CanvasEditValueBadge";

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

/** Polygon side count + corner-radius handles (shape edit mode). */
export function PolygonHandles() {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);
  const toWorld = useCanvasToWorld();
  const { show: editActive, id } = useShapeEditHandlesGate();
  const node = id ? nodes[id] : null;

  const polygonPreview = useSyncExternalStore(
    subscribePolygonPreview,
    getPolygonPreview,
    () => null,
  );
  const sidesPreview = useSyncExternalStore(
    subscribePolygonSidesPreview,
    getPolygonSidesPreview,
    () => null,
  );

  const [dragging, setDragging] = useState<"corner" | "sides" | null>(null);

  const show = editActive && node && isPolygonNode(node) && !node.locked;

  const params = useMemo(() => {
    if (!node) return null;
    if (sidesPreview?.nodeId === id) {
      return {
        sides: sidesPreview.sides,
        cornerRadius: sidesPreview.cornerRadius,
      };
    }
    if (polygonPreview?.nodeId === id) {
      return {
        sides: polygonPreview.sides,
        cornerRadius: polygonPreview.cornerRadius,
      };
    }
    return effectivePolygonParams(node);
  }, [node, polygonPreview, sidesPreview, id]);

  const cornerWorld = useMemo(() => {
    if (!show || !id || !node || !params) return null;
    const local = polygonCornerRadiusHandleLocal(
      params.sides,
      node.width,
      node.height,
      params.cornerRadius,
    );
    return localToWorld(id, local, nodes, childOrder);
  }, [show, id, node, params, nodes, childOrder]);

  const sidesWorld = useMemo(() => {
    if (!show || !id || !node || !params) return null;
    const local = polygonSidesHandleLocal(params.sides, node.width, node.height);
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

  if (!show || !cornerWorld || !sidesWorld) return null;

  const cornerRadiusBadge =
    dragging === "corner" && polygonPreview?.nodeId === id
      ? { x: cornerWorld.x, y: cornerWorld.y, value: Math.round(polygonPreview.cornerRadius) }
      : null;

  const size = screenPxToWorld(CANVAS_HANDLE_SCREEN_PX, zoom);
  const borderWorld = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);

  return (
    <>
      <button
        type="button"
        data-polygon-sides-handle
        aria-label="Adjust polygon sides"
        title={`Sides: ${params?.sides ?? 6} — drag to change`}
        className="pointer-events-auto absolute z-[34] touch-none rounded-sm border-2 border-[#18a0fb] bg-white will-change-transform"
        style={{
          left: sidesWorld.x - size / 2,
          top: sidesWorld.y - size / 2,
          width: size,
          height: size,
          boxShadow: `0 0 0 ${borderWorld}px ${CANVAS_VISUAL.selection}`,
          transition: dragging === "sides" ? "none" : undefined,
        }}
        onPointerDown={(e) => {
          if (!id) return;
          e.stopPropagation();
          e.preventDefault();
          setDragging("sides");
          beginPolygonSidesDrag({
            nodeId: id,
            pointerId: e.pointerId,
            clientToWorld,
            captureTarget: e.currentTarget,
          });
          const onEnd = () => {
            setDragging(null);
            window.removeEventListener("pointerup", onEnd);
            window.removeEventListener("pointercancel", onEnd);
          };
          window.addEventListener("pointerup", onEnd);
          window.addEventListener("pointercancel", onEnd);
        }}
      />
      <button
        type="button"
        data-polygon-corner-handle
        aria-label="Adjust polygon corner radius"
        title="Drag to round polygon corners"
        className="pointer-events-auto absolute z-[34] touch-none rounded-full border-2 border-[#18a0fb] bg-white/90 will-change-transform"
        style={{
          left: cornerWorld.x - size / 2,
          top: cornerWorld.y - size / 2,
          width: size,
          height: size,
          boxShadow: `0 0 0 ${borderWorld}px ${CANVAS_VISUAL.selection}`,
          opacity: (params?.cornerRadius ?? 0) > 0 || dragging === "corner" ? 1 : 0.65,
          transition: dragging === "corner" ? "none" : undefined,
        }}
        onPointerDown={(e) => {
          if (!id) return;
          e.stopPropagation();
          e.preventDefault();
          setDragging("corner");
          beginPolygonCornerRadiusDrag({
            nodeId: id,
            pointerId: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY,
            clientToWorld,
            captureTarget: e.currentTarget,
          });
          const onEnd = () => {
            setDragging(null);
            window.removeEventListener("pointerup", onEnd);
            window.removeEventListener("pointercancel", onEnd);
          };
          window.addEventListener("pointerup", onEnd);
          window.removeEventListener("pointercancel", onEnd);
        }}
      />
      {cornerRadiusBadge ? (
        <CanvasEditValueBadge
          x={cornerRadiusBadge.x}
          y={cornerRadiusBadge.y}
          zoom={zoom}
        >
          {cornerRadiusBadge.value}
        </CanvasEditValueBadge>
      ) : null}
    </>
  );
}
