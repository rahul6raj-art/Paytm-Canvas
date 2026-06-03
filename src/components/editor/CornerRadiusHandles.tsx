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
  const clientToWorld = useCanvasToWorld();

  const id = selectedIds.length === 1 ? selectedIds[0]! : null;
  const node = id ? nodes[id] : null;

  const cornerPreview = useSyncExternalStore(
    subscribeCornerRadiusPreview,
    getCornerRadiusPreview,
    () => null,
  );

  const [dragUi, setDragUi] = useState<{
    cornerIndex: CornerIndex;
    radius: number;
  } | null>(null);

  const show =
    editorMode === "design" &&
    tool === "move" &&
    !penDrawingNodeId &&
    !pencilDrawingNodeId &&
    !isPlacingComment &&
    id &&
    node &&
    supportsCornerRadiusHandles(node) &&
    pathEditModeNodeId !== id;

  const handlePx = screenPxToWorld(CANVAS_HANDLE_SCREEN_PX, zoom);
  const borderWorld = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);
  const dotPx = screenPxToWorld(6, zoom);
  const off = handlePx / 2;
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

  const labelWorld = useMemo(() => {
    if (!dragUi || !id || !node || !handleWorldPositions) return null;
    const entry = handleWorldPositions.find((h) => h.cornerIndex === dragUi.cornerIndex);
    if (!entry) return null;
    const w = localToWorld(id, entry.local, nodes, childOrder);
    return { x: w.x, y: w.y - dotOff - screenPxToWorld(20, zoom), radius: dragUi.radius };
  }, [dragUi, id, node, handleWorldPositions, nodes, childOrder, zoom, dotOff]);

  const makePointerDown = useCallback(
    (cornerIndex: CornerIndex) => (e: React.PointerEvent) => {
      if (!id || e.button !== 0) return;
      e.stopPropagation();
      const toWorld =
        clientToWorld ??
        ((cx: number, cy: number) => clientToWorldFromDocument(cx, cy, zoom));
      const initialRadius = radii[cornerIndex] ?? 0;
      setDragUi({ cornerIndex, radius: initialRadius });
      beginCornerRadiusDrag({
        nodeId: id,
        cornerIndex,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld: toWorld,
        captureTarget: e.currentTarget,
        callbacks: {
          onDrag: (_, radius) => setDragUi({ cornerIndex, radius }),
          onEnd: () => setDragUi(null),
        },
      });
    },
    [id, clientToWorld, zoom, radii],
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
      {labelWorld ? (
        <div
          className="pointer-events-none absolute z-[32] whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white"
          style={{
            left: labelWorld.x,
            top: labelWorld.y,
            transform: "translate(-50%, -100%)",
            background: CANVAS_VISUAL.selection,
          }}
        >
          Radius {Math.round(labelWorld.radius)}
        </div>
      ) : null}
    </>
  );
}
