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
  getRenderedWorldBounds,
} from "@/lib/editorGraph";
import { pathHandleMirroring } from "@/lib/pathHandles";
import { isRoundedRectPath } from "@/lib/shapes/shapeToPath";
import { PathEditPathOutline } from "@/components/editor/PathEditPathOutline";
import {
  pathEditAnchorOverlayStyle,
  pathEditBezierHandleOverlayStyle,
  selectedPathPoints,
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
  const b = getRenderedWorldBounds(nodeId, nodes, childOrder);
  return { x: b.x + local.x, y: b.y + local.y };
}

/** Figma-style vector edit anchors and bezier handles (viewport screen space, above hit layer). */
export function PathEditHandlesOverlay() {
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);
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

  const nodeId = pathEditModeNodeId;
  const pathPointDragRef = useRef<{
    pointerId: number;
    pointIds: string[];
    kind: "anchor" | "handle-in" | "handle-out";
    startWorld: { x: number; y: number };
    startPts: Record<string, { x: number; y: number }>;
    startHandle?: { x: number; y: number };
    handlePointId?: string;
  } | null>(null);

  const worldToNodeLocal = useCallback(
    (worldX: number, worldY: number) => {
      if (!nodeId) return { x: worldX, y: worldY };
      const inv = getNodeWorldInverseMatrixFromChildOrder(nodeId, nodes, childOrder);
      if (inv) return applyMatrixToPoint(inv, { x: worldX, y: worldY });
      const n = nodes[nodeId];
      return { x: worldX - (n?.x ?? 0), y: worldY - (n?.y ?? 0) };
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
    tool === "move";

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
    const pt = nodes[nodeId]?.pathPoints?.find((p) => p.id === pointId);
    if (!pt) return;
    setPathEditMode(nodeId);
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
      startPts,
      handlePointId: pointId,
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

    const applyMove = (clientX: number, clientY: number) => {
      const d = pathPointDragRef.current;
      if (!d) return;
      const nw = clientToWorld(clientX, clientY);
      const startLocal = worldToNodeLocal(d.startWorld.x, d.startWorld.y);
      const nowLocal = worldToNodeLocal(nw.x, nw.y);
      const dx = nowLocal.x - startLocal.x;
      const dy = nowLocal.y - startLocal.y;
      if (d.kind === "anchor") {
        const patches: Record<string, { x: number; y: number }> = {};
        for (const id of d.pointIds) {
          const start = d.startPts[id];
          if (!start) continue;
          patches[id] = { x: start.x + dx, y: start.y + dy };
        }
        updatePathPoints(nodeId, patches, { skipHistory: true });
      } else if (d.startHandle && d.handlePointId) {
        const patch =
          d.kind === "handle-in"
            ? { handleIn: { x: d.startHandle.x + dx, y: d.startHandle.y + dy } }
            : { handleOut: { x: d.startHandle.x + dx, y: d.startHandle.y + dy } };
        updatePathPoint(nodeId, d.handlePointId, patch, { skipHistory: true });
      }
    };

    const pathScheduler = createRafPointerScheduler<{ clientX: number; clientY: number }>(
      ({ clientX, clientY }) => applyMove(clientX, clientY),
    );

    const onMove = (ev: PointerEvent) => {
      const d = pathPointDragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      forEachCoalescedPointerEvent(ev, (pe) => {
        pathScheduler.schedule({ clientX: pe.clientX, clientY: pe.clientY });
      });
    };
    const onUp = (ev: PointerEvent) => {
      const d = pathPointDragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      forEachCoalescedPointerEvent(ev, (pe) => {
        pathScheduler.schedule({ clientX: pe.clientX, clientY: pe.clientY });
      });
      pathScheduler.flush();
      pathScheduler.cancel();
      pathPointDragRef.current = null;
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
    togglePathPointSelection(pointId, e.shiftKey);
    if (isRoundedRectPath(node)) return;
    startPathDrag(pointId, kind, e, e.currentTarget as HTMLElement);
  };

  const selectedPts = selectedPathPoints(pts, selectedPathPointIds);
  const primarySelectedId = selectedPathPointIds[0] ?? null;
  const selectedPt = pts.find((p) => p.id === primarySelectedId);
  const mirroring = pathHandleMirroring(node);
  const roundedRect = isRoundedRectPath(node);
  const showBezierHandles = selectedPts.length === 1 && selectedPt && !roundedRect;

  const lineStroke = screenPxToOverlay(1, overlay);

  const bezierLines = showBezierHandles && selectedPt
    ? (["handle-in", "handle-out"] as const).flatMap((kind) => {
        const h = kind === "handle-in" ? selectedPt.handleIn : selectedPt.handleOut;
        if (!h) return [];
        const anchorWorld = pathLocalToWorld(
          nodeId,
          { x: selectedPt.x, y: selectedPt.y },
          nodes,
          childOrder,
        );
        const handleWorld = pathLocalToWorld(
          nodeId,
          { x: selectedPt.x + h.x, y: selectedPt.y + h.y },
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
              stroke="var(--pc-canvas-selection)"
              strokeWidth={lineStroke}
            />
          ))}
        </svg>
      ) : null}

      {showBezierHandles && selectedPt
        ? (["handle-in", "handle-out"] as const).map((kind) => {
            const h = kind === "handle-in" ? selectedPt.handleIn : selectedPt.handleOut;
            if (!h) return null;
            const handleWorld = pathLocalToWorld(
              nodeId,
              { x: selectedPt.x + h.x, y: selectedPt.y + h.y },
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
                key={kind}
                type="button"
                aria-label={kind === "handle-in" ? "Handle in" : "Handle out"}
                className="pointer-events-auto absolute touch-none"
                style={{
                  ...pathEditBezierHandleOverlayStyle(overlay),
                  left: pos.x,
                  top: pos.y,
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
              const hasHandles = pt.handleIn || pt.handleOut;
              if (hasHandles) {
                updatePathPoint(nodeId, pt.id, { handleIn: undefined, handleOut: undefined });
              } else {
                const len = Math.min(node.width, node.height) * 0.15;
                updatePathPoint(nodeId, pt.id, {
                  handleOut: { x: len, y: 0 },
                  handleIn: mirroring === "none" ? undefined : { x: -len, y: 0 },
                });
              }
            }}
          />
        );
      })}
    </div>
  );
}
