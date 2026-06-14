"use client";

import { useCallback } from "react";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import {
  applyMatrixToPoint,
  matrixToCssTransform,
} from "@/lib/transformMath";
import {
  getNodeWorldMatrixFromChildOrder,
  getRenderedWorldBounds,
} from "@/lib/editorGraph";
import { screenPxToWorld } from "@/lib/canvasVisual";
import { useCanvasToWorld } from "@/components/editor/CanvasToWorldContext";
import { pickDeepestFrameAtWorldPoint } from "@/lib/tree";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";

function overlayWorldStyle(
  nodeId: string,
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): React.CSSProperties {
  const wm = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
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
  const wr = getRenderedWorldBounds(nodeId, nodes, childOrder);
  return { left: wr.x, top: wr.y, width: wr.width, height: wr.height };
}

function PrototypeHandleOverlay({ nodeId }: { nodeId: string }) {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
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
  const wm = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
  const wr = getRenderedWorldBounds(nodeId, nodes, childOrder);
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
      style={overlayWorldStyle(nodeId, node, nodes, childOrder)}
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

/** Minimal DOM overlays for SVG mode (prototype handle only; path edit uses screen overlay). */
export function SvgDomOverlays() {
  const editorMode = useEditorStore((s) => s.editorMode);
  const tool = useEditorStore((s) => s.tool);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);

  const protoId =
    editorMode === "prototype" && tool === "move" && selectedIds.length === 1
      ? selectedIds[0]!
      : null;

  if (!protoId) return null;

  return <>{protoId && nodes[protoId] ? <PrototypeHandleOverlay nodeId={protoId} /> : null}</>;
}
