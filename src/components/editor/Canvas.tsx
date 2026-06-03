"use client";

import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { Grid3X3, Ruler } from "lucide-react";
import { CanvasRulers } from "./CanvasRulers";
import { SelectionBox } from "./SelectionBox";
import { SceneRenderer } from "@/editor-core/renderer/SceneRenderer";
import { RootFrameLabels } from "./RootFrameLabels";
import { PrototypeWireLayer } from "./PrototypeWireLayer";
import { AltMeasureLayer } from "./AltMeasureLayer";
import { DragSnapOverlay } from "./DragSnapOverlay";
import { pickLayoutGuideAt } from "@/lib/layoutGuidePick";
import { LayoutGuidesOverlay } from "./LayoutGuidesOverlay";
import { InspectMeasurementsLayer } from "./InspectMeasurementsLayer";
import { PresenceLayer } from "./PresenceLayer";
import { CommentPinLayer } from "./CommentPinLayer";
import { GradientEditorLayer } from "./GradientEditorLayer";
import { ComponentPlacementPreview } from "./ComponentPlacementPreview";
import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";
import { CanvasToWorldContext } from "./CanvasToWorldContext";
import { CanvasInteractionContext } from "./CanvasInteractionContext";
import { clientToWorld } from "@/lib/canvasCoordinates";
import { useTheme } from "@/components/ThemeProvider";
import { CANVAS_VISUAL, displayCanvasBackground } from "@/lib/canvasVisual";
import { useOptionPointerTracking } from "@/hooks/useOptionPointerTracking";
import { pickDeepestNodeAtWorldPoint, pickDeepestVisibleNodeAtWorldPoint, worldRect } from "@/lib/tree";
import { startCanvasMarqueeSession } from "@/lib/canvasMarqueeSession";
import { validateImageImportFile } from "@/lib/editorAssets";
import { EMPTY_CHILD_IDS } from "@/lib/editorConstants";
import { registerMarqueeAbortHandler } from "@/lib/canvasMarqueeController";
import { isPaytmCraftDebugCanvas } from "@/lib/env";
import { getRendererMode } from "@/lib/rendererMode";
import {
  isCanvasBgCreationTool,
  isCanvasChromeTarget,
} from "@/lib/canvasInteractionGuards";
import { boundsFromDrag, lineGeometryFromDrag, toolToShapeType, type ShapeType } from "@/lib/shapes";
import { getRenderedWorldTopLeft } from "@/lib/editorGraph";

const PEN_CURVE_DRAG_THRESHOLD = 4;
import { wheelZoomFactor, zoomAtScreenPoint } from "@/lib/canvasZoom";
import {
  activateCanvasForShortcuts,
  focusCanvasViewport,
  releaseFieldFocusForCanvas,
} from "@/lib/editorKeyboardFocus";
import {
  clearPostCreationPointerSuppress,
  shouldSuppressCanvasPointer,
  suppressPostCreationPointer,
} from "@/lib/canvasCreationGuard";

