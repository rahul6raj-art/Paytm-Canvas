"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { normalizeHex } from "@/lib/color";
import {
  CANVAS_GRADIENT_AXIS_HIT_SCREEN_PX,
  CANVAS_GRADIENT_AXIS_SCREEN_PX,
  CANVAS_GRADIENT_STOP_OFFSET_SCREEN_PX,
  canvasGradientAxisDotStyle,
  canvasGradientStopSquareStyle,
} from "@/lib/canvasVisual";
import {
  angularStopLocalPointFromPosition,
  angularStopPositionFromLocalPoint,
  effectiveFillType,
  getGradientHandlePositions,
  gradientStopLocalPoint,
  positionFromLocalPoint,
  resolveEditableFillGradient,
  updateGradientHandle,
} from "@/lib/fillGradient";
import {
  insertStopAtPosition,
  normalizeFillGradient,
  updateStopPreserveOrder,
  type FillGradient,
  type GradientStop,
} from "@/lib/gradient";
import { offsetPerpendicularToAxis } from "@/lib/gradient/handles";
import { requestGradientEditorFocus } from "@/lib/gradientEditorFocus";
import {
  getGradientEditorVisibleNodeId,
  subscribeGradientEditorVisible,
} from "@/lib/gradientEditorVisibility";
import { setActiveGradientStopTarget } from "@/lib/gradientStopKeyboard";
import { resolveNodeFillGradientForEdit, resolveNodeWithDesignTokens } from "@/lib/designTokens";
import { getNodeWorldMatrixFromChildOrder } from "@/lib/editorGraph";
import { applyMatrixToPoint, invertMatrix } from "@/lib/transformMath";
import { useCanvasToWorld } from "../CanvasToWorldContext";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import { screenPxToOverlay, worldPointToOverlay } from "@/lib/canvasOverlaySpace";
import { useCanvasOverlaySpace } from "../useCanvasOverlaySpace";

const MIN_STOP_SPACING = 3;

function localToWorld(
  nodeId: string,
  local: { x: number; y: number },
  nodes: Record<string, import("@/stores/useEditorStore").EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  const matrix = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (matrix) return applyMatrixToPoint(matrix, local);
  const n = nodes[nodeId];
  return { x: (n?.x ?? 0) + local.x, y: (n?.y ?? 0) + local.y };
}

function worldToLocal(
  nodeId: string,
  world: { x: number; y: number },
  nodes: Record<string, import("@/stores/useEditorStore").EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  const matrix = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  if (matrix) {
    const inv = invertMatrix(matrix);
    if (inv) return applyMatrixToPoint(inv, world);
  }
  const n = nodes[nodeId];
  return { x: world.x - (n?.x ?? 0), y: world.y - (n?.y ?? 0) };
}

function stopLocalPoint(
  gradient: FillGradient,
  stop: GradientStop,
  width: number,
  height: number,
  positionOverride?: number,
): { x: number; y: number } {
  const position = positionOverride ?? stop.position;
  if (gradient.kind === "angular") {
    return angularStopLocalPointFromPosition(gradient, position, width, height);
  }
  return gradientStopLocalPoint(
    gradient,
    positionOverride != null ? { ...stop, position } : stop,
    width,
    height,
  );
}

function stopPositionFromLocal(
  gradient: FillGradient,
  localX: number,
  localY: number,
  width: number,
  height: number,
): number {
  if (gradient.kind === "angular") {
    return angularStopPositionFromLocalPoint(gradient, localX, localY, width, height);
  }
  return positionFromLocalPoint(gradient, localX, localY, width, height);
}

function positionFromClient(
  nodeId: string,
  clientX: number,
  clientY: number,
  gradient: FillGradient,
  clientToWorld: (x: number, y: number) => { x: number; y: number },
  nodes: Record<string, import("@/stores/useEditorStore").EditorNode>,
  childOrder: Record<string, string[]>,
): number {
  const current = nodes[nodeId];
  if (!current) return 0;
  const world = clientToWorld(clientX, clientY);
  const local = worldToLocal(nodeId, world, nodes, childOrder);
  return stopPositionFromLocal(gradient, local.x, local.y, current.width, current.height);
}

