"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  CANVAS_HANDLE_SCREEN_PX,
  CANVAS_OUTLINE_SCREEN_PX,
  CANVAS_VISUAL,
  screenPxToWorld,
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
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);
  const tool = useEditorStore((s) => s.tool);
  const editorMode = useEditorStore((s) => s.editorMode);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const pencilDrawingNodeId = useEditorStore((s) => s.pencilDrawingNodeId);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const clientToWorld = useCanvasToWorld();

  const preview = useSyncExternalStore(
    subscribeEllipseArcPreview,
    getEllipseArcPreview,
    () => null,
  );

  const [arcDragUi, setArcDragUi] = useState<"ratio" | "sweep" | "start" | null>(null);

  const id = selectedIds.length === 1 ? selectedIds[0]! : null;
  const node = id ? nodes[id] : null;

  const show =
    editorMode === "design" &&
    tool === "move" &&
    !penDrawingNodeId &&
    !pencilDrawingNodeId &&
    !isPlacingComment &&
    id &&
    node?.type === "ellipse" &&
    node.visible &&
    !node.locked;

  const handleWorld = screenPxToWorld(CANVAS_HANDLE_SCREEN_PX, zoom);
  const borderWorld = screenPxToWorld(CANVAS_OUTLINE_SCREEN_PX, zoom);
  const dotPx = screenPxToWorld(6, zoom);
  const off = handleWorld / 2;
  const dotOff = dotPx / 2;

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

  const dragLabelWorld = useMemo(() => {
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
      return { x: center.x, y: center.y, text };
    }
    const anchor =
      arcDragUi === "start"
        ? handles.find((h) => h.kind === "start")
        : handles.find((h) => h.kind === "sweep");
    if (!anchor) return null;
    const w = localToWorld(id, anchor.local, nodes, childOrder);
    return {
      x: w.x,
      y: w.y - dotOff - screenPxToWorld(20, zoom),
      text,
    };
  }, [arcDragUi, id, node, handles, arc, nodes, childOrder, zoom, dotOff]);

  const makePointerDown = useCallback(
    (kind: ArcHandleKind) => (e: React.PointerEvent) => {
      if (!id || e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const toWorld =
        clientToWorld ??
        ((cx: number, cy: number) => clientToWorldFromDocument(cx, cy, zoom));
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
    [id, clientToWorld, zoom],
  );

  if (!show || !handles) return null;

  return (
    <>
      {handles.map(({ kind, local, dot }) => {
        const world = localToWorld(id!, local, nodes, childOrder);
        const size = dot ? dotPx : handleWorld;
        const half = size / 2;
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
            className="pointer-events-auto absolute z-[31] touch-none rounded-full border-2 border-[#18a0fb] bg-white will-change-transform"
            style={{
              left: world.x - half,
              top: world.y - half,
              width: size,
              height: size,
              boxShadow: `0 0 0 ${borderWorld}px ${CANVAS_VISUAL.selection}`,
              transition: dragging ? "none" : undefined,
            }}
            onPointerDown={makePointerDown(kind)}
          />
        );
      })}
      {dragLabelWorld ? (
        <div
          className="pointer-events-none absolute z-[32] whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white"
          style={{
            left: dragLabelWorld.x,
            top: dragLabelWorld.y,
            transform:
              arcDragUi === "ratio"
                ? "translate(-50%, -50%)"
                : "translate(-50%, -100%)",
            background: CANVAS_VISUAL.selection,
          }}
        >
          {dragLabelWorld.text}
        </div>
      ) : null}
    </>
  );
}
