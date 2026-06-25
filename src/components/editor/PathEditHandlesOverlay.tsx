"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import {
  applyMatrixToPoint,
  type Matrix2D,
} from "@/lib/transformMath";
import {
  getNodeWorldInverseMatrixFromChildOrder,
  getNodeWorldMatrixFromChildOrder,
  getRenderedWorldTopLeft,
} from "@/lib/editorGraph";
import { togglePathPointType, type PenPointerState } from "@/lib/penTool";
import { isRoundedRectPath } from "@/lib/shapes/shapeToPath";
import { PathEditPathOutline } from "@/components/editor/PathEditPathOutline";
import {
  pathEditAnchorOverlayStyle,
  pathEditBezierHandleOverlayStyle,
  PATH_EDIT_HANDLE_LINE_STROKE,
  pathPointForBezierHandleDisplay,
  pathPointHandleAffordances,
} from "@/lib/pathEditAnchors";
import {
  orientedBoxOverlayStyle,
  screenPxToOverlay,
  worldPointToOverlay,
} from "@/lib/canvasOverlaySpace";
import { useCanvasToWorld } from "@/components/editor/CanvasToWorldContext";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  createRafPointerScheduler,
  forEachCoalescedPointerEvent,
} from "@/lib/smoothPointer";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";
import {
  getDragPreviewOffsetForIds,
  getDragPreviewSnapshot,
  subscribeDragPreview,
} from "@/lib/canvasEphemeralTransform";

function pathLocalToWorld(
  nodeId: string,
  local: { x: number; y: number },
  nodes: Record<string, import("@/stores/useEditorStore").EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  const matrix = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (matrix) return applyMatrixToPoint(matrix, local);
  const origin = getRenderedWorldTopLeft(nodeId, nodes, childOrder);
  return { x: origin.x + local.x, y: origin.y + local.y };
}

function worldToPathLocal(
  nodeId: string,
  worldX: number,
  worldY: number,
  nodes: Record<string, import("@/stores/useEditorStore").EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  const inv = getNodeWorldInverseMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (inv) return applyMatrixToPoint(inv, { x: worldX, y: worldY });
  const origin = getRenderedWorldTopLeft(nodeId, nodes, childOrder);
  return { x: worldX - origin.x, y: worldY - origin.y };
}

