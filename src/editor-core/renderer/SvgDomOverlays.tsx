"use client";

import { useCallback, useRef } from "react";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import {
  applyMatrixToPoint,
  getNodeWorldInverseMatrix,
  getNodeWorldMatrix,
  matrixToCssTransform,
} from "@/lib/transformMath";
import { pathHandleMirroring } from "@/lib/pathHandles";
import { getNodeCornerRadii } from "@/lib/cornerRadius";
import { beginCornerRadiusDrag } from "@/lib/cornerRadiusDrag";
import {
  cornerRadiusHandlePosition,
  isRoundedRectPath,
  pathPointCornerIndex,
} from "@/lib/shapes/shapeToPath";
import { screenPxToWorld } from "@/lib/canvasVisual";
import { useCanvasToWorld } from "@/components/editor/CanvasToWorldContext";
import { cn } from "@/lib/utils";
import { pickDeepestFrameAtWorldPoint, worldRect } from "@/lib/tree";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import {
  createRafPointerScheduler,
  forEachCoalescedPointerEvent,
} from "@/lib/smoothPointer";

function overlayWorldStyle(
  nodeId: string,
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): React.CSSProperties {
  const wm = getNodeWorldMatrix(nodeId, nodes);
  if (wm) {
    return {
      left: 0,
      top: 0,
      width: node.width,
      height: node.height,
      transform: matrixToCssTransform(wm),
      transformOrigin: "0 0",
    };
  }
  const wr = worldRect(nodeId, nodes);
  return { left: wr.x, top: wr.y, width: wr.width, height: wr.height };
}

