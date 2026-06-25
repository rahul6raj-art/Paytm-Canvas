"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { CANVAS_MIN_ZOOM } from "@/lib/canvasZoom";
import {
  CANVAS_CORNER_RADIUS_HANDLE_INSET_SCREEN_PX,
  CANVAS_CORNER_RADIUS_HANDLE_SCREEN_PX,
  CANVAS_EDIT_VALUE_BADGE_OFFSET_SCREEN_PX,
  CANVAS_VISUAL,
  canvasCornerRadiusHandleStyle,
} from "@/lib/canvasVisual";
import {
  getNodeCornerRadii,
  shouldShowCornerRadiusHandlesOnCanvas,
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
import {
  getDragPreviewSnapshot,
  subscribeDragPreview,
} from "@/lib/canvasEphemeralTransform";
import { worldPointToOverlay, snapOverlayPx, type OverlaySpace } from "@/lib/canvasOverlaySpace";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";
import { CanvasEditValueBadge } from "./CanvasEditValueBadge";
import { EditorHintWrap } from "./EditorHoverHint";

const CORNERS: CornerIndex[] = [0, 1, 2, 3];

const CORNER_BISECTOR_LOCAL: Record<CornerIndex, { dx: number; dy: number }> = {
  0: { dx: -1, dy: -1 },
  1: { dx: 1, dy: -1 },
  2: { dx: 1, dy: 1 },
  3: { dx: -1, dy: 1 },
};

function cornerVertexLocal(
  cornerIndex: CornerIndex,
  width: number,
  height: number,
): { x: number; y: number } {
  switch (cornerIndex) {
    case 0:
      return { x: 0, y: 0 };
    case 1:
      return { x: width, y: 0 };
    case 2:
      return { x: width, y: height };
    case 3:
      return { x: 0, y: height };
    default:
      return { x: 0, y: 0 };
  }
}

function badgeScreenPosition(
  nodeId: string,
  local: { x: number; y: number },
  cornerIndex: CornerIndex,
  nodes: Record<string, import("@/stores/useEditorStore").EditorNode>,
  childOrder: Record<string, string[]>,
  overlay: OverlaySpace,
): { x: number; y: number } {
  const world = localToWorld(nodeId, local, nodes, childOrder);
  const bisector = CORNER_BISECTOR_LOCAL[cornerIndex];
  const worldStep = localToWorld(
    nodeId,
    { x: local.x + bisector.dx, y: local.y + bisector.dy },
    nodes,
    childOrder,
  );
  const screen = worldPointToOverlay(world.x, world.y, overlay);
  const screenStep = worldPointToOverlay(worldStep.x, worldStep.y, overlay);
  const sdx = screenStep.x - screen.x;
  const sdy = screenStep.y - screen.y;
  const slen = Math.hypot(sdx, sdy) || 1;
  const offset = CANVAS_EDIT_VALUE_BADGE_OFFSET_SCREEN_PX;
  return {
    x: snapOverlayPx(screen.x + (sdx / slen) * offset),
    y: snapOverlayPx(screen.y + (sdy / slen) * offset),
  };
}

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
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editorMode = useEditorStore((s) => s.editorMode);
  const tool = useEditorStore((s) => s.tool);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const pencilDrawingNodeId = useEditorStore((s) => s.pencilDrawingNodeId);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const transformInteractionMode = useEditorStore((s) => s.transformInteractionMode);
  const zoom = useEditorStore((s) => s.zoom);
  const pan = useEditorStore((s) => s.pan);
  const overlay = useCanvasOverlaySpace();
  const clientToWorld = useCanvasToWorld();
  const id = selectedIds.length === 1 ? selectedIds[0]! : null;
  const node = id ? nodes[id] : null;

  const cornerPreview = useSyncExternalStore(
    subscribeCornerRadiusPreview,
    getCornerRadiusPreview,
    () => null,
  );
  const dragPreview = useSyncExternalStore(subscribeDragPreview, getDragPreviewSnapshot, () => null);
  const dragActive = Boolean(dragPreview?.movingIds.length);

  const show = shouldShowCornerRadiusHandlesOnCanvas(
    {
      editorMode,
      tool,
      penDrawingNodeId,
      pencilDrawingNodeId,
      isPlacingComment,
      selectedIds,
      transformInteractionMode,
      dragActive,
    },
    node,
  );

  const minInset =
    CANVAS_CORNER_RADIUS_HANDLE_INSET_SCREEN_PX /
    Math.max(Number.isFinite(overlay.zoom) ? overlay.zoom : CANVAS_MIN_ZOOM, CANVAS_MIN_ZOOM);
  const dotPx = CANVAS_CORNER_RADIUS_HANDLE_SCREEN_PX;
  const dotOff = dotPx / 2;
  const dotStyle = canvasCornerRadiusHandleStyle(
    undefined,
    undefined,
    node?.isComponent ? CANVAS_VISUAL.component : undefined,
  );

  const radii = useMemo(() => {
    if (!node) return [0, 0, 0, 0] as CornerRadii;
    if (cornerPreview?.nodeId === id) return cornerPreview.radii;
    return getNodeCornerRadii(node);
  }, [node, cornerPreview, id]);

  const handleWorldPositions = useMemo(() => {
    if (!show || !id || !node) return null;
    if (!Number.isFinite(node.width) || !Number.isFinite(node.height)) return null;
    return CORNERS.map((cornerIndex) => ({
      cornerIndex,
      local: cornerRadiusHandlePosition(
        node.width,
        node.height,
        radii,
        cornerIndex,
        minInset,
      ),
    }));
  }, [show, id, node, radii, minInset]);

  const radiusBadge = useMemo(() => {
    if (!cornerPreview || cornerPreview.nodeId !== id || !node) return null;
    const local = cornerVertexLocal(
      cornerPreview.cornerIndex,
      node.width,
      node.height,
    );
    const p = badgeScreenPosition(
      id!,
      local,
      cornerPreview.cornerIndex,
      nodes,
      childOrder,
      overlay,
    );
    const r = cornerPreview.radii[cornerPreview.cornerIndex] ?? 0;
    return { x: p.x, y: p.y, radius: Math.round(r) };
  }, [cornerPreview, id, node, nodes, childOrder, overlay]);

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
        const screen = worldPointToOverlay(world.x, world.y, overlay);
        if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null;
        return (
          <EditorHintWrap key={cornerIndex} title="Drag to adjust corner radius" anchorClassName="contents">
            <button
              type="button"
              data-corner-radius-handle={cornerIndex}
              aria-label={`Corner radius ${["top-left", "top-right", "bottom-right", "bottom-left"][cornerIndex]}`}
              className="pointer-events-auto absolute z-[31] touch-none will-change-transform"
              style={{
                ...dotStyle,
                left: screen.x - dotOff,
                top: screen.y - dotOff,
                transition: cornerPreview?.nodeId === id ? "none" : undefined,
              }}
              onPointerDown={makePointerDown(cornerIndex)}
            />
          </EditorHintWrap>
        );
      })}
      {radiusBadge ? (
        <CanvasEditValueBadge
          x={radiusBadge.x}
          y={radiusBadge.y}
          zoom={zoom}
          screenSpace
          placement="center"
          stableWidth
        >
          {radiusBadge.radius}
        </CanvasEditValueBadge>
      ) : null}
    </>
  );
}
