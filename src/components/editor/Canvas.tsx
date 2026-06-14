"use client";

import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { Grid3X3, Ruler } from "lucide-react";
import { CanvasRulers } from "./CanvasRulers";
import { SelectionBox } from "./SelectionBox";
import { TextBaselineGuide } from "./TextBaselineGuide";
import { TextEditOverlay } from "./TextEditOverlay";
import { CanvasViewportProvider } from "./CanvasViewportContext";
import { ShapeEditHandlesOverlay } from "./ShapeEditHandlesOverlay";
import { PathEditHandlesOverlay } from "./PathEditHandlesOverlay";
import { GradientHandlesOverlay } from "./gradient/GradientHandlesOverlay";
import { SceneRenderer } from "@/editor-core/renderer/SceneRenderer";
import { NativeHitLayer } from "@/editor-core/renderer/NativeHitLayer";
import { RootFrameLabels } from "./RootFrameLabels";
import { PrototypeWireLayer } from "./PrototypeWireLayer";
import { AltMeasureLayer } from "./AltMeasureLayer";
import { FigmaFidelityOverlay } from "./FigmaFidelityOverlay";
import { DragSnapOverlay } from "./DragSnapOverlay";
import { SwapDragOverlay } from "./SwapDragOverlay";
import { ShapeDrawAnchorDot } from "./ShapeDrawAnchorDot";
import { ShapeDrawPreview } from "./ShapeDrawPreview";
import { MultiSelectSwapHandlesOverlay } from "./MultiSelectSwapHandlesOverlay";
import { AutoLayoutReorderOverlay } from "./AutoLayoutReorderOverlay";
import { AutoLayoutHandlesOverlay } from "./AutoLayoutHandlesOverlay";
import { AutoLayoutHoverOverlay } from "./AutoLayoutHoverOverlay";
import { pickLayoutGuideAt } from "@/lib/layoutGuidePick";
import { LayoutGuidesOverlay } from "./LayoutGuidesOverlay";
import { InspectMeasurementsLayer } from "./InspectMeasurementsLayer";
import { PresenceLayer } from "./PresenceLayer";
import { CommentPinLayer } from "./CommentPinLayer";
import { ComponentPlacementPreview } from "./ComponentPlacementPreview";
import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";
import { CanvasToWorldContext } from "./CanvasToWorldContext";
import { CanvasInteractionContext } from "./CanvasInteractionContext";
import { clientToWorld } from "@/lib/canvasCoordinates";
import { useTheme } from "@/components/ThemeProvider";
import { CANVAS_VISUAL, displayCanvasBackground } from "@/lib/canvasVisual";
import {
  canvasViewportRotateCursorCss,
  isRotateCursorActive,
} from "@/lib/canvasRotateCursor";
import { useOptionPointerTracking } from "@/hooks/useOptionPointerTracking";
import { pickDeepestNodeAtWorldPoint, pickDeepestVisibleNodeAtWorldPoint, worldRect } from "@/lib/tree";
import { startCanvasMarqueeSession } from "@/lib/canvasMarqueeSession";
import { canAcceptCanvasFontDrop, handleCanvasFontDrop } from "@/lib/canvasFontImport";
import { canAcceptCanvasImageDrop } from "@/lib/canvasImageImport";
import { handleCanvasImageDrop, pasteCanvasImageFromClipboard } from "@/lib/canvasImagePlace";
import { setLastCanvasWorldPoint } from "@/lib/canvasPointerMemory";
import { EMPTY_CHILD_IDS } from "@/lib/editorConstants";
import { registerMarqueeAbortHandler } from "@/lib/canvasMarqueeController";
import { isPaytmCraftDebugCanvas } from "@/lib/env";
import { getRendererMode, isNativeRendererEnabled } from "@/lib/rendererMode";
import { NativeSceneCompositor } from "@/editor-core/renderer/NativeSceneCompositor";
import { SvgHoverOutline } from "@/editor-core/renderer/SvgHoverOutline";
import {
  isCanvasBgCreationTool,
  isCanvasChromeTarget,
} from "@/lib/canvasInteractionGuards";
import { toolToShapeType, type ShapeType } from "@/lib/shapes";
import { getRenderedWorldTopLeft, layerPanelChildIds } from "@/lib/editorGraph";
import { pathToSvgD } from "@/lib/pathGeometry";

