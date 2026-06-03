"use client";

import { useCallback, useRef, useState } from "react";
import { mergeInstanceOverrides } from "@/lib/componentModel";
import { resolveNodeWithDesignTokens } from "@/lib/designTokens";
import {
  effectiveFillType,
  gradientStopLocalPoint,
  gradientTransformHandleLocalPoints,
  linearEndpoints,
  newGradientStopId,
  normalizeFillGradient,
  positionFromLocalPoint,
  resolveEditableFillGradient,
  type FillGradient,
  type GradientStop,
} from "@/lib/fillGradient";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { worldRect } from "@/lib/tree";
import { screenPxToWorld } from "@/lib/canvasVisual";

type DragKind =
  | null
  | { kind: "stop"; stopId: string; pointerId: number }
  | { kind: "center"; pointerId: number }
  | { kind: "width"; pointerId: number }
  | { kind: "rotate"; pointerId: number; startAngle: number; startRotation: number };

export function GradientEditorLayer() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const designTokens = useEditorStore((s) => s.designTokens);
  const editorMode = useEditorStore((s) => s.editorMode);
  const tool = useEditorStore((s) => s.tool);
  const zoom = useEditorStore((s) => s.zoom);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const updateDesignToken = useEditorStore((s) => s.updateDesignToken);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const toWorldFn = useCanvasToWorld();

  const dragRef = useRef<DragKind>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  const nodeId = selectedIds.length === 1 ? selectedIds[0]! : null;
  const nodeRaw = nodeId ? nodes[nodeId] : null;
  const node = nodeRaw
    ? resolveNodeWithDesignTokens(mergeInstanceOverrides(nodeRaw, nodes), designTokens)
    : null;

  const readGradientState = useCallback(() => {
    const st = useEditorStore.getState();
    const raw = nodeId ? st.nodes[nodeId] : null;
    if (!raw) return null;
    const resolved = resolveNodeWithDesignTokens(
      mergeInstanceOverrides(raw, st.nodes),
      st.designTokens,
    );
    const g = resolveEditableFillGradient(
      { ...resolved, fillTokenId: raw.fillTokenId },
      st.designTokens,
    );
    if (!g) return null;
    const rect = worldRect(nodeId!, st.nodes);
    return { g, raw, resolved, rect, w: resolved.width, h: resolved.height };
  }, [nodeId]);

  if (
    editorMode !== "design" ||
    tool === "hand" ||
    tool === "comment" ||
    !node ||
    !nodeId ||
    node.locked ||
    !node.visible ||
    !toWorldFn ||
    effectiveFillType(node) !== "gradient"
  ) {
    return null;
  }

  const canFill =
    node.type === "rectangle" ||
    node.type === "ellipse" ||
    node.type === "frame" ||
    node.type === "path";
  if (!canFill) return null;

  const g = normalizeFillGradient(node.fillGradient, node.fill);
  const wr = worldRect(nodeId, nodes);
  const w = node.width;
  const h = node.height;

  const toWorld = (lx: number, ly: number) => ({ x: wr.x + lx, y: wr.y + ly });

  const handles = gradientTransformHandleLocalPoints(g, w, h);
  const centerW = toWorld(handles.center.x, handles.center.y);
  const widthW = toWorld(handles.width.x, handles.width.y);
  const rotateW = toWorld(handles.rotate.x, handles.rotate.y);

  const commitGradient = (next: FillGradient, history = false) => {
    if (history) pushHistory();
    const normalized = normalizeFillGradient(next, node.fill);
    const raw = useEditorStore.getState().nodes[nodeId]!;
    const tok = raw.fillTokenId ? useEditorStore.getState().designTokens[raw.fillTokenId] : undefined;
    if (raw.fillTokenId && tok?.type === "gradient") {
      updateDesignToken(raw.fillTokenId, { value: normalized });
      return;
    }
    updateNodeStyle(
      nodeId,
      { fillType: "gradient", fillGradient: normalized },
      { skipHistory: !history },
    );
  };

  const addStopAtWorld = (wx: number, wy: number) => {
    const st = readGradientState();
    if (!st) return;
    const lx = wx - st.rect.x;
    const ly = wy - st.rect.y;
    const pos = positionFromLocalPoint(st.g, lx, ly, st.w, st.h);
    const sorted = [...st.g.stops].sort((a, b) => a.position - b.position);
    const before = sorted.filter((s) => s.position <= pos).pop();
    const color = before?.color ?? sorted[0]?.color ?? "#ffffff";
    const id = newGradientStopId();
    pushHistory();
    commitGradient(
      {
        ...st.g,
        stops: [...st.g.stops, { id, color, position: pos }].sort((a, b) => a.position - b.position),
      },
      true,
    );
    setSelectedStopId(id);
  };

  const bindDrag = (captureTarget: Element) => {
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      const st = readGradientState();
      if (!st || !toWorldFn) return;
      const wpt = toWorldFn(ev.clientX, ev.clientY);
      const lx = wpt.x - st.rect.x;
      const ly = wpt.y - st.rect.y;

      if (d.kind === "stop") {
        const pos = positionFromLocalPoint(st.g, lx, ly, st.w, st.h);
        const stops = st.g.stops.map((s) => (s.id === d.stopId ? { ...s, position: pos } : s));
        commitGradient({ ...st.g, stops });
        return;
      }
      if (d.kind === "center") {
        commitGradient({
          ...st.g,
          transform: {
            ...st.g.transform,
            cx: Math.min(1, Math.max(0, lx / st.w)),
            cy: Math.min(1, Math.max(0, ly / st.h)),
          },
        });
        return;
      }
      if (d.kind === "width") {
        const dx = lx - st.g.transform.cx * st.w;
        const dy = ly - st.g.transform.cy * st.h;
        const dist = Math.hypot(dx, dy) * 2;
        commitGradient({
          ...st.g,
          transform: { ...st.g.transform, width: Math.min(2, Math.max(0.05, dist / st.w)) },
        });
        return;
      }
      if (d.kind === "rotate") {
        const angle =
          (Math.atan2(ly - st.g.transform.cy * st.h, lx - st.g.transform.cx * st.w) * 180) /
          Math.PI;
        commitGradient({
          ...st.g,
          transform: {
            ...st.g.transform,
            rotation: ((d.startRotation + angle - d.startAngle) % 360 + 360) % 360,
          },
        });
      }
    };
    const onUp = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      dragRef.current = null;
      try {
        captureTarget.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const onStopPointerDown = (stop: GradientStop, e: React.PointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedStopId(stop.id);
    pushHistory();
    dragRef.current = { kind: "stop", stopId: stop.id, pointerId: e.pointerId };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    bindDrag(e.currentTarget);
  };

  const onHandlePointerDown = (
    kind: "center" | "width" | "rotate",
    e: React.PointerEvent<SVGCircleElement>,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    if (kind === "rotate") {
      const st = readGradientState();
      if (!st) return;
      const wpt = toWorldFn!(e.clientX, e.clientY);
      const lx = wpt.x - st.rect.x;
      const ly = wpt.y - st.rect.y;
      const angle =
        (Math.atan2(ly - st.g.transform.cy * st.h, lx - st.g.transform.cx * st.w) * 180) / Math.PI;
      dragRef.current = {
        kind: "rotate",
        pointerId: e.pointerId,
        startAngle: angle,
        startRotation: st.g.transform.rotation,
      };
    } else {
      dragRef.current = { kind, pointerId: e.pointerId };
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    bindDrag(e.currentTarget);
  };

  const line =
    g.kind === "linear"
      ? (() => {
          const { x1, y1, x2, y2 } = linearEndpoints(g.transform, w, h);
          const a = toWorld(x1, y1);
          const b = toWorld(x2, y2);
          return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
        })()
      : null;

  const handleR = screenPxToWorld(6, zoom);
  const hitR = handleR + screenPxToWorld(4, zoom);

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[35] h-full w-full overflow-visible"
      data-gradient-editor
    >
      {line ? (
        <line
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="transparent"
          strokeWidth={screenPxToWorld(12, zoom)}
          className="pointer-events-auto cursor-crosshair"
          onDoubleClick={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            const wpt = toWorldFn!(e.clientX, e.clientY);
            addStopAtWorld(wpt.x, wpt.y);
          }}
        />
      ) : null}
      {line ? (
        <line
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="#18a0fb"
          strokeWidth={screenPxToWorld(1.5, zoom)}
          strokeDasharray={`${screenPxToWorld(4, zoom)} ${screenPxToWorld(3, zoom)}`}
          className="pointer-events-none"
        />
      ) : null}
      {g.stops.map((stop) => {
        const lp = gradientStopLocalPoint(g, stop, w, h);
        const wp = toWorld(lp.x, lp.y);
        const sel = selectedStopId === stop.id;
        return (
          <g key={stop.id} className="pointer-events-auto cursor-grab active:cursor-grabbing">
            <circle
              cx={wp.x}
              cy={wp.y}
              r={hitR}
              fill="transparent"
              onPointerDown={(e) => onStopPointerDown(stop, e)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (g.stops.length <= 2) return;
                pushHistory();
                commitGradient({ ...g, stops: g.stops.filter((s) => s.id !== stop.id) }, true);
              }}
            />
            <circle
              cx={wp.x}
              cy={wp.y}
              r={handleR + screenPxToWorld(sel ? 1 : 0, zoom)}
              fill={stop.color}
              stroke={sel ? "#fbbf24" : "#ffffff"}
              strokeWidth={screenPxToWorld(2, zoom)}
              className="pointer-events-none"
            />
          </g>
        );
      })}
      <g className="pointer-events-auto">
        <circle
          cx={centerW.x}
          cy={centerW.y}
          r={hitR}
          fill="transparent"
          className="cursor-move"
          onPointerDown={(e) => onHandlePointerDown("center", e)}
        />
        <circle
          cx={centerW.x}
          cy={centerW.y}
          r={handleR}
          fill="#18a0fb"
          stroke="#fff"
          strokeWidth={screenPxToWorld(1.5, zoom)}
          className="pointer-events-none"
        />
        <circle
          cx={widthW.x}
          cy={widthW.y}
          r={hitR}
          fill="transparent"
          className="cursor-ew-resize"
          onPointerDown={(e) => onHandlePointerDown("width", e)}
        />
        <circle
          cx={widthW.x}
          cy={widthW.y}
          r={handleR}
          fill="#ffffff"
          stroke="#18a0fb"
          strokeWidth={screenPxToWorld(1.5, zoom)}
          className="pointer-events-none"
        />
        <circle
          cx={rotateW.x}
          cy={rotateW.y}
          r={hitR}
          fill="transparent"
          className="cursor-grab"
          onPointerDown={(e) => onHandlePointerDown("rotate", e)}
        />
        <circle
          cx={rotateW.x}
          cy={rotateW.y}
          r={handleR}
          fill="#ffffff"
          stroke="#a855f7"
          strokeWidth={screenPxToWorld(1.5, zoom)}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => onHandlePointerDown("rotate", e)}
        />
        <line
          x1={centerW.x}
          y1={centerW.y}
          x2={rotateW.x}
          y2={rotateW.y}
          stroke="#a855f7"
          strokeWidth={screenPxToWorld(1, zoom)}
          className="pointer-events-none"
        />
      </g>
    </svg>
  );
}
