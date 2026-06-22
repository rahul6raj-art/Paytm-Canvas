"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { CANVAS_MIN_ZOOM } from "@/lib/canvasZoom";
import {
  CANVAS_CORNER_RADIUS_HANDLE_INSET_SCREEN_PX,
  CANVAS_CORNER_RADIUS_HANDLE_SCREEN_PX,
  CANVAS_EDIT_VALUE_BADGE_OFFSET_SCREEN_PX,
  canvasCornerRadiusHandleStyle,
} from "@/lib/canvasVisual";
import {
  shouldShowParametricShapeCornerRadiusHandlesOnCanvas,
} from "@/lib/cornerRadius";
import { isPolygonNode, getPolygonVertexCornerRadii, polygonCornerRadiusHandleAtVertex } from "@/lib/shapes/polygonGeometry";
import { beginPolygonCornerRadiusDrag, getPolygonPreview, subscribePolygonPreview } from "@/lib/shapes/polygonDrag";
import {
  effectiveStarParams,
  isStarNode,
  starCornerRadiusHandleLocal,
} from "@/lib/shapes/starGeometry";
import { beginStarCornerRadiusDrag, getStarPreview, subscribeStarPreview } from "@/lib/shapes/starDrag";
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

type VertexHandle = {
  key: string;
  vertexIndex: number;
  local: { x: number; y: number };
  radius: number;
  kind: "polygon" | "star";
};

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

function badgeScreenPosition(
  nodeId: string,
  local: { x: number; y: number },
  nodes: Record<string, import("@/stores/useEditorStore").EditorNode>,
  childOrder: Record<string, string[]>,
  overlay: OverlaySpace,
): { x: number; y: number } {
  const world = localToWorld(nodeId, local, nodes, childOrder);
  const screen = worldPointToOverlay(world.x, world.y, overlay);
  return {
    x: snapOverlayPx(screen.x + CANVAS_EDIT_VALUE_BADGE_OFFSET_SCREEN_PX * 0.35),
    y: snapOverlayPx(screen.y - CANVAS_EDIT_VALUE_BADGE_OFFSET_SCREEN_PX),
  };
}

