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
  effectiveStarParams,
  isStarNode,
  starCornerRadiusHandleLocal,
  starRatioHandleLocal,
} from "@/lib/shapes/starGeometry";
import {
  beginStarCornerRadiusDrag,
  beginStarRatioDrag,
  getStarPreview,
  subscribeStarPreview,
} from "@/lib/shapes/starDrag";
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

/** Figma-style ratio + corner radius handles on star shapes (single selection). */
export function StarHandles() {
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

  const starPreview = useSyncExternalStore(subscribeStarPreview, getStarPreview, () => null);

  const [dragKind, setDragKind] = useState<"ratio" | "cornerRadius" | null>(null);

  const show =
    editorMode === "design" &&
    tool === "move" &&
    !penDrawingNodeId &&
    !pencilDrawingNodeId &&
    !isPlacingComment &&
    !pathEditModeNodeId &&
    id &&
    node &&
    isStarNode(node);

  const params = useMemo(() => {
    if (!node) return null;
    if (starPreview?.nodeId === id) {
      return {
        pointCount: starPreview.pointCount,
        ratio: starPreview.ratio,
        cornerRadius: starPreview.cornerRadius,
      };
    }
    return effectiveStarParams(node);
  }, [node, starPreview, id]);

  const handles = useMemo(() => {
    if (!show || !id || !node || !params) return null;
    const ratioLocal = starRatioHandleLocal(
      params.pointCount,
      params.ratio,
      node.width,
      node.height,
    );
    const cornerLocal = starCornerRadiusHandleLocal(
      params.pointCount,
      params.ratio,
      node.width,
      node.height,
      params.cornerRadius,
    );
    return {
      ratio: localToWorld(id, ratioLocal, nodes, childOrder),
      corner: localToWorld(id, cornerLocal, nodes, childOrder),
      cornerRadius: params.cornerRadius,
    };
  }, [show, id, node, params, nodes, childOrder]);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      return clientToWorldFromDocument(clientX, clientY, { pan, zoom: z });
    },
    [toWorld],
  );

  const makePointerDown = useCallback(
    (kind: "ratio" | "cornerRadius") => (e: React.PointerEvent) => {
      if (!id) return;
      e.stopPropagation();
      e.preventDefault();
      setDragKind(kind);
      const begin = kind === "ratio" ? beginStarRatioDrag : beginStarCornerRadiusDrag;
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

  if (!show || !handles) return null;

  const handleWorld = screenPxToWorld(CANVAS_HANDLE_SCREEN_PX, zoom);
  const borderWorld = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);
  const dragging = dragKind != null;

  return (
    <>
      <button
        type="button"
        data-star-ratio-handle
        aria-label="Adjust star ratio"
        title="Drag to adjust inner radius (star ratio)"
        className="pointer-events-auto absolute z-[31] touch-none rounded-full border-2 border-[#18a0fb] bg-white will-change-transform"
        style={{
          left: handles.ratio.x - handleWorld / 2,
          top: handles.ratio.y - handleWorld / 2,
          width: handleWorld,
          height: handleWorld,
          boxShadow: `0 0 0 ${borderWorld}px ${CANVAS_VISUAL.selection}`,
          transition: dragging ? "none" : undefined,
        }}
        onPointerDown={makePointerDown("ratio")}
      />
      <button
        type="button"
        data-star-corner-handle
        aria-label="Adjust star corner radius"
        title="Drag along spike to round corners"
        className="pointer-events-auto absolute z-[31] touch-none rounded-full border-2 border-[#18a0fb] bg-white/90 will-change-transform"
        style={{
          left: handles.corner.x - (handleWorld * 0.85) / 2,
          top: handles.corner.y - (handleWorld * 0.85) / 2,
          width: handleWorld * 0.85,
          height: handleWorld * 0.85,
          boxShadow: `0 0 0 ${borderWorld}px ${CANVAS_VISUAL.selection}`,
          opacity: handles.cornerRadius > 0 || dragKind === "cornerRadius" ? 1 : 0.65,
          transition: dragging ? "none" : undefined,
        }}
        onPointerDown={makePointerDown("cornerRadius")}
      />
    </>
  );
}