function tooCloseToExistingStop(stops: GradientStop[], position: number): boolean {
  return stops.some((s) => Math.abs(s.position - position) < MIN_STOP_SPACING);
}

const FILL_SHAPE_TYPES = new Set(["frame", "rectangle", "ellipse", "path", "polygon", "star"]);

type ScreenPoint = { x: number; y: number };

/** On-canvas gradient axis + color-stop handles (Figma-style). */
export function GradientHandlesOverlay() {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const designTokens = useEditorStore((s) => s.designTokens);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const overlay = useCanvasOverlaySpace();
  const toWorld = useCanvasToWorld();
  const [dragEndpoint, setDragEndpoint] = useState<0 | 1 | null>(null);
  const [dragStopId, setDragStopId] = useState<string | null>(null);
  const [liveStopPosition, setLiveStopPosition] = useState<number | null>(null);
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  const gradientEditorVisibleNodeId = useSyncExternalStore(
    subscribeGradientEditorVisible,
    getGradientEditorVisibleNodeId,
    () => null,
  );

  const id = selectedIds.length === 1 ? selectedIds[0]! : null;
  const node = id ? nodes[id] : null;
  const renderNode = useMemo(
    () => (node ? resolveNodeWithDesignTokens(node, designTokens) : null),
    [node, designTokens],
  );

  const show =
    id &&
    gradientEditorVisibleNodeId === id &&
    renderNode &&
    !renderNode.locked &&
    renderNode.visible !== false &&
    FILL_SHAPE_TYPES.has(renderNode.type) &&
    effectiveFillType(renderNode) === "gradient";

  const gradient = useMemo(
    () => (renderNode ? resolveEditableFillGradient(renderNode) : null),
    [renderNode],
  );

  useEffect(() => {
    if (!show || !id) {
      setActiveGradientStopTarget(null);
      return;
    }
    if (focusedStopId && gradient?.stops.some((s) => s.id === focusedStopId)) {
      setActiveGradientStopTarget({ nodeId: id, stopId: focusedStopId });
    }
  }, [show, id, focusedStopId, gradient]);

  useEffect(() => {
    if (focusedStopId && gradient && !gradient.stops.some((s) => s.id === focusedStopId)) {
      const fallback = gradient.stops[0]?.id ?? null;
      setFocusedStopId(fallback);
    }
  }, [gradient, focusedStopId]);

  const layout = useMemo(() => {
    if (!show || !id || !renderNode || !gradient) return null;

    const pixel = getGradientHandlePositions(gradient, renderNode.width, renderNode.height);
    const startWorld = localToWorld(id, pixel[0]!, nodes, childOrder);
    const endWorld = localToWorld(id, pixel[1]!, nodes, childOrder);
    const start = worldPointToOverlay(startWorld.x, startWorld.y, overlay);
    const end = worldPointToOverlay(endWorld.x, endWorld.y, overlay);

    const stops = gradient.stops.map((stop) => {
      const displayPosition =
        dragStopId === stop.id && liveStopPosition != null ? liveStopPosition : stop.position;
      const local = stopLocalPoint(gradient, stop, renderNode.width, renderNode.height, displayPosition);
      const world = localToWorld(id, local, nodes, childOrder);
      const axis = worldPointToOverlay(world.x, world.y, overlay);
      const swatch = offsetPerpendicularToAxis(
        axis,
        start,
        end,
        screenPxToOverlay(CANVAS_GRADIENT_STOP_OFFSET_SCREEN_PX, overlay),
      );
      const color = normalizeHex(stop.color) ?? stop.color;
      return { stop, axis, swatch, color, displayPosition };
    });

    return { start, end, stops };
  }, [show, id, renderNode, gradient, nodes, childOrder, overlay, dragStopId, liveStopPosition]);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      return clientToWorldFromDocument(clientX, clientY, { pan, zoom: z });
    },
    [toWorld],
  );

  const startEndpointDrag = useCallback(
    (handleIndex: 0 | 1, e: React.PointerEvent) => {
      if (!id || !node || !gradient) return;
      e.preventDefault();
      e.stopPropagation();
      setDragEndpoint(handleIndex);
      const captureEl = e.currentTarget as HTMLElement;
      try {
        captureEl.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        const st = useEditorStore.getState();
        const current = st.nodes[id];
        if (!current) return;
        const liveGradient = resolveNodeFillGradientForEdit(current, st.designTokens);
        const world = clientToWorld(ev.clientX, ev.clientY);
        const local = worldToLocal(id, world, st.nodes, st.childOrder);
        const nx = local.x / Math.max(1, current.width);
        const ny = local.y / Math.max(1, current.height);
        const next = updateGradientHandle(liveGradient, handleIndex, { x: nx, y: ny });
        st.updateNodeStyle(id, { fillType: "gradient", fillGradient: next }, { skipHistory: true });
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        try {
          if (captureEl.hasPointerCapture?.(e.pointerId)) {
            captureEl.releasePointerCapture(e.pointerId);
          }
        } catch {
          /* ignore */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setDragEndpoint(null);
        useEditorStore.getState().pushHistory();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [clientToWorld, gradient, id, node],
  );

  const startStopDrag = useCallback(
    (stopId: string, e: React.PointerEvent) => {
      if (!id || !node || !gradient) return;
      e.preventDefault();
      e.stopPropagation();
      setDragStopId(stopId);
      setFocusedStopId(stopId);
      setLiveStopPosition(null);
      let moved = false;

      const captureEl = e.currentTarget as HTMLElement;
      try {
        captureEl.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        moved = true;
        const st = useEditorStore.getState();
        const current = st.nodes[id];
        if (!current) return;
        const liveGradient = resolveNodeFillGradientForEdit(current, st.designTokens);
        const position = Math.max(
          0,
          Math.min(
            100,
            positionFromClient(
              id,
              ev.clientX,
              ev.clientY,
              liveGradient,
              clientToWorld,
              st.nodes,
              st.childOrder,
            ),
          ),
        );
        setLiveStopPosition(position);
        const next = normalizeFillGradient(
          updateStopPreserveOrder(liveGradient, stopId, { position }),
        );
        st.updateNodeStyle(id, { fillType: "gradient", fillGradient: next }, { skipHistory: true });
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        try {
          if (captureEl.hasPointerCapture?.(e.pointerId)) {
            captureEl.releasePointerCapture(e.pointerId);
          }
        } catch {
          /* ignore */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setDragStopId(null);
        setLiveStopPosition(null);
        const st = useEditorStore.getState();
        if (!moved) {
          requestGradientEditorFocus(id, stopId, { openColorPicker: false });
        } else {
          const current = st.nodes[id];
          if (current) {
            const liveGradient = resolveNodeFillGradientForEdit(current, st.designTokens);
            const sorted = normalizeFillGradient({
              ...liveGradient,
              stops: [...liveGradient.stops].sort((a, b) => a.position - b.position),
            });
            st.updateNodeStyle(id, { fillType: "gradient", fillGradient: sorted });
          }
          st.pushHistory();
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [clientToWorld, gradient, id, node],
  );

  const addStopOnAxis = useCallback(
    (e: React.PointerEvent<SVGLineElement>) => {
      if (!id || !node || !gradient) return;
      e.preventDefault();
      e.stopPropagation();
      const st = useEditorStore.getState();
      const current = st.nodes[id];
      if (!current) return;
      const liveGradient = resolveNodeFillGradientForEdit(current, st.designTokens);
      const position = Math.max(
        0,
        Math.min(
          100,
          positionFromClient(
            id,
            e.clientX,
            e.clientY,
            liveGradient,
            clientToWorld,
            st.nodes,
            st.childOrder,
          ),
        ),
      );
      if (tooCloseToExistingStop(liveGradient.stops, position)) return;
      const prevIds = new Set(liveGradient.stops.map((s) => s.id));
      const next = normalizeFillGradient(insertStopAtPosition(liveGradient, position));
      const added = next.stops.find((s) => !prevIds.has(s.id));
      st.updateNodeStyle(id, { fillType: "gradient", fillGradient: next });
      st.pushHistory();
      if (added) setFocusedStopId(added.id);
    },
    [clientToWorld, gradient, id, node],
  );

  if (!show || !layout) return null;

  const axisStroke = screenPxToOverlay(CANVAS_GRADIENT_AXIS_SCREEN_PX, overlay);
  const axisHitStroke = screenPxToOverlay(CANVAS_GRADIENT_AXIS_HIT_SCREEN_PX, overlay);
  const dotStyle = canvasGradientAxisDotStyle();

  const renderEndpoint = (pt: ScreenPoint, index: 0 | 1) => (
    <button
      key={index === 0 ? "start" : "end"}
      type="button"
      aria-label={index === 0 ? "Gradient start" : "Gradient end"}
      className="pointer-events-auto absolute z-[2] touch-none -translate-x-1/2 -translate-y-1/2"
      data-gradient-handle
      style={{
        left: pt.x,
        top: pt.y,
        ...dotStyle,
        boxShadow: dragEndpoint === index ? "0 0 0 1px #18a0fb" : undefined,
      }}
      onPointerDown={(e) => startEndpointDrag(index, e)}
    />
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[40] h-full w-full overflow-visible">
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <line
          x1={layout.start.x}
          y1={layout.start.y}
          x2={layout.end.x}
          y2={layout.end.y}
          stroke="transparent"
          strokeWidth={axisHitStroke}
          className="pointer-events-auto cursor-crosshair touch-none"
          data-gradient-handle
          onPointerDown={addStopOnAxis}
        />
        <line
          x1={layout.start.x}
          y1={layout.start.y}
          x2={layout.end.x}
          y2={layout.end.y}
          stroke="#ffffff"
          strokeWidth={axisStroke}
          className="pointer-events-none"
        />
        {layout.stops.map(({ stop, axis, swatch }) => (
          <g key={stop.id} className="pointer-events-none">
            <line
              x1={axis.x}
              y1={axis.y}
              x2={swatch.x}
              y2={swatch.y}
              stroke="#ffffff"
              strokeWidth={axisStroke}
            />
          </g>
        ))}
      </svg>

      {layout.stops.map(({ stop, axis, swatch, color, displayPosition }) => {
        const selected = focusedStopId === stop.id || dragStopId === stop.id;
        const squareStyle = canvasGradientStopSquareStyle(color, selected);
        return (
          <div key={stop.id}>
            <button
              type="button"
              aria-label={`Gradient stop axis at ${displayPosition}%`}
              className="pointer-events-auto absolute z-[2] touch-none -translate-x-1/2 -translate-y-1/2"
              data-gradient-handle
              style={{
                left: axis.x,
                top: axis.y,
                ...dotStyle,
                boxShadow: selected ? "0 0 0 1px #18a0fb" : undefined,
              }}
              onPointerDown={(e) => startStopDrag(stop.id, e)}
            />
            <button
              type="button"
              aria-label={`Gradient stop at ${displayPosition}%`}
              className="pointer-events-auto absolute z-[3] touch-none -translate-x-1/2 -translate-y-1/2"
              data-gradient-handle
              style={{
                left: swatch.x,
                top: swatch.y,
                ...squareStyle,
              }}
              onPointerDown={(e) => startStopDrag(stop.id, e)}
            />
          </div>
        );
      })}

      {renderEndpoint(layout.start, 0)}
      {renderEndpoint(layout.end, 1)}
    </div>
  );
}