function PathEditOverlay({ nodeId }: { nodeId: string }) {
  const nodes = useEditorStore((s) => s.nodes);
  const zoom = useEditorStore((s) => s.zoom);
  const tool = useEditorStore((s) => s.tool);
  const editorMode = useEditorStore((s) => s.editorMode);
  const selectedPathPointId = useEditorStore((s) => s.selectedPathPointId);
  const updatePathPoint = useEditorStore((s) => s.updatePathPoint);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const setSelectedPathPointId = useEditorStore((s) => s.setSelectedPathPointId);
  const setPathEditMode = useEditorStore((s) => s.setPathEditMode);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const toWorld = useCanvasToWorld();

  const pathPointDragRef = useRef<{
    pointerId: number;
    pointId: string;
    kind: "anchor" | "handle-in" | "handle-out";
    startWorld: { x: number; y: number };
    startPt: { x: number; y: number };
    startHandle?: { x: number; y: number };
  } | null>(null);

  const worldToNodeLocal = useCallback(
    (worldX: number, worldY: number) => {
      const inv = getNodeWorldInverseMatrix(nodeId, nodes);
      if (inv) return applyMatrixToPoint(inv, { x: worldX, y: worldY });
      const n = nodes[nodeId];
      return { x: worldX - (n?.x ?? 0), y: worldY - (n?.y ?? 0) };
    },
    [nodeId, nodes],
  );

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      return clientToWorldFromDocument(clientX, clientY, { pan, zoom: z });
    },
    [toWorld],
  );

  const node = nodes[nodeId];
  if (!node || node.type !== "path" || editorMode !== "design" || tool !== "move") return null;

  const pts = node.pathPoints ?? [];
  if (pts.length === 0) return null;

  const startPathDrag = (
    pointId: string,
    kind: "anchor" | "handle-in" | "handle-out",
    e: React.PointerEvent,
    captureEl: HTMLElement,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    const w = clientToWorld(e.clientX, e.clientY);
    const pt = nodes[nodeId]?.pathPoints?.find((p) => p.id === pointId);
    if (!pt) return;
    setPathEditMode(nodeId);
    setSelectedPathPointId(pointId);
    pathPointDragRef.current = {
      pointerId: e.pointerId,
      pointId,
      kind,
      startWorld: w,
      startPt: { x: pt.x, y: pt.y },
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
        updatePathPoint(
          nodeId,
          pointId,
          { x: d.startPt.x + dx, y: d.startPt.y + dy },
          { skipHistory: true },
        );
      } else if (d.startHandle) {
        const patch =
          d.kind === "handle-in"
            ? { handleIn: { x: d.startHandle.x + dx, y: d.startHandle.y + dy } }
            : { handleOut: { x: d.startHandle.x + dx, y: d.startHandle.y + dy } };
        updatePathPoint(nodeId, pointId, patch, { skipHistory: true });
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
    setSelectedPathPointId(pointId);
    if (isRoundedRectPath(node)) return;
    startPathDrag(pointId, "anchor", e, e.currentTarget as HTMLElement);
  };

  const startCornerRadiusDrag = (cornerIndex: 0 | 1 | 2 | 3, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    beginCornerRadiusDrag({
      nodeId,
      cornerIndex,
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      clientToWorld: (cx, cy) => clientToWorldFromDocument(cx, cy, zoom),
      captureTarget: e.currentTarget as HTMLElement,
    });
  };

  const onHandleDown = (
    pointId: string,
    kind: "handle-in" | "handle-out",
    e: React.PointerEvent,
  ) => {
    startPathDrag(pointId, kind, e, e.currentTarget as HTMLElement);
  };

  const selectedPt = pts.find((p) => p.id === selectedPathPointId);
  const mirroring = pathHandleMirroring(node);
  const roundedRect = isRoundedRectPath(node);
  const selectedCornerIndex = pathPointCornerIndex(node, selectedPathPointId);
  const cornerRadii = getNodeCornerRadii(node);
  const radiusHandlePos =
    roundedRect && selectedCornerIndex != null
      ? cornerRadiusHandlePosition(node.width, node.height, cornerRadii, selectedCornerIndex)
      : null;

  return (
    <div
      className="pointer-events-none absolute z-[25]"
      data-svg-dom-overlay="path-edit"
      style={overlayWorldStyle(nodeId, node, nodes)}
    >
      {radiusHandlePos && selectedCornerIndex != null ? (
        <button
          type="button"
          aria-label="Corner radius"
          title="Drag to adjust corner radius"
          className="pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[color:var(--pc-canvas-selection)] bg-white shadow-sm"
          style={{ left: radiusHandlePos.x, top: radiusHandlePos.y }}
          onPointerDown={(ev) => startCornerRadiusDrag(selectedCornerIndex, ev)}
        />
      ) : null}
      {selectedPt && !roundedRect ? (
        <>
          {selectedPt.handleIn ? (
            <svg
              className="pointer-events-none absolute inset-0 overflow-visible"
              width={node.width}
              height={node.height}
              aria-hidden
            >
              <line
                x1={selectedPt.x}
                y1={selectedPt.y}
                x2={selectedPt.x + selectedPt.handleIn.x}
                y2={selectedPt.y + selectedPt.handleIn.y}
                stroke="var(--pc-canvas-selection)"
                strokeWidth={1}
              />
            </svg>
          ) : null}
          {selectedPt.handleOut ? (
            <svg
              className="pointer-events-none absolute inset-0 overflow-visible"
              width={node.width}
              height={node.height}
              aria-hidden
            >
              <line
                x1={selectedPt.x}
                y1={selectedPt.y}
                x2={selectedPt.x + selectedPt.handleOut.x}
                y2={selectedPt.y + selectedPt.handleOut.y}
                stroke="var(--pc-canvas-selection)"
                strokeWidth={1}
              />
            </svg>
          ) : null}
          {(["handle-in", "handle-out"] as const).map((kind) => {
            const h = kind === "handle-in" ? selectedPt.handleIn : selectedPt.handleOut;
            if (!h) return null;
            return (
              <button
                key={kind}
                type="button"
                aria-label={kind === "handle-in" ? "Handle in" : "Handle out"}
                className="pointer-events-auto absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:var(--pc-canvas-selection)] bg-white"
                style={{ left: selectedPt.x + h.x, top: selectedPt.y + h.y }}
                onPointerDown={(ev) => onHandleDown(selectedPt.id, kind, ev)}
              />
            );
          })}
        </>
      ) : null}
      {pts.map((pt) => (
        <button
          key={pt.id}
          type="button"
          aria-label="Anchor point"
          className={cn(
            "pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 border-2 border-[color:var(--pc-canvas-selection)] bg-white",
            selectedPathPointId === pt.id ? "ring-2 ring-amber-300" : "",
            roundedRect && selectedPathPointId === pt.id ? "scale-110" : "",
          )}
          style={{ left: pt.x, top: pt.y }}
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
      ))}
    </div>
  );
}