function penPreviewPathD(
  points: { x: number; y: number; handleIn?: { x: number; y: number }; handleOut?: { x: number; y: number } }[],
): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1]!;
    const p1 = points[i]!;
    const hasCurve = Boolean(p0.handleOut || p1.handleIn);
    if (hasCurve) {
      const c1x = p0.x + (p0.handleOut?.x ?? 0);
      const c1y = p0.y + (p0.handleOut?.y ?? 0);
      const c2x = p1.x + (p1.handleIn?.x ?? 0);
      const c2y = p1.y + (p1.handleIn?.y ?? 0);
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p1.x} ${p1.y}`;
    } else {
      d += ` L ${p1.x} ${p1.y}`;
    }
  }
  return d;
}

function PenStrokePreview({
  drawId,
  hover,
  placement,
  nodes,
  childOrder,
}: {
  drawId: string;
  hover: { x: number; y: number };
  placement: { anchor: { x: number; y: number }; drag: { x: number; y: number } } | null;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
}) {
  const n = nodes[drawId];
  const pts = n?.pathPoints ?? [];
  if (!pts.length) return null;
  const origin = getRenderedWorldTopLeft(drawId, nodes, childOrder);
  const worldPts = pts.map((p) => ({
    x: origin.x + p.x,
    y: origin.y + p.y,
    handleIn: p.handleIn,
    handleOut: p.handleOut,
  }));
  const previewPts = [...worldPts];
  if (placement) {
    const hx = placement.drag.x - placement.anchor.x;
    const hy = placement.drag.y - placement.anchor.y;
    const last = previewPts[previewPts.length - 1]!;
    previewPts[previewPts.length - 1] = { ...last, handleOut: { x: hx, y: hy } };
    previewPts.push({
      x: placement.anchor.x,
      y: placement.anchor.y,
      handleIn: { x: -hx, y: -hy },
      handleOut: undefined,
    });
  }
  const d = penPreviewPathD(previewPts);
  const last = worldPts[worldPts.length - 1]!;
  const target = placement?.drag ?? hover;
  const first = worldPts[0]!;
  const canClose =
    pts.length >= 2 && !placement && Math.hypot(target.x - first.x, target.y - first.y) <= 12;
  return (
    <svg className="pointer-events-none absolute inset-0 z-[17] h-full w-full overflow-visible">
      {d ? (
        <path
          d={d}
          fill="none"
          stroke={CANVAS_VISUAL.selection}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {!placement ? (
        <line
          x1={last.x}
          y1={last.y}
          x2={target.x}
          y2={target.y}
          stroke={canClose ? "#22c55e" : CANVAS_VISUAL.selection}
          strokeWidth={2}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {canClose ? (
        <circle
          cx={first.x}
          cy={first.y}
          r={10}
          fill="none"
          stroke="#22c55e"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}

function ShapeDraftPreview({
  draft,
}: {
  draft: {
    shapeType: ShapeType;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    shiftKey: boolean;
    altKey: boolean;
  };
}) {
  const start = { x: draft.x0, y: draft.y0 };
  const end = { x: draft.x1, y: draft.y1 };
  const mods = { shiftKey: draft.shiftKey, altKey: draft.altKey };

  if (draft.shapeType === "line" || draft.shapeType === "arrow") {
    const g = lineGeometryFromDrag(start, end, mods);
    const midY = g.height / 2;
    return (
      <div
        className="pointer-events-none absolute z-[19] overflow-visible"
        style={{
          left: g.x,
          top: g.y,
          width: g.width,
          height: g.height,
          transform: g.rotation ? `rotate(${g.rotation}deg)` : undefined,
          transformOrigin: "0 50%",
        }}
        aria-hidden
      >
        <svg
          className="block overflow-visible"
          width={Math.max(1, g.width)}
          height={Math.max(1, g.height)}
        >
          <line
            x1={0}
            y1={midY}
            x2={g.width}
            y2={midY}
            stroke="#18a0fb"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  const box = boundsFromDrag(start, end, mods, {
    preserveAspect: draft.shapeType === "ellipse",
  });
  const rounded = draft.shapeType === "ellipse";

  return (
    <svg
      className="pointer-events-none absolute z-[19] overflow-visible"
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
      width={Math.max(1, box.width)}
      height={Math.max(1, box.height)}
      aria-hidden
    >
      {rounded ? (
        <ellipse
          cx={box.width / 2}
          cy={box.height / 2}
          rx={box.width / 2}
          ry={box.height / 2}
          fill="rgba(13,153,255,0.12)"
          stroke="#18a0fb"
          strokeWidth={2}
        />
      ) : (
        <rect
          x={0}
          y={0}
          width={box.width}
          height={box.height}
          fill="rgba(13,153,255,0.12)"
          stroke="#18a0fb"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}

export function Canvas() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasBgRef = useRef<HTMLDivElement>(null);
  const zoom = useEditorStore((s) => s.zoom);
  const pan = useEditorStore((s) => s.pan);
  const setPan = useEditorStore((s) => s.setPan);
  const showGrid = useEditorStore((s) => s.showGrid);
  const showRulers = useEditorStore((s) => s.showRulers);
  const storedCanvasBg = useEditorStore((s) => s.canvasBackgroundColor);
  const { resolved: themeResolved } = useTheme();
  const canvasBackgroundColor = useMemo(
    () => displayCanvasBackground(storedCanvasBg, themeResolved),
    [storedCanvasBg, themeResolved],
  );
  const gridLineColor =
    themeResolved === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.045)";
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const toggleRulers = useEditorStore((s) => s.toggleRulers);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const tool = useEditorStore((s) => s.tool);
  const addRectangleAt = useEditorStore((s) => s.addRectangleAt);
  const addEllipseAt = useEditorStore((s) => s.addEllipseAt);
  const addLineAt = useEditorStore((s) => s.addLineAt);
  const addTriangleAt = useEditorStore((s) => s.addTriangleAt);
  const createShapeFromDrag = useEditorStore((s) => s.createShapeFromDrag);
  const addTextAt = useEditorStore((s) => s.addTextAt);
  const createFrameAt = useEditorStore((s) => s.createFrameAt);
  const createFrameWithBounds = useEditorStore((s) => s.createFrameWithBounds);
  const createInstance = useEditorStore((s) => s.createInstance);
  const addImageNodeAt = useEditorStore((s) => s.addImageNodeAt);
  const importImageAsset = useEditorStore((s) => s.importImageAsset);
  const placingComponentMasterId = useEditorStore((s) => s.placingComponentMasterId);
  const setPlacingComponentMasterId = useEditorStore((s) => s.setPlacingComponentMasterId);
  const rootIds = useEditorStore((s) => s.childOrder[ROOT] ?? EMPTY_CHILD_IDS);
  const childOrder = useEditorStore((s) => s.childOrder);
  const assets = useEditorStore((s) => s.assets);
  const designTokens = useEditorStore((s) => s.designTokens);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editorMode = useEditorStore((s) => s.editorMode);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const addComment = useEditorStore((s) => s.addComment);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const nodes = useEditorStore((s) => s.nodes);

  const [penHoverWorld, setPenHoverWorld] = useState<{ x: number; y: number } | null>(null);
  const [penPlacement, setPenPlacement] = useState<{
    anchor: { x: number; y: number };
    drag: { x: number; y: number };
  } | null>(null);
  const penPlacementRef = useRef<{ anchor: { x: number; y: number }; drag: { x: number; y: number } } | null>(
    null,
  );
  const [spaceDown, setSpaceDown] = useState(false);
  const [optionDown, setOptionDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [marquee, setMarquee] = useState<null | { x0: number; y0: number; x1: number; y1: number }>(null);
  const [frameDraft, setFrameDraft] = useState<null | { x0: number; y0: number; x1: number; y1: number }>(
    null,
  );
  const [shapeDraft, setShapeDraft] = useState<null | {
    shapeType: ShapeType;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    shiftKey: boolean;
    altKey: boolean;
  }>(null);
  const frameDraftRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const shapeDraftRef = useRef<{
    shapeType: ShapeType;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    shiftKey: boolean;
    altKey: boolean;
  } | null>(null);
  const shapeSessionCleanupRef = useRef<(() => void) | null>(null);
  const pencilSessionCleanupRef = useRef<(() => void) | null>(null);
  const penSessionCleanupRef = useRef<(() => void) | null>(null);
  const frameSessionCleanupRef = useRef<(() => void) | null>(null);
  const panDrag = useRef<{ pointerId: number; sx: number; sy: number; px: number; py: number } | null>(
    null,
  );

  useEffect(() => {
    registerMarqueeAbortHandler(() => {
      frameSessionCleanupRef.current?.();
      shapeSessionCleanupRef.current?.();
      pencilSessionCleanupRef.current?.();
      penSessionCleanupRef.current?.();
    });
    return () => {
      registerMarqueeAbortHandler(null);
      frameSessionCleanupRef.current?.();
      shapeSessionCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!penDrawingNodeId) {
      penSessionCleanupRef.current?.();
      penPlacementRef.current = null;
      setPenPlacement(null);
    }
  }, [penDrawingNodeId]);

  useEffect(() => {
    if (tool !== "pen") {
      penSessionCleanupRef.current?.();
      penPlacementRef.current = null;
      setPenPlacement(null);
    }
  }, [tool]);

  useEffect(() => {
    const syncOption = (e: KeyboardEvent) => setOptionDown(e.altKey);
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(true);
      syncOption(e);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
      syncOption(e);
    };
    const onBlur = () => {
      setOptionDown(false);
      setSpaceDown(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        setOptionDown(false);
        setSpaceDown(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const toWorld = useCallback(
    (clientX: number, clientY: number) =>
      clientToWorld(clientX, clientY, viewportRef.current, { pan, zoom }),
    [pan, zoom],
  );

  const { optionOverSelection, optionPointerHoverId } = useOptionPointerTracking(
    optionDown,
    editorMode,
    toWorld,
  );

  const startMarquee = useCallback(
    (e: React.PointerEvent, captureTarget: HTMLElement) => {
      startCanvasMarqueeSession({
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        shiftKey: e.shiftKey,
        captureTarget,
        clientToWorld: toWorld,
        onRectChange: setMarquee,
      });
    },
    [toWorld],
  );

  const handleViewportWheel = useCallback((e: WheelEvent) => {
    const el = viewportRef.current;
    if (!el) return;

    // Must run from a non-passive listener — React's onWheel is passive, so preventDefault()
    // is ignored and pinch/ctrl+wheel zooms the whole browser page instead of the canvas.
    e.preventDefault();
    e.stopPropagation();

    const st = useEditorStore.getState();

    if (e.ctrlKey || e.metaKey) {
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const factor = wheelZoomFactor(e.deltaY, e.deltaMode, { pageHeight: el.clientHeight });
      const next = zoomAtScreenPoint({
        zoom: st.zoom,
        pan: st.pan,
        focusX: mx,
        focusY: my,
        factor,
      });
      useEditorStore.setState(next);
      return;
    }

    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
    st.patchPan({ x: -e.deltaX * scale, y: -e.deltaY * scale });
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const blockSafariGesture = (ev: Event) => {
      ev.preventDefault();
    };

    el.addEventListener("wheel", handleViewportWheel, { passive: false });
    el.addEventListener("gesturestart", blockSafariGesture, { passive: false });
    el.addEventListener("gesturechange", blockSafariGesture, { passive: false });
    el.addEventListener("gestureend", blockSafariGesture, { passive: false });

    return () => {
      el.removeEventListener("wheel", handleViewportWheel);
      el.removeEventListener("gesturestart", blockSafariGesture);
      el.removeEventListener("gesturechange", blockSafariGesture);
      el.removeEventListener("gestureend", blockSafariGesture);
    };
  }, [handleViewportWheel]);

  const panning = tool === "hand" || spaceDown;

  const pointerCaptureTarget = useCallback((): HTMLElement => {
    return canvasBgRef.current ?? viewportRef.current!;
  }, []);

  const onBgPointerDown = (e: React.PointerEvent) => {
    if (shouldSuppressCanvasPointer()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    clearPostCreationPointerSuppress();
    const debugCanvas = isPaytmCraftDebugCanvas();
    let creationBranch: string | null = null;
    const st = useEditorStore.getState();
    const activeTool = st.tool;
    const activeMode = st.editorMode;
    const activePlacingComment = activeMode === "design" && activeTool === "comment" && st.isPlacingComment;
    const activePanning = activeTool === "hand" || spaceDown;

    if (e.button === 1 || activePanning) {
      e.preventDefault();
      setIsPanning(true);
      panDrag.current = {
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        px: pan.x,
        py: pan.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        const d = panDrag.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        setPan({ x: d.px + (ev.clientX - d.sx), y: d.py + (ev.clientY - d.sy) });
      };
      const onUp = (ev: PointerEvent) => {
        const d = panDrag.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        panDrag.current = null;
        setIsPanning(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return;
    }

    if (e.button !== 0) return;

    if (activeMode === "inspect") {
      clearSelection();
      return;
    }

    const w = toWorld(e.clientX, e.clientY);

    if (activeTool === "move" && st.placingComponentMasterId) {
      createInstance(st.placingComponentMasterId, w.x, w.y);
      setPlacingComponentMasterId(null);
      return;
    }

    if (activeMode === "design") {
      if (activeTool === "frame") {
        creationBranch = "frame";
        frameSessionCleanupRef.current?.();
        const w0 = toWorld(e.clientX, e.clientY);
        const rect0 = { x0: w0.x, y0: w0.y, x1: w0.x, y1: w0.y };
        frameDraftRef.current = rect0;
        setFrameDraft(rect0);

        const target = pointerCaptureTarget();
        const capId = e.pointerId;
        try {
          target.setPointerCapture(capId);
        } catch {
          /* ignore — pointerup still ends the session */
        }

        let ended = false;
        const removeListeners = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onPointerEnd);
          window.removeEventListener("pointercancel", onPointerEnd);
        };

        const finish = (commit: boolean) => {
          if (ended) return;
          ended = true;
          frameSessionCleanupRef.current = null;
          removeListeners();
          try {
            target.releasePointerCapture(capId);
          } catch {
            /* already released */
          }
          const m = frameDraftRef.current;
          frameDraftRef.current = null;
          setFrameDraft(null);
          if (!commit || !m) return;

          const mx0 = Math.min(m.x0, m.x1);
          const my0 = Math.min(m.y0, m.y1);
          const mw = Math.abs(m.x1 - m.x0);
          const mh = Math.abs(m.y1 - m.y0);
          if (mw < 4 && mh < 4) {
            createFrameAt(w0.x, w0.y);
          } else {
            createFrameWithBounds(mx0, my0, mw, mh);
          }
          suppressPostCreationPointer();
        };

        frameSessionCleanupRef.current = () => finish(false);

        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          const ww = toWorld(ev.clientX, ev.clientY);
          const next = frameDraftRef.current
            ? { ...frameDraftRef.current, x1: ww.x, y1: ww.y }
            : { x0: w0.x, y0: w0.y, x1: ww.x, y1: ww.y };
          frameDraftRef.current = next;
          setFrameDraft(next);
        };

        const onPointerEnd = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          finish(ev.type === "pointerup");
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onPointerEnd);
        window.addEventListener("pointercancel", onPointerEnd);
        return;
      }

      const shapeType =
        activeTool === "triangle"
          ? ("polygon" as ShapeType)
          : toolToShapeType(activeTool);
      if (shapeType) {
        creationBranch = activeTool;
        shapeSessionCleanupRef.current?.();
        const w0 = toWorld(e.clientX, e.clientY);
        const draft0 = {
          shapeType,
          x0: w0.x,
          y0: w0.y,
          x1: w0.x,
          y1: w0.y,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
        };
        shapeDraftRef.current = draft0;
        setShapeDraft(draft0);

        const target = pointerCaptureTarget();
        const capId = e.pointerId;
        try {
          target.setPointerCapture(capId);
        } catch {
          /* ignore */
        }
        let shiftHeld = e.shiftKey;
        let altHeld = e.altKey;
        let ended = false;

        const removeListeners = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onPointerEnd);
          window.removeEventListener("pointercancel", onPointerEnd);
        };

        const finish = (commit: boolean) => {
          if (ended) return;
          ended = true;
          shapeSessionCleanupRef.current = null;
          removeListeners();
          try {
            target.releasePointerCapture(capId);
          } catch {
            /* ignore */
          }
          const m = shapeDraftRef.current;
          shapeDraftRef.current = null;
          setShapeDraft(null);
          if (!commit || !m) return;

          const start = { x: m.x0, y: m.y0 };
          const end = { x: m.x1, y: m.y1 };
          const dist = Math.hypot(end.x - start.x, end.y - start.y);
          if (dist < 4) {
            const fallbackEnd =
              shapeType === "line" || shapeType === "arrow"
                ? { x: start.x + 120, y: start.y }
                : { x: start.x + 120, y: start.y + 80 };
            createShapeFromDrag(shapeType, start, fallbackEnd, {
              shiftKey: false,
              altKey: false,
            }, activeTool === "triangle" ? { polygonSides: 3 } : undefined);
          } else {
            createShapeFromDrag(shapeType, start, end, {
              shiftKey: shiftHeld,
              altKey: altHeld,
            }, activeTool === "triangle" ? { polygonSides: 3 } : undefined);
          }
          suppressPostCreationPointer();
        };

        shapeSessionCleanupRef.current = () => finish(false);

        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          shiftHeld = ev.shiftKey;
          altHeld = ev.altKey;
          const ww = toWorld(ev.clientX, ev.clientY);
          const next = shapeDraftRef.current
            ? { ...shapeDraftRef.current, x1: ww.x, y1: ww.y, shiftKey: shiftHeld, altKey: altHeld }
            : { ...draft0, x1: ww.x, y1: ww.y, shiftKey: shiftHeld, altKey: altHeld };
          shapeDraftRef.current = next;
          setShapeDraft(next);
        };

        const onPointerEnd = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          finish(ev.type === "pointerup");
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onPointerEnd);
        window.addEventListener("pointercancel", onPointerEnd);
        return;
      }

      if (activeTool === "pencil") {
        creationBranch = "pencil";
        pencilSessionCleanupRef.current?.();
        const w0 = toWorld(e.clientX, e.clientY);
        st.startPencilStroke(w0);

        const target = pointerCaptureTarget();
        const capId = e.pointerId;
        try {
          target.setPointerCapture(capId);
        } catch {
          /* ignore */
        }
        let ended = false;

        const removeListeners = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onPointerEnd);
          window.removeEventListener("pointercancel", onPointerEnd);
        };

        const finish = (commit: boolean) => {
          if (ended) return;
          ended = true;
          pencilSessionCleanupRef.current = null;
          removeListeners();
          try {
            target.releasePointerCapture(capId);
          } catch {
            /* ignore */
          }
          if (!commit) {
            st.cancelPencilStroke();
            return;
          }
          st.finishPencilStroke();
        };

        pencilSessionCleanupRef.current = () => finish(false);

        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          st.extendPencilStroke(toWorld(ev.clientX, ev.clientY));
        };

        const onPointerEnd = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          finish(ev.type === "pointerup");
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onPointerEnd);
        window.addEventListener("pointercancel", onPointerEnd);
        return;
      }

      if (activeTool === "text") {
        creationBranch = "text";
        const existingText = pickDeepestNodeAtWorldPoint(w.x, w.y, st.nodes, st.childOrder, { types: ["text"] });
        if (existingText) {
          st.pushHistory();
          st.select(existingText);
          st.setTool("move");
          st.setEditingTextId(existingText);
          return;
        }
        addTextAt(w.x, w.y);
        return;
      }
      if (activeTool === "pen") {
        creationBranch = "pen";
        if (!st.penDrawingNodeId) {
          st.startPathAt(w);
          return;
        }

        penSessionCleanupRef.current?.();
        const anchor = w;
        const placement0 = { anchor, drag: anchor };
        penPlacementRef.current = placement0;
        setPenPlacement(placement0);

        const target = pointerCaptureTarget();
        const capId = e.pointerId;
        try {
          target.setPointerCapture(capId);
        } catch {
          /* ignore */
        }
        let ended = false;

        const removeListeners = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onPointerEnd);
          window.removeEventListener("pointercancel", onPointerEnd);
        };

        const finish = (commit: boolean) => {
          if (ended) return;
          ended = true;
          penSessionCleanupRef.current = null;
          removeListeners();
          const placement = penPlacementRef.current;
          penPlacementRef.current = null;
          setPenPlacement(null);
          try {
            target.releasePointerCapture(capId);
          } catch {
            /* ignore */
          }
          if (!commit) return;
          const drag = placement?.drag ?? anchor;
          const st2 = useEditorStore.getState();
          if (!st2.penDrawingNodeId || st2.tool !== "pen") return;
          const dist = Math.hypot(drag.x - anchor.x, drag.y - anchor.y);
          if (dist >= PEN_CURVE_DRAG_THRESHOLD) {
            st2.addPathPointDrag(anchor, drag);
          } else {
            st2.addPathPoint(anchor);
          }
        };

        penSessionCleanupRef.current = () => finish(false);

        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          const ww = toWorld(ev.clientX, ev.clientY);
          const next = { anchor, drag: ww };
          penPlacementRef.current = next;
          setPenPlacement(next);
        };

        const onPointerEnd = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          finish(ev.type === "pointerup");
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onPointerEnd);
        window.addEventListener("pointercancel", onPointerEnd);
        return;
      }
      if (activeTool === "comment" && activePlacingComment) {
        creationBranch = "comment";
        addComment({ x: w.x, y: w.y });
        return;
      }
    }

    if (st.penDrawingNodeId || st.pencilDrawingNodeId) return;

    clearSelection();
    if (debugCanvas) logBgPointerDown(e, creationBranch ?? "clear-selection");
  };

  const onViewportPointerDownCapture = (e: React.PointerEvent) => {
    if (shouldSuppressCanvasPointer()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.button === 0 || e.button === 2) {
      releaseFieldFocusForCanvas();
      focusCanvasViewport(viewportRef.current);
    }
    const st = useEditorStore.getState();
    const placing = st.editorMode === "design" && st.tool === "comment" && st.isPlacingComment;

    if (
      e.button === 0 &&
      st.editorMode === "design" &&
      !st.penDrawingNodeId &&
      !st.pencilDrawingNodeId &&
      !placing &&
      !st.contextMenu &&
      !st.editingTextId &&
      !isCanvasChromeTarget(e.target)
    ) {
      const w = toWorld(e.clientX, e.clientY);
      const nodeHit = pickDeepestVisibleNodeAtWorldPoint(w.x, w.y, st.nodes, st.childOrder);
      if (!nodeHit) {
        const guideId = pickLayoutGuideAt(w.x, w.y, st.layoutGuides, st.zoom);
        if (guideId) {
          e.preventDefault();
          e.stopPropagation();
          st.selectLayoutGuide(guideId);
          return;
        }
      }
    }

    const canMarquee =
      e.button === 0 &&
      st.editorMode === "design" &&
      st.tool === "move" &&
      !spaceDown &&
      !st.placingComponentMasterId &&
      !st.penDrawingNodeId &&
      !st.pencilDrawingNodeId &&
      !st.prototypeWireDrag &&
      !placing &&
      !st.contextMenu &&
      !st.editingTextId &&
      !isCanvasChromeTarget(e.target);

    if (canMarquee) {
      const w = toWorld(e.clientX, e.clientY);
      const hitId = pickDeepestVisibleNodeAtWorldPoint(w.x, w.y, st.nodes, st.childOrder);
      const tgt = e.target as HTMLElement | null;
      const domHitId =
        tgt?.closest?.("[data-node-id]")?.getAttribute("data-node-id") ??
        tgt?.closest?.("[data-canvas-node]")?.getAttribute("data-canvas-node") ??
        null;
      if (!hitId && !domHitId) {
        const captureEl = viewportRef.current ?? (e.currentTarget as HTMLElement);
        startMarquee(e, captureEl);
        return;
      }
    }

    if (!isCanvasBgCreationTool(st.tool, st.editorMode, { isPlacingComment: placing })) return;
    const tgt = e.target as HTMLElement | null;
    if (tgt?.closest("[data-grid-toggle]")) return;
    clearPostCreationPointerSuppress();
    if (e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
    }
    onBgPointerDown(e);
  };

  function logBgPointerDown(e: React.PointerEvent, branch: string) {
    const tgt = e.target as HTMLElement | null;
    console.info("[Paytm Craft canvas] bg pointerdown", {
      branch,
      tool: useEditorStore.getState().tool,
      editorMode: useEditorStore.getState().editorMode,
      renderer: getRendererMode(),
      target: tgt?.tagName,
      dataCanvasBg: tgt?.hasAttribute("data-canvas-bg") ?? false,
      client: { x: e.clientX, y: e.clientY },
    });
  }

  const placingComment = editorMode === "design" && tool === "comment" && isPlacingComment;
  const creationCaptureActive = isCanvasBgCreationTool(tool, editorMode, { isPlacingComment });
  const crosshairTool =
    editorMode !== "inspect" &&
    (tool === "rect" ||
      tool === "ellipse" ||
      tool === "line" ||
      tool === "arrow" ||
      tool === "polygon" ||
      tool === "star" ||
      tool === "triangle" ||
      tool === "pencil" ||
      tool === "frame" ||
      placingComment ||
      tool === "pen");
  const optionMeasureMode =
    optionDown &&
    editorMode === "design" &&
    (tool === "move" || tool === "frame") &&
    selectedIds.length > 0 &&
    !optionOverSelection;

  const cursor =
    isPanning
      ? "grabbing"
      : panning
        ? "grab"
        : editorMode === "inspect"
          ? "default"
          : marquee
            ? "crosshair"
            : placingComponentMasterId
              ? "copy"
              : optionDown &&
                  editorMode === "design" &&
                  (tool === "move" || tool === "frame") &&
                  selectedIds.length > 0 &&
                  optionOverSelection
                ? "copy"
              : optionMeasureMode
                ? "default"
                : tool === "text"
                  ? "text"
                  : crosshairTool
                    ? "crosshair"
                    : "default";

  return (
    <div
      ref={viewportRef}
      data-canvas-viewport
      tabIndex={0}
      className="absolute inset-0 overflow-hidden touch-none overscroll-none outline-none"
      style={{ cursor, touchAction: "none", backgroundColor: canvasBackgroundColor }}
      onPointerDownCapture={onViewportPointerDownCapture}
      onFocus={() => activateCanvasForShortcuts()}
      onPointerMove={(e) => {
        if (tool !== "pen" || !useEditorStore.getState().penDrawingNodeId) {
          setPenHoverWorld(null);
          return;
        }
        setPenHoverWorld(toWorld(e.clientX, e.clientY));
      }}
      onPointerLeave={() => setPenHoverWorld(null)}
    >
      <CanvasInteractionContext.Provider
        value={{
          spaceDown,
          panning,
          optionDown,
          optionOverSelection,
          optionPointerHoverId,
        }}
      >
      <CanvasToWorldContext.Provider value={toWorld}>
      {showRulers ? <CanvasRulers zoom={zoom} pan={pan} viewportRef={viewportRef} /> : null}
      {showGrid ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0.55,
            backgroundImage: [
              `linear-gradient(to right, ${gridLineColor} 1px, transparent 1px)`,
              `linear-gradient(to bottom, ${gridLineColor} 1px, transparent 1px)`,
            ].join(", "),
            backgroundSize: `${8 * zoom}px ${8 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />
      ) : null}

      <div
        className="absolute left-0 top-0 h-[6000px] w-[6000px] origin-top-left"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
        }}
      >
        <div className="relative" style={{ width: 6000, height: 6000 }}>
          <PrototypeWireLayer />
          <div
            ref={canvasBgRef}
            role="presentation"
            data-canvas-bg
            className={cn(
              "pointer-events-auto absolute inset-0",
              creationCaptureActive ? "z-[14]" : "z-0",
            )}
            onPointerDown={onBgPointerDown}
            onDoubleClick={(e) => {
              if (editorMode !== "design") return;
              const st = useEditorStore.getState();
              if (st.pathEditModeNodeId) {
                e.preventDefault();
                st.setPathEditMode(null);
                return;
              }
              if (st.tool !== "pen" || !st.penDrawingNodeId) return;
              e.preventDefault();
              st.finishPath(false);
            }}
            onDragOver={(e) => {
              if ([...e.dataTransfer.types].includes("application/x-pc-component")) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                return;
              }
              if ([...e.dataTransfer.types].includes("application/x-pc-asset")) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                return;
              }
              if (e.dataTransfer.types.includes("Files")) {
                const f = e.dataTransfer.items[0]?.getAsFile?.() ?? e.dataTransfer.files?.[0];
                if (f && validateImageImportFile(f) === null) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }
              }
            }}
            onDrop={async (e) => {
              const compKey = e.dataTransfer.getData("application/x-pc-component");
              if (compKey) {
                e.preventDefault();
                const w = toWorld(e.clientX, e.clientY);
                createInstance(compKey, w.x, w.y);
                return;
              }
              const assetKey = e.dataTransfer.getData("application/x-pc-asset");
              if (assetKey) {
                e.preventDefault();
                const w = toWorld(e.clientX, e.clientY);
                addImageNodeAt(assetKey, w.x, w.y);
                return;
              }
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const err = validateImageImportFile(file);
                if (err) {
                  window.alert(err);
                  return;
                }
                e.preventDefault();
                const w = toWorld(e.clientX, e.clientY);
                const aid = await importImageAsset(file);
                if (aid) addImageNodeAt(aid, w.x, w.y);
              }
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            data-canvas-scene
          >
            <SceneRenderer
              rootIds={rootIds}
              nodes={nodes}
              childOrder={childOrder}
              assets={assets}
              designTokens={designTokens}
              selectedIds={selectedIds}
              zoom={zoom}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 z-[20]">
            <RootFrameLabels rootIds={rootIds} />
          </div>
          {editorMode === "design" && tool === "pen" && penDrawingNodeId && (penHoverWorld || penPlacement) ? (
            <PenStrokePreview
              drawId={penDrawingNodeId}
              hover={penPlacement?.drag ?? penHoverWorld!}
              placement={penPlacement}
              nodes={nodes}
              childOrder={childOrder}
            />
          ) : null}
          {editorMode === "design" ? <CommentPinLayer /> : null}
          {frameDraft ? (
            <div
              className="pointer-events-none absolute z-[19] border border-accent/60 bg-app-panel/90 shadow-sm"
              style={{
                left: Math.min(frameDraft.x0, frameDraft.x1),
                top: Math.min(frameDraft.y0, frameDraft.y1),
                width: Math.abs(frameDraft.x1 - frameDraft.x0),
                height: Math.abs(frameDraft.y1 - frameDraft.y0),
              }}
            />
          ) : null}
          {shapeDraft ? (
            <ShapeDraftPreview draft={shapeDraft} />
          ) : null}
          {marquee ? (
            <div
              className="pointer-events-none absolute z-[19] border bg-[rgba(24,160,251,0.08)] will-change-[left,top,width,height]"
              style={{
                borderColor: CANVAS_VISUAL.selection,
                left: Math.min(marquee.x0, marquee.x1),
                top: Math.min(marquee.y0, marquee.y1),
                width: Math.max(1, Math.abs(marquee.x1 - marquee.x0)),
                height: Math.max(1, Math.abs(marquee.y1 - marquee.y0)),
              }}
            />
          ) : null}
          <SelectionBox />
          <DragSnapOverlay />
          <AltMeasureLayer />
          <ComponentPlacementPreview />
          <GradientEditorLayer />
          <PresenceLayer />
          <InspectMeasurementsLayer />
        </div>
      </div>

      <LayoutGuidesOverlay zoom={zoom} pan={pan} viewportRef={viewportRef} />

      <div className="absolute bottom-3 left-3 z-50 flex items-center gap-1">
        <button
          type="button"
          data-rulers-toggle
          onClick={(e) => {
            e.stopPropagation();
            toggleRulers();
          }}
          title={showRulers ? "Hide rulers" : "Show rulers"}
          className={cn(
            "flex h-6 items-center gap-1 rounded border px-1.5 text-[11px] font-medium transition-colors",
            showRulers
              ? "border-accent/40 bg-app-panel text-app-fg shadow-sm"
              : "border-app-border bg-app-panel/95 text-app-muted hover:border-app-border hover:bg-app-hover hover:text-app-fg",
          )}
        >
          <Ruler className="h-3.5 w-3.5" strokeWidth={1.75} />
          Rulers
        </button>
        <button
          type="button"
          data-grid-toggle
          onClick={(e) => {
            e.stopPropagation();
            toggleGrid();
          }}
          title={showGrid ? "Hide layout grid" : "Show layout grid"}
          className={cn(
            "flex h-6 items-center gap-1 rounded border px-1.5 text-[11px] font-medium transition-colors",
            showGrid
              ? "border-accent/40 bg-app-panel text-app-fg shadow-sm"
              : "border-app-border bg-app-panel/95 text-app-muted hover:border-app-border hover:bg-app-hover hover:text-app-fg",
          )}
        >
          <Grid3X3 className="h-3.5 w-3.5" strokeWidth={1.75} />
          Grid
        </button>
      </div>
      </CanvasToWorldContext.Provider>
      </CanvasInteractionContext.Provider>
    </div>
  );
}
