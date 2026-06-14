"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { mergeInstanceOverrides } from "@/lib/componentModel";
import {
  CANVAS_ELLIPSE_ARC_DOT_SCREEN_PX,
  CANVAS_ELLIPSE_ARC_HANDLE_SCREEN_PX,
  CANVAS_VISUAL,
  canvasCornerRadiusHandleStyle,
} from "@/lib/canvasVisual";
import {
  effectiveEllipseArc,
  ellipseRatioHandleLocal,
  ellipseStartHandleLocal,
  ellipseSweepHandleLocal,
  formatArcRatioPercent,
  formatArcSweepDegrees,
  isFullEllipseArc,
} from "@/lib/shapes/ellipseArc";
import {
  beginEllipseRatioDrag,
  beginEllipseStartDrag,
  beginEllipseSweepDrag,
  getEllipseArcPreview,
  getEllipseArcRatioHandleAnchor,
  subscribeEllipseArcPreview,
} from "@/lib/shapes/ellipseArcDrag";
import {
  getNodeWorldMatrixFromChildOrder,
  getRenderedWorldBounds,
} from "@/lib/editorGraph";
import { applyMatrixToPoint } from "@/lib/transformMath";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import { screenPxToOverlay, worldPointToOverlay } from "@/lib/canvasOverlaySpace";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";
import { shouldShowEllipseArcHandlesOnCanvas } from "@/lib/editMode/shapeEditGate";
import {
  getDragPreviewSnapshot,
  subscribeDragPreview,
} from "@/lib/canvasEphemeralTransform";

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

type ArcHandleKind = "sweep" | "start" | "ratio";