/** Figma-style corner radius dots on polygon / star (single selection, move tool). */
export function ParametricShapeCornerRadiusHandles() {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editorMode = useEditorStore((s) => s.editorMode);
  const tool = useEditorStore((s) => s.tool);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const pencilDrawingNodeId = useEditorStore((s) => s.pencilDrawingNodeId);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const transformInteractionMode = useEditorStore((s) => s.transformInteractionMode);
  const shapeEditModeNodeId = useEditorStore((s) => s.shapeEditModeNodeId);
  const zoom = useEditorStore((s) => s.zoom);
  const pan = useEditorStore((s) => s.pan);
  const overlay = useCanvasOverlaySpace();
  const clientToWorld = useCanvasToWorld();
  const id = selectedIds.length === 1 ? selectedIds[0]! : null;
  const node = id ? nodes[id] : null;

  const polygonPreview = useSyncExternalStore(subscribePolygonPreview, getPolygonPreview, () => null);
  const starPreview = useSyncExternalStore(subscribeStarPreview, getStarPreview, () => null);
  const dragPreview = useSyncExternalStore(subscribeDragPreview, getDragPreviewSnapshot, () => null);
  const dragActive = Boolean(dragPreview?.movingIds.length);

  const show = shouldShowParametricShapeCornerRadiusHandlesOnCanvas(
    {
      editorMode,
      tool,
      penDrawingNodeId,
      pencilDrawingNodeId,
      isPlacingComment,
      selectedIds,
      transformInteractionMode,
      dragActive,
      shapeEditModeNodeId,
    },
    node,
  );

  const minInset =
    CANVAS_CORNER_RADIUS_HANDLE_INSET_SCREEN_PX /
    Math.max(Number.isFinite(overlay.zoom) ? overlay.zoom : CANVAS_MIN_ZOOM, CANVAS_MIN_ZOOM);
  const dotPx = CANVAS_CORNER_RADIUS_HANDLE_SCREEN_PX;
  const dotOff = dotPx / 2;
  const dotStyle = canvasCornerRadiusHandleStyle();

  const handles = useMemo((): VertexHandle[] | null => {
    if (!show || !id || !node) return null;
    if (!Number.isFinite(node.width) || !Number.isFinite(node.height)) return null;

    if (isPolygonNode(node)) {
      const sides = polygonPreview?.nodeId === id ? polygonPreview.sides : (node.polygonSides ?? 6);
      const radii =
        polygonPreview?.nodeId === id
          ? polygonPreview.cornerRadii
          : getPolygonVertexCornerRadii(node);
      return radii.map((radius, vertexIndex) => ({
        key: `poly-${vertexIndex}`,
        vertexIndex,
        local: polygonCornerRadiusHandleAtVertex(
          sides,
          node.width,
          node.height,
          radii,
          vertexIndex,
          minInset,
        ),
        radius,
        kind: "polygon" as const,
      }));
    }

    if (isStarNode(node)) {
      const params =
        starPreview?.nodeId === id ? starPreview : effectiveStarParams(node);
      const outerIndices = Array.from({ length: params.pointCount }, (_, i) => i * 2);
      return outerIndices.map((vertexIndex) => ({
        key: `star-${vertexIndex}`,
        vertexIndex,
        local: starCornerRadiusHandleLocal(
          params.pointCount,
          params.ratio,
          node.width,
          node.height,
          params.outerCornerRadius,
          vertexIndex,
        ),
        radius: params.outerCornerRadius,
        kind: "star" as const,
      }));
    }

    return null;
  }, [show, id, node, polygonPreview, starPreview, minInset]);

  const radiusBadge = useMemo(() => {
    if (!id || !node || !handles?.length) return null;
    if (polygonPreview?.nodeId === id) {
      const h = handles[polygonPreview.vertexIndex];
      if (!h) return null;
      const p = badgeScreenPosition(id, h.local, nodes, childOrder, overlay);
      return {
        x: p.x,
        y: p.y,
        radius: Math.round(polygonPreview.cornerRadii[polygonPreview.vertexIndex] ?? 0),
      };
    }
    if (starPreview?.nodeId === id) {
      const h = handles.find((entry) => entry.vertexIndex === starPreview.vertexIndex) ?? handles[0];
      if (!h) return null;
      const p = badgeScreenPosition(id, h.local, nodes, childOrder, overlay);
      return {
        x: p.x,
        y: p.y,
        radius: Math.round(starPreview.outerCornerRadius),
      };
    }
    return null;
  }, [polygonPreview, starPreview, id, node, handles, nodes, childOrder, overlay]);

  const makePointerDown = useCallback(
    (handle: VertexHandle) => (e: React.PointerEvent) => {
      if (!id || e.button !== 0) return;
      e.stopPropagation();
      const toWorld =
        clientToWorld ??
        ((cx: number, cy: number) => clientToWorldFromDocument(cx, cy, { pan, zoom }));
      const opts = {
        nodeId: id,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld: toWorld,
        captureTarget: e.currentTarget,
        vertexIndex: handle.vertexIndex,
      };
      if (handle.kind === "polygon") beginPolygonCornerRadiusDrag(opts);
      else beginStarCornerRadiusDrag(opts);
    },
    [id, clientToWorld, pan, zoom],
  );

  if (!show || !handles?.length) return null;

  const dragging = polygonPreview?.nodeId === id || starPreview?.nodeId === id;

  return (
    <>
      {handles.map((handle) => {
        const world = localToWorld(id!, handle.local, nodes, childOrder);
        const screen = worldPointToOverlay(world.x, world.y, overlay);
        if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null;
        return (
          <EditorHintWrap key={handle.key} title="Drag to adjust corner radius" anchorClassName="contents">
            <button
              type="button"
              data-parametric-corner-radius-handle
              data-corner-radius-handle={handle.vertexIndex}
              aria-label={`Corner radius handle ${handle.vertexIndex + 1}`}
              className="pointer-events-auto absolute z-[31] touch-none will-change-transform"
              style={{
                ...dotStyle,
                left: screen.x - dotOff,
                top: screen.y - dotOff,
                opacity: handle.radius > 0 || dragging ? 1 : 0.72,
                transition: dragging ? "none" : undefined,
              }}
              onPointerDown={makePointerDown(handle)}
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
