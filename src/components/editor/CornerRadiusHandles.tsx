"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  CANVAS_HANDLE_SCREEN_PX,
  CANVAS_OUTLINE_SCREEN_PX,
  CANVAS_VISUAL,
  screenPxToWorld,
} from "@/lib/canvasVisual";
import {
  getNodeCornerRadii,
  supportsCornerRadiusHandles,
  type CornerRadii,
} from "@/lib/cornerRadius";
import { cornerRadiusHandlePosition } from "@/lib/shapes/shapeToPath";
import {
  beginCornerRadiusDrag,
  getCornerRadiusPreview,
  subscribeCornerRadiusPreview,
  type CornerIndex,
} from "@/lib/cornerRadiusDrag";
import {
  getNodeWorldMatrixFromChildOrder,
  getRenderedWorldBounds,
} from "@/lib/editorGraph";
import { applyMatrixToPoint } from "@/lib/transformMath";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import { useShapeEditHandlesGate } from "./useShapeEditHandles";
import { CanvasEditValueBadge } from "./CanvasEditValueBadge";

const CORNERS: CornerIndex[] = [0, 1, 2, 3];

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

/** Figma-style corner radius dots on rectangle / frame (single selection). */
export function CornerRadiusHandles() {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);
  const pan = useEditorStore((s) => s.pan);
  const clientToWorld = useCanvasToWorld();
  const { show: editActive, id } = useShapeEditHandlesGate();
  const node = id ? nodes[id] : null;

  const cornerPreview = useSyncExternalStore(
    subscribeCornerRadiusPreview,
    getCornerRadiusPreview,
    () => null,
  );

  const show =
    editActive &&
    node &&
    supportsCornerRadiusHandles(node);

  const handlePx = screenPxToWorld(CANVAS_HANDLE_SCREEN_PX, zoom);
  const borderWorld = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);
  const dotPx = screenPxToWorld(6, zoom);
  const dotOff = dotPx / 2;

  const radii = useMemo(() => {
    if (!node) return [0, 0, 0, 0] as CornerRadii;
    if (cornerPreview?.nodeId === id) return cornerPreview.radii;
    return getNodeCornerRadii(node);
  }, [node, cornerPreview, id]);

  const handleWorldPositions = useMemo(() => {
    if (!show || !id || !node) return null;
    return CORNERS.map((cornerIndex) => ({
      cornerIndex,
      local: cornerRadiusHandlePosition(node.width, node.height, radii, cornerIndex),
    }));
  }, [show, id, node, radii]);

  const radiusBadge = useMemo(() => {
    if (!cornerPreview || cornerPreview.nodeId !== id || !handleWorldPositions) return null;
    const entry = handleWorldPositions.find(
      (h) => h.cornerIndex === cornerPreview.cornerIndex,
    );
    if (!entry) return null;
    const w = localToWorld(id!, entry.local, nodes, childOrder);
    const r = cornerPreview.radii[cornerPreview.cornerIndex] ?? 0;
    return { x: w.x, y: w.y, radius: Math.round(r) };
  }, [cornerPreview, id, handleWorldPositions, nodes, childOrder]);

  const makePointerDown = useCallback(
    (cornerIndex: CornerIndex) => (e: React.PointerEvent) => {
      if (!id || e.button !== 0) return;
      e.stopPropagation();
      const toWorld =
        clientToWorld ??
        ((cx: number, cy: number) => clientToWorldFromDocument(cx, cy, { pan, zoom }));
      beginCornerRadiusDrag({
        nodeId: id,
        cornerIndex,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld: toWorld,
        captureTarget: e.currentTarget,
      });
    },
    [id, clientToWorld, pan, zoom],
  );

  if (!show || !handleWorldPositions) return null;

  return (
    <>
      {handleWorldPositions.map(({ cornerIndex, local }) => {
        const world = localToWorld(id!, local, nodes, childOrder);
        return (
          <button
            key={cornerIndex}
            type="button"
            data-corner-radius-handle={cornerIndex}
            aria-label={`Corner radius ${["top-left", "top-right", "bottom-right", "bottom-left"][cornerIndex]}`}
            title="Drag to adjust corner radius"
            className="pointer-events-auto absolute z-[31] touch-none rounded-full border-2 border-[#18a0fb] bg-white shadow-sm will-change-transform"
            style={{
              left: world.x - dotOff,
              top: world.y - dotOff,
              width: dotPx,
              height: dotPx,
              boxShadow: `0 0 0 ${borderWorld}px ${CANVAS_VISUAL.selection}`,
              transition: cornerPreview?.nodeId === id ? "none" : undefined,
            }}
            onPointerDown={makePointerDown(cornerIndex)}
          />
        );
      })}
      {radiusBadge ? (
        <CanvasEditValueBadge x={radiusBadge.x} y={radiusBadge.y} zoom={zoom}>
          {radiusBadge.radius}
        </CanvasEditValueBadge>
      ) : null}
    </>
  );
}