/** Figma-style arc handles: sweep, start, and inner ratio on ellipses. */
export function EllipseArcHandles() {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editorMode = useEditorStore((s) => s.editorMode);
  const tool = useEditorStore((s) => s.tool);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const pencilDrawingNodeId = useEditorStore((s) => s.pencilDrawingNodeId);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const transformInteractionMode = useEditorStore((s) => s.transformInteractionMode);
  const pan = useEditorStore((s) => s.pan);
  const zoom = useEditorStore((s) => s.zoom);
  const clientToWorld = useCanvasToWorld();
  const overlay = useCanvasOverlaySpace();
  const dragPreview = useSyncExternalStore(subscribeDragPreview, getDragPreviewSnapshot, () => null);
  const dragActive = Boolean(dragPreview?.movingIds.length);

  const id = selectedIds.length === 1 ? selectedIds[0]! : null;

  const preview = useSyncExternalStore(
    subscribeEllipseArcPreview,
    getEllipseArcPreview,
    () => null,
  );

  const [arcDragUi, setArcDragUi] = useState<"ratio" | "sweep" | "start" | null>(null);

  const rawNode = id ? nodes[id] : null;
  const node = useMemo(
    () => (rawNode ? mergeInstanceOverrides(rawNode, nodes) : null),
    [rawNode, nodes],
  );

  const show = shouldShowEllipseArcHandlesOnCanvas(
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

  const handlePx = screenPxToOverlay(CANVAS_ELLIPSE_ARC_HANDLE_SCREEN_PX, overlay);
  const dotPx = screenPxToOverlay(CANVAS_ELLIPSE_ARC_DOT_SCREEN_PX, overlay);
  const handleStyle = canvasCornerRadiusHandleStyle(handlePx);
  const dotStyle = canvasCornerRadiusHandleStyle(dotPx);
  const handleHalf = handlePx / 2;
  const dotHalf = dotPx / 2;
  const labelOffset = screenPxToOverlay(20, overlay);

  const arc = useMemo(() => {
    if (!node) return null;
    if (preview && preview.nodeId === id) {
      return {
        startDeg: preview.startDeg,
        sweepDeg: preview.sweepDeg,
        innerRadiusRatio: preview.innerRadiusRatio,
      };
    }
    return effectiveEllipseArc(node);
  }, [node, preview, id]);

  const dragging = preview?.nodeId === id;
  const ratioHandleAnchor = getEllipseArcRatioHandleAnchor();

  const handles = useMemo(() => {
    if (!show || !id || !node || !arc) return null;
    const partial = !isFullEllipseArc(arc.sweepDeg);
    const list: { kind: ArcHandleKind; local: { x: number; y: number }; dot?: boolean }[] = [];
    if (partial) {
      list.push({
        kind: "start",
        local: ellipseStartHandleLocal(node.width, node.height, arc.startDeg),
        dot: true,
      });
      list.push({
        kind: "sweep",
        local: ellipseSweepHandleLocal(
          node.width,
          node.height,
          arc.startDeg,
          arc.sweepDeg,
        ),
        dot: true,
      });
    } else {
      list.push({
        kind: "sweep",
        local: ellipseSweepHandleLocal(
          node.width,
          node.height,
          arc.startDeg,
          arc.sweepDeg,
        ),
      });
    }
    const ratioLocal =
      dragging && arcDragUi === "ratio" && ratioHandleAnchor
        ? ratioHandleAnchor
        : ellipseRatioHandleLocal(
            node.width,
            node.height,
            arc.startDeg,
            arc.sweepDeg,
            arc.innerRadiusRatio,
          );
    list.push({ kind: "ratio", local: ratioLocal });
    return list;
  }, [show, id, node, arc, dragging, arcDragUi, ratioHandleAnchor]);

  const dragLabelScreen = useMemo(() => {
    if (!arcDragUi || !id || !node || !handles || !arc) return null;
    const text =
      arcDragUi === "ratio"
        ? `Ratio ${formatArcRatioPercent(arc.innerRadiusRatio)}`
        : `Sweep ${formatArcSweepDegrees(arc.sweepDeg)}`;
    if (arcDragUi === "ratio") {
      const center = localToWorld(
        id,
        { x: node.width / 2, y: node.height / 2 },
        nodes,
        childOrder,
      );
      const screen = worldPointToOverlay(center.x, center.y, overlay);
      return { x: screen.x, y: screen.y, text, center: true };
    }
    const anchor =
      arcDragUi === "start"
        ? handles.find((h) => h.kind === "start")
        : handles.find((h) => h.kind === "sweep");
    if (!anchor) return null;
    const world = localToWorld(id, anchor.local, nodes, childOrder);
    const screen = worldPointToOverlay(world.x, world.y, overlay);
    return {
      x: screen.x,
      y: screen.y - dotHalf - labelOffset,
      text,
      center: false,
    };
  }, [arcDragUi, id, node, handles, arc, nodes, childOrder, overlay, dotHalf, labelOffset]);

  const makePointerDown = useCallback(
    (kind: ArcHandleKind) => (e: React.PointerEvent) => {
      if (!id || e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const toWorld =
        clientToWorld ??
        ((cx: number, cy: number) => clientToWorldFromDocument(cx, cy, { pan, zoom }));
      const begin =
        kind === "ratio"
          ? beginEllipseRatioDrag
          : kind === "start"
            ? beginEllipseStartDrag
            : beginEllipseSweepDrag;
      setArcDragUi(kind);
      begin({
        nodeId: id,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld: toWorld,
        captureTarget: e.currentTarget,
      });
      const onEnd = () => {
        setArcDragUi(null);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
      };
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    },
    [id, clientToWorld, pan, zoom],
  );

  if (!show || !handles) return null;

  return (
    <>
      {handles.map(({ kind, local, dot }) => {
        const world = localToWorld(id!, local, nodes, childOrder);
        const screen = worldPointToOverlay(world.x, world.y, overlay);
        const half = dot ? dotHalf : handleHalf;
        const style = dot ? dotStyle : handleStyle;
        return (
          <button
            key={kind}
            type="button"
            data-ellipse-arc-handle={kind}
            aria-label={
              kind === "ratio"
                ? "Adjust inner radius ratio"
                : kind === "start"
                  ? "Adjust arc start"
                  : "Adjust arc sweep"
            }
            title={
              kind === "ratio"
                ? "Drag to adjust inner radius (Shift: 5% steps)"
                : kind === "start"
                  ? "Drag to adjust arc start"
                  : "Drag to adjust sweep (Shift: 15° steps)"
            }
            className="pointer-events-auto absolute z-[31] touch-none will-change-transform"
            style={{
              ...style,
              left: screen.x - half,
              top: screen.y - half,
              transition: dragging ? "none" : undefined,
            }}
            onPointerDown={makePointerDown(kind)}
          />
        );
      })}
      {dragLabelScreen ? (
        <div
          className="pointer-events-none absolute z-[32] whitespace-nowrap rounded px-1.5 py-0.5 text-ui font-semibold tabular-nums text-white"
          style={{
            left: dragLabelScreen.x,
            top: dragLabelScreen.y,
            transform: dragLabelScreen.center
              ? "translate(-50%, -50%)"
              : "translate(-50%, -100%)",
            background: CANVAS_VISUAL.selection,
          }}
        >
          {dragLabelScreen.text}
        </div>
      ) : null}
    </>
  );
}