/** Figma-style vector edit anchors and bezier handles (viewport screen space, above hit layer). */
export function PathEditHandlesOverlay() {
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);
  const tool = useEditorStore((s) => s.tool);
  const editorMode = useEditorStore((s) => s.editorMode);
  const selectedPathPointIds = useEditorStore((s) => s.selectedPathPointIds);
  const updatePathPoint = useEditorStore((s) => s.updatePathPoint);
  const updatePathPoints = useEditorStore((s) => s.updatePathPoints);
  const togglePathPointSelection = useEditorStore((s) => s.togglePathPointSelection);
  const setPathEditMode = useEditorStore((s) => s.setPathEditMode);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const toWorld = useCanvasToWorld();
  const overlay = useCanvasOverlaySpace();
  const dragPreview = useSyncExternalStore(subscribeDragPreview, getDragPreviewSnapshot, () => null);

  const nodeId = useMemo(() => {
    if (pathEditModeNodeId) return pathEditModeNodeId;
    if (penDrawingNodeId) return null;
    if (selectedIds.length !== 1) return null;
    const candidate = selectedIds[0]!;
    const n = nodes[candidate];
    if (!n || n.type !== "path") return null;
    if (tool !== "move" && tool !== "pen") return null;
    return candidate;
  }, [pathEditModeNodeId, penDrawingNodeId, selectedIds, nodes, tool]);

  const pathPointDragRef = useRef<{
    pointerId: number;
    pointIds: string[];
    kind: "anchor" | "handle-in" | "handle-out";
    startWorld: { x: number; y: number };
    startPointerLocal: { x: number; y: number };
    startPts: Record<string, { x: number; y: number }>;
    startHandle?: { x: number; y: number };
    handlePointId?: string;
    breakMirror: boolean;
  } | null>(null);
  const penPointerStateRef = useRef<PenPointerState>("idle");

  const worldToNodeLocal = useCallback(
    (worldX: number, worldY: number) => {
      if (!nodeId) return { x: worldX, y: worldY };
      return worldToPathLocal(nodeId, worldX, worldY, nodes, childOrder);
    },
    [nodeId, nodes, childOrder],
  );

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      return clientToWorldFromDocument(clientX, clientY, { pan, zoom: z });
    },
    [toWorld],
  );

  const node = nodeId ? nodes[nodeId] : null;
  const show =
    Boolean(nodeId) &&
    node?.type === "path" &&
    editorMode === "design" &&
    (tool === "move" || tool === "pen");

  const dragOffset = useMemo(
    () => (nodeId ? getDragPreviewOffsetForIds([nodeId]) : { dx: 0, dy: 0 }),
    [nodeId, dragPreview],
  );

  const worldMatrix = useMemo((): Matrix2D | null => {
    if (!nodeId || !show) return null;
    return getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  }, [nodeId, show, nodes, childOrder]);

  const boxStyle = useMemo(() => {
    if (!nodeId || !node || !worldMatrix) return null;
    return orientedBoxOverlayStyle(worldMatrix, node.width, node.height, overlay, dragOffset);
  }, [nodeId, node, worldMatrix, overlay, dragOffset]);

  if (!show || !nodeId || !node || !boxStyle) return null;

  const pts = node.pathPoints ?? [];
  if (pts.length === 0) return null;

  const startPathDrag = (
    pointId: string,
    kind: "anchor" | "handle-in" | "handle-out",
    e: React.PointerEvent,
    captureEl: HTMLElement,
    dragPointIds?: string[],
  ) => {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    const w = clientToWorld(e.clientX, e.clientY);
    const startPointerLocal = worldToPathLocal(nodeId, w.x, w.y, nodes, childOrder);
    const pt = nodes[nodeId]?.pathPoints?.find((p) => p.id === pointId);
    if (!pt) return;
    const livePathEditMode = useEditorStore.getState().pathEditModeNodeId;
    if (livePathEditMode !== nodeId) {
      setPathEditMode(nodeId);
    }
    const dragKind =
      kind === "anchor" ? "draggingAnchor" : kind === "handle-in" ? "draggingInHandle" : "draggingOutHandle";
    penPointerStateRef.current = dragKind;
    const moveIds =
      kind === "anchor"
        ? (dragPointIds ?? (selectedPathPointIds.includes(pointId) ? selectedPathPointIds : [pointId]))
        : [pointId];
    const startPts: Record<string, { x: number; y: number }> = {};
    for (const id of moveIds) {
      const p = nodes[nodeId]?.pathPoints?.find((x) => x.id === id);
      if (p) startPts[id] = { x: p.x, y: p.y };
    }
    pathPointDragRef.current = {
      pointerId: e.pointerId,
      pointIds: moveIds,
      kind,
      startWorld: w,
      startPointerLocal,
      startPts,
      handlePointId: pointId,
      breakMirror: e.altKey,
      startHandle:
        kind === "handle-in"
          ? pt.handleIn
            ? { ...pt.handleIn }
            : { x: 0, y: 0 }
          : kind === "handle-out"
            ? pt.handleOut
              ? { ...pt.handleOut }
              : { x: 0, y: 0 }
            : undefined,
    };
    captureEl.setPointerCapture(e.pointerId);

    const applyMove = (clientX: number, clientY: number, altKey: boolean) => {
      const d = pathPointDragRef.current;
      if (!d) return;

      const live = useEditorStore.getState();
      const nw = clientToWorld(clientX, clientY);
      const nowLocal = worldToPathLocal(nodeId, nw.x, nw.y, live.nodes, live.childOrder);

      if (d.kind === "anchor") {
        const dx = nowLocal.x - d.startPointerLocal.x;
        const dy = nowLocal.y - d.startPointerLocal.y;
        const patches: Record<string, { x: number; y: number }> = {};
        for (const id of d.pointIds) {
          const start = d.startPts[id];
          if (!start) continue;
          patches[id] = { x: start.x + dx, y: start.y + dy };
        }
        updatePathPoints(nodeId, patches, { skipHistory: true });
        return;
      }

      if (!d.handlePointId || (d.kind !== "handle-in" && d.kind !== "handle-out")) return;
      const startHandle = d.startHandle ?? { x: 0, y: 0 };
      const relative = {
        x: startHandle.x + (nowLocal.x - d.startPointerLocal.x),
        y: startHandle.y + (nowLocal.y - d.startPointerLocal.y),
      };
      const patch =
        d.kind === "handle-in" ? { handleIn: relative } : { handleOut: relative };

      updatePathPoint(nodeId, d.handlePointId, patch, {
        skipHistory: true,
        breakHandleMirror: altKey,
      });
    };

    const pathScheduler = createRafPointerScheduler<{ clientX: number; clientY: number; altKey: boolean }>(
      ({ clientX, clientY, altKey }) => {
        applyMove(clientX, clientY, altKey);
      },
    );

    const onMove = (ev: PointerEvent) => {
      const d = pathPointDragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      forEachCoalescedPointerEvent(ev, (pe) => {
        pathScheduler.schedule({ clientX: pe.clientX, clientY: pe.clientY, altKey: pe.altKey });
      });
    };
    const onUp = (ev: PointerEvent) => {
      const d = pathPointDragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      forEachCoalescedPointerEvent(ev, (pe) => {
        pathScheduler.schedule({ clientX: pe.clientX, clientY: pe.clientY, altKey: pe.altKey });
      });
      pathScheduler.flush();
      pathScheduler.cancel();
      pathPointDragRef.current = null;
      penPointerStateRef.current = "idle";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const onAnchorDown = (pointId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    if (nodeId && pathEditModeNodeId !== nodeId) {
      setPathEditMode(nodeId);
    }
    let dragIds: string[];
    if (e.shiftKey) {
      if (selectedPathPointIds.includes(pointId)) {
        togglePathPointSelection(pointId, true);
        return;
      }
      dragIds = [...selectedPathPointIds, pointId];
      togglePathPointSelection(pointId, true);
    } else if (selectedPathPointIds.includes(pointId) && selectedPathPointIds.length > 1) {
      dragIds = selectedPathPointIds;
    } else {
      dragIds = [pointId];
      togglePathPointSelection(pointId, false);
    }
    if (isRoundedRectPath(node)) return;
    startPathDrag(pointId, "anchor", e, e.currentTarget as HTMLElement, dragIds);
  };

  const onHandleDown = (
    pointId: string,
    kind: "handle-in" | "handle-out",
    e: React.PointerEvent,
  ) => {
    e.stopPropagation();
    if (nodeId && pathEditModeNodeId !== nodeId) {
      setPathEditMode(nodeId);
    }
    togglePathPointSelection(pointId, e.shiftKey);
    if (isRoundedRectPath(node)) return;
    startPathDrag(pointId, kind, e, e.currentTarget as HTMLElement);
  };

  const roundedRect = isRoundedRectPath(node);
  const selectedPt = pathPointForBezierHandleDisplay(pts, selectedPathPointIds, {
    roundedRect,
  });
  const showBezierHandles = selectedPt != null;

  const lineStroke = screenPxToOverlay(1, overlay);

  const bezierLines = showBezierHandles && selectedPt
    ? pathPointHandleAffordances(selectedPt, true).flatMap(({ kind, vec }) => {
        if (Math.hypot(vec.x, vec.y) < 1e-3) return [];
        const anchorWorld = pathLocalToWorld(
          nodeId,
          { x: selectedPt.x, y: selectedPt.y },
          nodes,
          childOrder,
        );
        const handleWorld = pathLocalToWorld(
          nodeId,
          { x: selectedPt.x + vec.x, y: selectedPt.y + vec.y },
          nodes,
          childOrder,
        );
        const a = worldPointToOverlay(
          anchorWorld.x + dragOffset.dx,
          anchorWorld.y + dragOffset.dy,
          overlay,
        );
        const b = worldPointToOverlay(
          handleWorld.x + dragOffset.dx,
          handleWorld.y + dragOffset.dy,
          overlay,
        );
        return [{ key: kind, x1: a.x, y1: a.y, x2: b.x, y2: b.y }];
      })
    : [];

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[34]"
      data-path-edit-handles-overlay
    >
      <div className="pointer-events-none absolute" style={boxStyle}>
        <PathEditPathOutline node={node} nodeId={nodeId} zoom={zoom} />
      </div>

      {bezierLines.length > 0 ? (
        <svg className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
          {bezierLines.map((line) => (
            <line
              key={line.key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={PATH_EDIT_HANDLE_LINE_STROKE}
              strokeWidth={lineStroke}
            />
          ))}
        </svg>
      ) : null}

      {showBezierHandles && selectedPt
        ? pathPointHandleAffordances(selectedPt, true).map(({ kind, vec, virtual }) => {
            const handleWorld = pathLocalToWorld(
              nodeId,
              { x: selectedPt.x + vec.x, y: selectedPt.y + vec.y },
              nodes,
              childOrder,
            );
            const pos = worldPointToOverlay(
              handleWorld.x + dragOffset.dx,
              handleWorld.y + dragOffset.dy,
              overlay,
            );
            return (
              <button
                key={`${kind}-${virtual ? "virtual" : "stored"}`}
                type="button"
                aria-label={kind === "handle-in" ? "Handle in" : "Handle out"}
                className="pointer-events-auto absolute touch-none"
                style={{
                  ...pathEditBezierHandleOverlayStyle(overlay),
                  left: pos.x,
                  top: pos.y,
                  opacity: virtual && Math.hypot(vec.x, vec.y) < 1e-3 ? 0.55 : 1,
                }}
                onPointerDown={(ev) => onHandleDown(selectedPt.id, kind, ev)}
              />
            );
          })
        : null}

      {pts.map((pt) => {
        const selected = selectedPathPointIds.includes(pt.id);
        const anchorWorld = pathLocalToWorld(nodeId, { x: pt.x, y: pt.y }, nodes, childOrder);
        const pos = worldPointToOverlay(
          anchorWorld.x + dragOffset.dx,
          anchorWorld.y + dragOffset.dy,
          overlay,
        );
        return (
          <button
            key={pt.id}
            type="button"
            aria-label="Anchor point"
            className="pointer-events-auto absolute touch-none"
            style={{
              ...pathEditAnchorOverlayStyle(overlay, selected),
              left: pos.x,
              top: pos.y,
            }}
            onPointerDown={(ev) => onAnchorDown(pt.id, ev)}
            onDoubleClick={(ev) => {
              ev.stopPropagation();
              pushHistory();
              const defaultLen = Math.min(node.width, node.height) * 0.15;
              updatePathPoint(nodeId, pt.id, togglePathPointType(pt, defaultLen));
            }}
          />
        );
      })}
    </div>
  );
}
