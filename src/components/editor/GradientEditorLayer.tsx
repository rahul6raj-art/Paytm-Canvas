"use client";

import { useRef, useState } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import {
  effectiveFillType,
  gradientStopLocalPoint,
  gradientTransformHandleLocalPoints,
  linearEndpoints,
  normalizeFillGradient,
  positionFromLocalPoint,
  type FillGradient,
  type GradientStop,
} from "@/lib/fillGradient";
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
  const editorMode = useEditorStore((s) => s.editorMode);
  const tool = useEditorStore((s) => s.tool);
  const zoom = useEditorStore((s) => s.zoom);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const toWorldFn = useCanvasToWorld();

  const dragRef = useRef<DragKind>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  const nodeId = selectedIds.length === 1 ? selectedIds[0]! : null;
  const node = nodeId ? nodes[nodeId] : null;

  if (
    editorMode !== "design" ||
    tool !== "move" ||
    !node ||
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
  const wr = worldRect(nodeId!, nodes);
  const w = node.width;
  const h = node.height;

  const toWorld = (lx: number, ly: number) => ({ x: wr.x + lx, y: wr.y + ly });

  const handles = gradientTransformHandleLocalPoints(g, w, h);
  const centerW = toWorld(handles.center.x, handles.center.y);
  const widthW = toWorld(handles.width.x, handles.width.y);
  const rotateW = toWorld(handles.rotate.x, handles.rotate.y);

  const commitGradient = (next: FillGradient, history = false) => {
    if (history) pushHistory();
    updateNodeStyle(nodeId!, { fillType: "gradient", fillGradient: next }, { skipHistory: !history });
  };

  const bindDrag = () => {
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      const st = useEditorStore.getState();
      const n = st.nodes[nodeId!];
      if (!n || !toWorldFn) return;
      const cur = normalizeFillGradient(n.fillGradient, n.fill);
      const rect = worldRect(nodeId!, st.nodes);
      const wpt = toWorldFn(ev.clientX, ev.clientY);
      const lx = wpt.x - rect.x;
      const ly = wpt.y - rect.y;

      if (d.kind === "stop") {
        const pos = positionFromLocalPoint(cur, lx, ly, w, h);
        const stops = cur.stops.map((s) => (s.id === d.stopId ? { ...s, position: pos } : s));
        commitGradient({ ...cur, stops });
        return;
      }
      if (d.kind === "center") {
        commitGradient({
          ...cur,
          transform: {
            ...cur.transform,
            cx: Math.min(1, Math.max(0, lx / w)),
            cy: Math.min(1, Math.max(0, ly / h)),
          },
        });
        return;
      }
      if (d.kind === "width") {
        const dx = lx - cur.transform.cx * w;
        const dy = ly - cur.transform.cy * h;
        const dist = Math.hypot(dx, dy) * 2;
        commitGradient({
          ...cur,
          transform: { ...cur.transform, width: Math.min(2, Math.max(0.05, dist / w)) },
        });
        return;
      }
      if (d.kind === "rotate") {
        const angle = (Math.atan2(ly - cur.transform.cy * h, lx - cur.transform.cx * w) * 180) / Math.PI;
        commitGradient({
          ...cur,
          transform: {
            ...cur.transform,
            rotation: ((d.startRotation + angle - d.startAngle) % 360 + 360) % 360,
          },
        });
      }
    };
    const onUp = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const onStopPointerDown = (stop: GradientStop, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedStopId(stop.id);
    pushHistory();
    dragRef.current = { kind: "stop", stopId: stop.id, pointerId: e.pointerId };
    bindDrag();
  };

  const onHandlePointerDown = (kind: "center" | "width" | "rotate", e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    if (kind === "rotate") {
      const rect = worldRect(nodeId!, useEditorStore.getState().nodes);
      const wpt = toWorldFn!(e.clientX, e.clientY);
      const lx = wpt.x - rect.x;
      const ly = wpt.y - rect.y;
      const angle = (Math.atan2(ly - handles.center.y, lx - handles.center.x) * 180) / Math.PI;
      dragRef.current = {
        kind: "rotate",
        pointerId: e.pointerId,
        startAngle: angle,
        startRotation: g.transform.rotation,
      };
    } else {
      dragRef.current = { kind, pointerId: e.pointerId };
    }
    bindDrag();
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

  const handleR = screenPxToWorld(5, zoom);

  return (
    <svg className="pointer-events-none absolute inset-0 z-[18] h-full w-full overflow-visible">
      {line ? (
        <line
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="#18a0fb"
          strokeWidth={screenPxToWorld(1.5, zoom)}
          strokeDasharray={`${screenPxToWorld(4, zoom)} ${screenPxToWorld(3, zoom)}`}
        />
      ) : null}
      {g.stops.map((stop) => {
        const lp = gradientStopLocalPoint(g, stop, w, h);
        const wp = toWorld(lp.x, lp.y);
        const sel = selectedStopId === stop.id;
        return (
          <g key={stop.id} className="pointer-events-auto cursor-grab">
            <circle
              cx={wp.x}
              cy={wp.y}
              r={handleR + screenPxToWorld(sel ? 2 : 0, zoom)}
              fill={stop.color}
              stroke={sel ? "#fbbf24" : "#ffffff"}
              strokeWidth={screenPxToWorld(2, zoom)}
              onPointerDown={(e) => onStopPointerDown(stop, e)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (g.stops.length <= 2) return;
                pushHistory();
                commitGradient({ ...g, stops: g.stops.filter((s) => s.id !== stop.id) }, true);
              }}
            />
          </g>
        );
      })}
      <g className="pointer-events-auto">
        <circle
          cx={centerW.x}
          cy={centerW.y}
          r={handleR}
          fill="#18a0fb"
          stroke="#fff"
          strokeWidth={screenPxToWorld(1.5, zoom)}
          className="cursor-move"
          onPointerDown={(e) => onHandlePointerDown("center", e)}
        />
        <circle
          cx={widthW.x}
          cy={widthW.y}
          r={handleR}
          fill="#ffffff"
          stroke="#18a0fb"
          strokeWidth={screenPxToWorld(1.5, zoom)}
          className="cursor-ew-resize"
          onPointerDown={(e) => onHandlePointerDown("width", e)}
        />
        <circle
          cx={rotateW.x}
          cy={rotateW.y}
          r={handleR}
          fill="#ffffff"
          stroke="#a855f7"
          strokeWidth={screenPxToWorld(1.5, zoom)}
          className="cursor-grab"
          onPointerDown={(e) => onHandlePointerDown("rotate", e)}
        />
        <line
          x1={centerW.x}
          y1={centerW.y}
          x2={rotateW.x}
          y2={rotateW.y}
          stroke="#a855f7"
          strokeWidth={screenPxToWorld(1, zoom)}
        />
      </g>
    </svg>
  );
}