const PEN_CURVE_DRAG_THRESHOLD = 4;
import { wheelZoomFactor, zoomAtScreenPoint } from "@/lib/canvasZoom";
import { snapPanToDevicePixels } from "@/lib/crispRender";
import {
  createRafPointerScheduler,
  forEachCoalescedPointerEvent,
} from "@/lib/smoothPointer";
import {
  applyPanPreview,
  clearPanPreview,
  readPanPreviewDelta,
  registerCanvasGrid,
  registerCanvasSceneTransform,
} from "@/lib/canvasEphemeralTransform";
import {
  activateCanvasForShortcuts,
  focusCanvasViewport,
  isEditableFieldElement,
  releaseFieldFocusForCanvas,
} from "@/lib/editorKeyboardFocus";
import { hasEditorClipboardContent } from "@/lib/editorClipboardAvailability";
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

function PencilStrokePreview({
  drawId,
  nodes,
  childOrder,
}: {
  drawId: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
}) {
  const n = nodes[drawId];
  const pts = n?.pathPoints ?? [];
  if (!n || pts.length === 0) return null;
  const origin = getRenderedWorldTopLeft(drawId, nodes, childOrder);
  const worldPts = pts.map((p) => ({
    ...p,
    x: origin.x + p.x,
    y: origin.y + p.y,
  }));
  const d = pathToSvgD(worldPts, false);
  const sw = n.strokeWidth ?? 2;
  const stroke = n.strokeColor ?? CANVAS_VISUAL.selection;
  const first = worldPts[0];
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[46] h-full w-full overflow-visible"
      aria-hidden
    >
      {d && pts.length >= 2 ? (
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap={n.strokeLinecap ?? "round"}
          strokeLinejoin={n.strokeLinejoin ?? "round"}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {pts.length === 1 && first ? (
        <circle
          cx={first.x}
          cy={first.y}
          r={Math.max(1, sw / 2)}
          fill={stroke}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}

export function Canvas() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasBgRef = useRef<HTMLDivElement>(null);
  const sceneTransformRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const zoom = useEditorStore((s) => s.zoom);
  const editingTextId = useEditorStore((s) => s.editingTextId);
  const transformInteractionMode = useEditorStore((s) => s.transformInteractionMode);
  const rotateHandleHovered = useEditorStore((s) => s.rotateHandleHovered);
  const rotateHandleHoverHandle = useEditorStore((s) => s.rotateHandleHoverHandle);
  const pan = useEditorStore((s) => s.pan);
  const snappedPan = useMemo(() => snapPanToDevicePixels(pan), [pan.x, pan.y]);
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
  const startShapeFromDrag = useEditorStore((s) => s.startShapeFromDrag);
  const updateShapeFromDrag = useEditorStore((s) => s.updateShapeFromDrag);
  const finishShapeFromDrag = useEditorStore((s) => s.finishShapeFromDrag);
  const cancelShapeFromDrag = useEditorStore((s) => s.cancelShapeFromDrag);
  const startFrameFromDrag = useEditorStore((s) => s.startFrameFromDrag);
  const updateFrameFromDrag = useEditorStore((s) => s.updateFrameFromDrag);
  const finishFrameFromDrag = useEditorStore((s) => s.finishFrameFromDrag);
  const cancelFrameFromDrag = useEditorStore((s) => s.cancelFrameFromDrag);
  const startTextFromDrag = useEditorStore((s) => s.startTextFromDrag);
  const updateTextFromDrag = useEditorStore((s) => s.updateTextFromDrag);
  const finishTextFromDrag = useEditorStore((s) => s.finishTextFromDrag);
  const cancelTextFromDrag = useEditorStore((s) => s.cancelTextFromDrag);
  const createInstance = useEditorStore((s) => s.createInstance);
  const addImageNodeAt = useEditorStore((s) => s.addImageNodeAt);
  const placingComponentMasterId = useEditorStore((s) => s.placingComponentMasterId);
  const setPlacingComponentMasterId = useEditorStore((s) => s.setPlacingComponentMasterId);
  const figImportBusy = useEditorStore((s) => s.figImportInProgress);
  const childOrder = useEditorStore((s) => s.childOrder);
  const assets = useEditorStore((s) => s.assets);
  const designTokens = useEditorStore((s) => s.designTokens);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editorMode = useEditorStore((s) => s.editorMode);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const addComment = useEditorStore((s) => s.addComment);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const pencilDrawingNodeId = useEditorStore((s) => s.pencilDrawingNodeId);
  const nodes = useEditorStore((s) => s.nodes);

  const rootIds = useMemo(
    () => layerPanelChildIds(ROOT, nodes, childOrder),
    [nodes, childOrder],
  );

  const [penHoverWorld, setPenHoverWorld] = useState<{ x: number; y: number } | null>(null);
  const [penPlacement, setPenPlacement] = useState<{
    anchor: { x: number; y: number };
    drag: { x: number; y: number };
  } | null>(null);
  const penPlacementRef = useRef<{ anchor: { x: number; y: number }; drag: { x: number; y: number } } | null>(
    null,
  );
  const [spaceDown, setSpaceDown] = useState(false);
  const [commandDown, setCommandDown] = useState(false);
  const [optionDown, setOptionDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [marquee, setMarquee] = useState<null | { x0: number; y0: number; x1: number; y1: number }>(null);
  const textSessionCleanupRef = useRef<(() => void) | null>(null);
  const shapeSessionCleanupRef = useRef<(() => void) | null>(null);
  const pencilSessionCleanupRef = useRef<(() => void) | null>(null);
  const penSessionCleanupRef = useRef<(() => void) | null>(null);
  const frameSessionCleanupRef = useRef<(() => void) | null>(null);
  const panDrag = useRef<{ pointerId: number; sx: number; sy: number; px: number; py: number } | null>(
    null,
  );

  useEffect(() => {
    registerMarqueeAbortHandler(() => {
      let cancelled = false;
      if (frameSessionCleanupRef.current) {
        frameSessionCleanupRef.current();
        cancelled = true;
      }
      if (shapeSessionCleanupRef.current) {
        shapeSessionCleanupRef.current();
        cancelled = true;
      }
      if (textSessionCleanupRef.current) {
        textSessionCleanupRef.current();
        cancelled = true;
      }
      if (pencilSessionCleanupRef.current) {
        pencilSessionCleanupRef.current();
        cancelled = true;
      }
      if (penSessionCleanupRef.current) {
        penSessionCleanupRef.current();
        cancelled = true;
      }
      return cancelled;
    });
    return () => {
      registerMarqueeAbortHandler(null);
      frameSessionCleanupRef.current?.();
      shapeSessionCleanupRef.current?.();
      pencilSessionCleanupRef.current?.();
      penSessionCleanupRef.current?.();
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
    if (tool !== "pencil") {
      pencilSessionCleanupRef.current?.();
      return;
    }
    frameSessionCleanupRef.current?.();
    shapeSessionCleanupRef.current?.();
    textSessionCleanupRef.current?.();
  }, [tool]);

  useEffect(() => {
    const syncModifiers = (e: KeyboardEvent) => {
      setOptionDown(e.altKey);
      setCommandDown(e.metaKey || e.ctrlKey);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(true);
      syncModifiers(e);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
      syncModifiers(e);
    };
    const onBlur = () => {
      setOptionDown(false);
      setCommandDown(false);
      setSpaceDown(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        setOptionDown(false);
        setCommandDown(false);
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

  const onCanvasDragOverCapture = useCallback(
    (e: React.DragEvent) => {
      if (editorMode !== "design" || figImportBusy) return;
      if (!canAcceptCanvasImageDrop(e.dataTransfer) && !canAcceptCanvasFontDrop(e.dataTransfer)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
    },
    [editorMode, figImportBusy],
  );

  const onCanvasDropCapture = useCallback(
    async (e: React.DragEvent) => {
      if (editorMode !== "design" || figImportBusy) return;
      const dt = e.dataTransfer;
      const compKey = dt.getData("application/x-pc-component");
      if (compKey) {
        e.preventDefault();
        e.stopPropagation();
        const w = toWorld(e.clientX, e.clientY);
        createInstance(compKey, w.x, w.y);
        return;
      }
      const assetKey = dt.getData("application/x-pc-asset");
      if (assetKey) {
        e.preventDefault();
        e.stopPropagation();
        const w = toWorld(e.clientX, e.clientY);
        addImageNodeAt(assetKey, w.x, w.y);
        return;
      }
      const acceptsImage = canAcceptCanvasImageDrop(dt);
      const acceptsFont = canAcceptCanvasFontDrop(dt);
      if (!acceptsImage && !acceptsFont) return;
      e.preventDefault();
      e.stopPropagation();
      if (acceptsImage) {
        await handleCanvasImageDrop(
          dt,
          e.clientX,
          e.clientY,
          toWorld,
          viewportRef.current,
          pan,
          zoom,
        );
      }
      if (acceptsFont) {
        await handleCanvasFontDrop(dt);
      }
    },
    [editorMode, figImportBusy, toWorld, createInstance, addImageNodeAt, pan, zoom],
  );

  const onCanvasPaste = useCallback(
    async (e: React.ClipboardEvent) => {
      if (editorMode !== "design" || figImportBusy) return;
      if (isEditableFieldElement(e.target) || isEditableFieldElement(document.activeElement)) {
        return;
      }
      const imagePasted = await pasteCanvasImageFromClipboard(
        e.clipboardData,
        toWorld,
        viewportRef.current,
        pan,
        zoom,
      );
      if (imagePasted) {
        e.preventDefault();
        activateCanvasForShortcuts();
        return;
      }
      if (hasEditorClipboardContent()) {
        e.preventDefault();
        useEditorStore.getState().pasteSelection();
      }
    },
    [editorMode, figImportBusy, toWorld, pan, zoom],
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

  const wheelPanAccumRef = useRef({ dx: 0, dy: 0, raf: 0 });
  const wheelZoomAccumRef = useRef({ factor: 1, mx: 0, my: 0, raf: 0 });

  const handleViewportWheel = useCallback((e: WheelEvent) => {
    const el = viewportRef.current;
    if (!el) return;

    // Must run from a non-passive listener — React's onWheel is passive, so preventDefault()
    // is ignored and pinch/ctrl+wheel zooms the whole browser page instead of the canvas.
    e.preventDefault();
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const step = wheelZoomFactor(e.deltaY, e.deltaMode, { pageHeight: el.clientHeight });
      const accum = wheelZoomAccumRef.current;
      accum.factor *= step;
      accum.mx = mx;
      accum.my = my;
      if (accum.raf) return;
      accum.raf = requestAnimationFrame(() => {
        accum.raf = 0;
        const { factor, mx: fx, my: fy } = accum;
        accum.factor = 1;
        if (factor === 1) return;
        const s = useEditorStore.getState();
        const next = zoomAtScreenPoint({
          zoom: s.zoom,
          pan: s.pan,
          focusX: fx,
          focusY: fy,
          factor,
        });
        useEditorStore.setState(next);
      });
      return;
    }

    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
    const accum = wheelPanAccumRef.current;
    accum.dx += -e.deltaX * scale;
    accum.dy += -e.deltaY * scale;
    if (accum.raf) return;
    accum.raf = requestAnimationFrame(() => {
      accum.raf = 0;
      const { dx, dy } = accum;
      accum.dx = 0;
      accum.dy = 0;
      if (dx === 0 && dy === 0) return;
      useEditorStore.getState().patchPan({ x: dx, y: dy });
    });
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

  useEffect(() => {
    registerCanvasSceneTransform(sceneTransformRef.current);
    registerCanvasGrid(gridRef.current);
    return () => {
      registerCanvasSceneTransform(null);
      registerCanvasGrid(null);
      clearPanPreview();
    };
  }, [showGrid]);

  const panning = tool === "hand" || spaceDown;

  const pointerCaptureTarget = useCallback((): HTMLElement => {
    return canvasBgRef.current ?? viewportRef.current!;
  }, []);

  const onBgPointerDown = (e: React.PointerEvent) => {
    const liveTool = useEditorStore.getState().tool;
    if (shouldSuppressCanvasPointer() && liveTool !== "pencil") {
      const st = useEditorStore.getState();
      const w = toWorld(e.clientX, e.clientY);
      const hitId = pickDeepestVisibleNodeAtWorldPoint(w.x, w.y, st.nodes, st.childOrder, st.zoom);
      if (!hitId) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
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
        const panMoveScheduler = createRafPointerScheduler<{ clientX: number; clientY: number }>(
          ({ clientX, clientY }) => {
            const d = panDrag.current;
            if (!d) return;
            const z = useEditorStore.getState().zoom;
            applyPanPreview({ x: d.px, y: d.py }, z, clientX - d.sx, clientY - d.sy);
          },
        );
        const onMove = (ev: PointerEvent) => {
          const d = panDrag.current;
          if (!d || ev.pointerId !== d.pointerId) return;
          forEachCoalescedPointerEvent(ev, (pe) => {
            panMoveScheduler.schedule({ clientX: pe.clientX, clientY: pe.clientY });
          });
        };
        const finishPan = (ev: PointerEvent) => {
          const d = panDrag.current;
          if (!d || ev.pointerId !== d.pointerId) return;
          forEachCoalescedPointerEvent(ev, (pe) => {
            panMoveScheduler.schedule({ clientX: pe.clientX, clientY: pe.clientY });
          });
          panMoveScheduler.flush();
          panMoveScheduler.cancel();
          if (d) {
            const { dx, dy } = readPanPreviewDelta();
            setPan({ x: d.px + dx, y: d.py + dy });
          }
          clearPanPreview();
          panDrag.current = null;
          setIsPanning(false);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", finishPan);
          window.removeEventListener("pointercancel", finishPan);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", finishPan);
        window.addEventListener("pointercancel", finishPan);
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
        startFrameFromDrag(w0);

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

        frameSessionCleanupRef.current = () => {
          if (ended) return;
          ended = true;
          frameSessionCleanupRef.current = null;
          removeListeners();
          cancelFrameFromDrag();
        };

        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          shiftHeld = ev.shiftKey;
          altHeld = ev.altKey;
          const ww = toWorld(ev.clientX, ev.clientY);
          updateFrameFromDrag(ww, { shiftKey: shiftHeld, altKey: altHeld });
        };

        const onPointerEnd = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          if (ended) return;
          ended = true;
          frameSessionCleanupRef.current = null;
          removeListeners();
          try {
            target.releasePointerCapture(capId);
          } catch {
            /* ignore */
          }
          if (ev.type !== "pointerup") {
            cancelFrameFromDrag();
            return;
          }
          const ww = toWorld(ev.clientX, ev.clientY);
          finishFrameFromDrag(ww, { shiftKey: shiftHeld, altKey: altHeld });
          suppressPostCreationPointer();
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
        const shapeStyle = activeTool === "triangle" ? { polygonSides: 3 as const } : undefined;
        startShapeFromDrag(
          shapeType,
          w0,
          { shiftKey: e.shiftKey, altKey: e.altKey },
          shapeStyle,
        );

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

        shapeSessionCleanupRef.current = () => {
          if (ended) return;
          ended = true;
          shapeSessionCleanupRef.current = null;
          removeListeners();
          cancelShapeFromDrag();
        };

        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          shiftHeld = ev.shiftKey;
          altHeld = ev.altKey;
          const ww = toWorld(ev.clientX, ev.clientY);
          updateShapeFromDrag(ww, { shiftKey: shiftHeld, altKey: altHeld });
        };

        const onPointerEnd = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          if (ended) return;
          ended = true;
          shapeSessionCleanupRef.current = null;
          removeListeners();
          try {
            target.releasePointerCapture(capId);
          } catch {
            /* ignore */
          }
          if (ev.type !== "pointerup") {
            cancelShapeFromDrag();
            return;
          }
          const ww = toWorld(ev.clientX, ev.clientY);
          finishShapeFromDrag(ww, { shiftKey: shiftHeld, altKey: altHeld });
          suppressPostCreationPointer();
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
        useEditorStore.getState().startPencilStroke(w0);
        if (!useEditorStore.getState().pencilDrawingNodeId) return;
        useEditorStore.getState().extendPencilStrokeCoalesced([w0]);

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
          const live = useEditorStore.getState();
          if (!commit) {
            live.cancelPencilStroke();
            return;
          }
          live.finishPencilStroke();
          suppressPostCreationPointer();
        };

        pencilSessionCleanupRef.current = () => finish(false);

        const pencilBatch: { x: number; y: number }[] = [];
        const pencilScheduler = createRafPointerScheduler<null>(() => {
          if (pencilBatch.length === 0) return;
          const pts = pencilBatch.splice(0, pencilBatch.length);
          useEditorStore.getState().extendPencilStrokeCoalesced(pts);
        });
        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          forEachCoalescedPointerEvent(ev, (pe) => {
            pencilBatch.push(toWorld(pe.clientX, pe.clientY));
            pencilScheduler.schedule(null);
          });
        };

        const onPointerEnd = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          forEachCoalescedPointerEvent(ev, (pe) => {
            pencilBatch.push(toWorld(pe.clientX, pe.clientY));
            pencilScheduler.schedule(null);
          });
          pencilScheduler.flush();
          pencilScheduler.cancel();
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

        textSessionCleanupRef.current?.();
        startTextFromDrag(w);

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

        textSessionCleanupRef.current = () => {
          if (ended) return;
          ended = true;
          textSessionCleanupRef.current = null;
          removeListeners();
          cancelTextFromDrag();
        };

        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          shiftHeld = ev.shiftKey;
          altHeld = ev.altKey;
          const ww = toWorld(ev.clientX, ev.clientY);
          updateTextFromDrag(ww, { shiftKey: shiftHeld, altKey: altHeld });
        };

        const onPointerEnd = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          if (ended) return;
          ended = true;
          textSessionCleanupRef.current = null;
          removeListeners();
          try {
            target.releasePointerCapture(capId);
          } catch {
            /* ignore */
          }
          if (ev.type !== "pointerup") {
            cancelTextFromDrag();
            return;
          }
          const ww = toWorld(ev.clientX, ev.clientY);
          finishTextFromDrag(ww, { shiftKey: shiftHeld, altKey: altHeld });
          suppressPostCreationPointer();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onPointerEnd);
        window.addEventListener("pointercancel", onPointerEnd);
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

        const penPreviewScheduler = createRafPointerScheduler<null>(() => {
          const placement = penPlacementRef.current;
          if (placement) setPenPlacement(placement);
        });
        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          forEachCoalescedPointerEvent(ev, (pe) => {
            const ww = toWorld(pe.clientX, pe.clientY);
            penPlacementRef.current = { anchor, drag: ww };
            penPreviewScheduler.schedule(null);
          });
        };

        const onPointerEnd = (ev: PointerEvent) => {
          if (ev.pointerId !== capId) return;
          forEachCoalescedPointerEvent(ev, (pe) => {
            const ww = toWorld(pe.clientX, pe.clientY);
            penPlacementRef.current = { anchor, drag: ww };
            penPreviewScheduler.schedule(null);
          });
          penPreviewScheduler.flush();
          penPreviewScheduler.cancel();
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

    if (st.pathEditModeNodeId && activeTool === "move") {
      st.setSelectedPathPointIds([]);
      return;
    }

    clearSelection();
    if (debugCanvas) logBgPointerDown(e, creationBranch ?? "clear-selection");
  };

  const onViewportPointerDownCapture = (e: React.PointerEvent) => {
    const liveTool = useEditorStore.getState().tool;
    if (shouldSuppressCanvasPointer() && liveTool !== "pencil") {
      const st = useEditorStore.getState();
      const w = toWorld(e.clientX, e.clientY);
      const hitId = pickDeepestVisibleNodeAtWorldPoint(w.x, w.y, st.nodes, st.childOrder, st.zoom);
      if (!hitId) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
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
      const nodeHit = pickDeepestVisibleNodeAtWorldPoint(w.x, w.y, st.nodes, st.childOrder, st.zoom);
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
      const hitId = pickDeepestVisibleNodeAtWorldPoint(w.x, w.y, st.nodes, st.childOrder, st.zoom);
      const tgt = e.target as HTMLElement | null;
      const domHitId =
        tgt?.closest?.("[data-node-id]")?.getAttribute("data-node-id") ??
        tgt?.closest?.("[data-canvas-node]")?.getAttribute("data-canvas-node") ??
        tgt?.closest?.("[data-frame-label]")?.getAttribute("data-frame-label") ??
        tgt?.closest?.("[data-autolayout-spacing-handle]")?.getAttribute("data-autolayout-spacing-handle") ??
        tgt?.closest?.("[data-autolayout-padding-handle]")?.getAttribute("data-autolayout-padding-handle") ??
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

  const rotateCursorActive = isRotateCursorActive({
    transformInteractionMode,
    rotateHandleHovered,
  });

  const selectionRotationDeg =
    selectedIds.length === 1 && selectedIds[0]
      ? (nodes[selectedIds[0]]?.rotation ?? 0)
      : 0;

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    if (rotateCursorActive) vp.setAttribute("data-rotate-active", "true");
    else vp.removeAttribute("data-rotate-active");
  }, [rotateCursorActive]);

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
                    : rotateCursorActive
                      ? canvasViewportRotateCursorCss(
                          rotateHandleHoverHandle,
                          selectionRotationDeg,
                        )
                      : "default";

  return (
    <div
      ref={viewportRef}
      data-canvas-viewport
      data-renderer-mode={getRendererMode()}
      tabIndex={0}
      className="absolute inset-0 overflow-hidden touch-none overscroll-none outline-none"
      style={{ cursor, touchAction: "none", backgroundColor: canvasBackgroundColor }}
      onPointerDownCapture={onViewportPointerDownCapture}
      onDragOverCapture={onCanvasDragOverCapture}
      onDropCapture={onCanvasDropCapture}
      onPaste={onCanvasPaste}
      onFocus={() => activateCanvasForShortcuts()}
      onPointerMove={(e) => {
        setLastCanvasWorldPoint(toWorld(e.clientX, e.clientY));
        if (tool !== "pen" || !useEditorStore.getState().penDrawingNodeId) {
          setPenHoverWorld(null);
          return;
        }
        setPenHoverWorld(toWorld(e.clientX, e.clientY));
      }}
      onPointerLeave={() => {
        setLastCanvasWorldPoint(null);
        setPenHoverWorld(null);
      }}
    >
      <CanvasInteractionContext.Provider
        value={{
          spaceDown,
          panning,
          commandDown,
          optionDown,
          optionOverSelection,
          optionPointerHoverId,
        }}
      >
      <CanvasToWorldContext.Provider value={toWorld}>
      <CanvasViewportProvider viewportRef={viewportRef}>
      {isNativeRendererEnabled() && !figImportBusy ? (
        <NativeSceneCompositor viewportRef={viewportRef} />
      ) : null}
      {showRulers ? <CanvasRulers zoom={zoom} pan={pan} viewportRef={viewportRef} /> : null}
      {showGrid ? (
        <div
          ref={gridRef}
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
        ref={sceneTransformRef}
        data-canvas-scene-transform
        className="absolute left-0 top-0 z-[2] h-[6000px] w-[6000px] origin-top-left"
        style={{
          transform: `translate3d(${snappedPan.x}px, ${snappedPan.y}px, 0) scale(${zoom})`,
        }}
      >
        <div className="relative" style={{ width: 6000, height: 6000 }}>
          <PrototypeWireLayer />
          <div
            ref={canvasBgRef}
            role="presentation"
            data-canvas-bg
            className="pointer-events-auto absolute inset-0 z-0"
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
          />
          <div
            className="absolute inset-0 z-[1]"
            data-canvas-scene
          >
            {figImportBusy ? null : (
              <SceneRenderer
                rootIds={rootIds}
                nodes={nodes}
                childOrder={childOrder}
                assets={assets}
                designTokens={designTokens}
                selectedIds={selectedIds}
                zoom={zoom}
                editingTextId={editingTextId}
              />
            )}
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
          {editorMode === "design" && tool === "pencil" && pencilDrawingNodeId ? (
            <PencilStrokePreview
              drawId={pencilDrawingNodeId}
              nodes={nodes}
              childOrder={childOrder}
            />
          ) : null}
          {editorMode === "design" ? <CommentPinLayer /> : null}
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
          <AutoLayoutHandlesOverlay />
          <ComponentPlacementPreview />
          <PresenceLayer />
        </div>
      </div>

      {!figImportBusy ? (
        <NativeHitLayer nodes={nodes} childOrder={childOrder} zoom={zoom} />
      ) : null}

      <div
        className="pointer-events-none absolute inset-0 z-[10] overflow-hidden"
        data-canvas-screen-overlays
      >
        {figImportBusy ? null : <RootFrameLabels rootIds={rootIds} />}
        <SvgHoverOutline />
        <ShapeDrawAnchorDot />
        <ShapeDrawPreview />
        <TextBaselineGuide />
        <SelectionBox />
        <TextEditOverlay />
        <MultiSelectSwapHandlesOverlay />
        <SwapDragOverlay />
        <DragSnapOverlay />
        <AutoLayoutReorderOverlay />
        <AutoLayoutHoverOverlay />
        <AltMeasureLayer />
        <FigmaFidelityOverlay />
        <InspectMeasurementsLayer />
        <ShapeEditHandlesOverlay />
        <PathEditHandlesOverlay />
        <GradientHandlesOverlay />
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
            "flex h-6 items-center gap-1 rounded border px-1.5 text-ui font-medium transition-colors",
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
            "flex h-6 items-center gap-1 rounded border px-1.5 text-ui font-medium transition-colors",
            showGrid
              ? "border-accent/40 bg-app-panel text-app-fg shadow-sm"
              : "border-app-border bg-app-panel/95 text-app-muted hover:border-app-border hover:bg-app-hover hover:text-app-fg",
          )}
        >
          <Grid3X3 className="h-3.5 w-3.5" strokeWidth={1.75} />
          Grid
        </button>
      </div>
      </CanvasViewportProvider>
      </CanvasToWorldContext.Provider>
      </CanvasInteractionContext.Provider>
    </div>
  );
}
