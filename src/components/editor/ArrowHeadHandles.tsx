"use client";

import { useCallback, useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  CANVAS_HANDLE_SCREEN_PX,
  CANVAS_OUTLINE_SCREEN_PX,
  CANVAS_VISUAL,
  screenPxToWorld,
} from "@/lib/canvasVisual";
import {
  arrowEndCapHandleLocal,
  arrowHeadSizeHandleLocal,
  arrowStartCapHandleLocal,
} from "@/lib/shapes/arrowEditGeometry";
import { isArrowNode } from "@/lib/shapes/arrowGeometry";
import {
  getNodeWorldMatrixFromChildOrder,
  getRenderedWorldBounds,
} from "@/lib/editorGraph";
import { applyMatrixToPoint } from "@/lib/transformMath";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import { useShapeEditHandlesGate } from "./useShapeEditHandles";
import { beginArrowCapCycle, beginArrowHeadSizeDrag } from "@/lib/shapes/arrowHeadDrag";

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

/** Arrowhead cap + size controls (shape edit mode, arrow layers only). */
export function ArrowHeadHandles() {
  const { show, id } = useShapeEditHandlesGate();
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);
  const node = id ? nodes[id] : null;
  const toWorld = useCanvasToWorld();

  const handles = useMemo(() => {
    if (!show || !id || !node || !isArrowNode(node)) return null;
    return [
      { kind: "start-cap" as const, local: arrowStartCapHandleLocal(node) },
      { kind: "end-cap" as const, local: arrowEndCapHandleLocal(node) },
      { kind: "size" as const, local: arrowHeadSizeHandleLocal(node) },
    ].map((h) => ({
      ...h,
      world: localToWorld(id, h.local, nodes, childOrder),
    }));
  }, [show, id, node, nodes, childOrder]);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      return clientToWorldFromDocument(clientX, clientY, { pan, zoom: z });
    },
    [toWorld],
  );

  if (!show || !handles) return null;

  const size = screenPxToWorld(CANVAS_HANDLE_SCREEN_PX, zoom);
  const borderWorld = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);
  const dotSize = size * 0.85;

  return (
    <>
      {handles.map(({ kind, world }) => (
        <button
          key={kind}
          type="button"
          data-arrow-edit-handle={kind}
          aria-label={
            kind === "size"
              ? "Arrowhead size"
              : kind === "start-cap"
                ? "Start arrowhead"
                : "End arrowhead"
          }
          title={
            kind === "size"
              ? "Drag to adjust arrowhead size"
              : "Click to cycle arrowhead style"
          }
          className="pointer-events-auto absolute z-[34] touch-none rounded-sm border-2 border-[#18a0fb] bg-white will-change-transform"
          style={{
            left: world.x - dotSize / 2,
            top: world.y - dotSize / 2,
            width: dotSize,
            height: dotSize,
            borderRadius: kind === "size" ? dotSize / 2 : 2,
            boxShadow: `0 0 0 ${borderWorld}px ${CANVAS_VISUAL.selection}`,
          }}
          onPointerDown={(e) => {
            if (!id || e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            if (kind === "size") {
              beginArrowHeadSizeDrag({
                nodeId: id,
                pointerId: e.pointerId,
                clientToWorld,
                captureTarget: e.currentTarget,
              });
            } else {
              beginArrowCapCycle({
                nodeId: id,
                end: kind === "start-cap" ? "start" : "end",
              });
            }
          }}
        />
      ))}
    </>
  );
}