function PrototypeHandleOverlay({ nodeId }: { nodeId: string }) {
  const nodes = useEditorStore((s) => s.nodes);
  const zoom = useEditorStore((s) => s.zoom);
  const startPrototypeConnection = useEditorStore((s) => s.startPrototypeConnection);
  const finishPrototypeConnection = useEditorStore((s) => s.finishPrototypeConnection);
  const updatePrototypeWirePointer = useEditorStore((s) => s.updatePrototypeWirePointer);
  const toWorld = useCanvasToWorld();

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      return clientToWorldFromDocument(clientX, clientY, { pan, zoom: z });
    },
    [toWorld],
  );

  const node = nodes[nodeId];
  if (!node?.visible) return null;
  const handleSize = screenPxToWorld(10, zoom);
  const wm = getNodeWorldMatrix(nodeId, nodes);
  const wr = worldRect(nodeId, nodes);
  const wireOrigin = wm
    ? applyMatrixToPoint(wm, { x: node.width, y: node.height / 2 })
    : { x: wr.x + wr.width, y: wr.y + wr.height / 2 };

  const onHandleDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    startPrototypeConnection(nodeId, e.pointerId, wireOrigin.x, wireOrigin.y);
    const pid = e.pointerId;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const w = clientToWorld(ev.clientX, ev.clientY);
      updatePrototypeWirePointer(w.x, w.y);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const w = clientToWorld(ev.clientX, ev.clientY);
      const s2 = useEditorStore.getState();
      const target = pickDeepestFrameAtWorldPoint(w.x, w.y, s2.nodes, s2.childOrder, {
        excludeDescendantsOf: nodeId,
      });
      finishPrototypeConnection(target);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      className="pointer-events-none absolute z-[25]"
      data-svg-dom-overlay="prototype-handle"
      style={overlayWorldStyle(nodeId, node, nodes)}
    >
      <button
        type="button"
        data-prototype-handle
        className="pointer-events-auto absolute top-1/2 z-20 -translate-y-1/2 translate-x-1/2 cursor-crosshair rounded-full border border-white bg-[color:var(--pc-canvas-selection)]"
        style={{
          right: 0,
          width: handleSize,
          height: handleSize,
        }}
        aria-label="Drag to connect prototype"
        onPointerDown={onHandleDown}
      />
    </div>
  );
}

/** Minimal DOM overlays for SVG mode (text edit, path anchors, prototype handle only). */
export function SvgDomOverlays() {
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);
  const editorMode = useEditorStore((s) => s.editorMode);
  const tool = useEditorStore((s) => s.tool);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);

  const protoId =
    editorMode === "prototype" && tool === "move" && selectedIds.length === 1
      ? selectedIds[0]!
      : null;

  if (!pathEditModeNodeId && !protoId) return null;

  return (
    <>
      {pathEditModeNodeId && nodes[pathEditModeNodeId] ? (
        <PathEditOverlay nodeId={pathEditModeNodeId} />
      ) : null}
      {protoId && nodes[protoId] ? <PrototypeHandleOverlay nodeId={protoId} /> : null}
    </>
  );
}
