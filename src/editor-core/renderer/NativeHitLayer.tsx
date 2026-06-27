"use client";

import { useCallback } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasInteraction } from "@/components/editor/CanvasInteractionContext";
import { useCanvasToWorld } from "@/components/editor/CanvasToWorldContext";
import { clearPostCreationPointerSuppress } from "@/lib/canvasCreationGuard";
import { pickDeepestNodeAtWorldPoint } from "@/lib/tree";
import type { SceneRendererProps } from "./RendererTypes";
import { useCanvasHitHandlers } from "./useCanvasHitHandlers";

/**
 * Native renderer hit overlay — WASM pick + shared selection/drag handlers (no per-node SVG).
 */
export function NativeHitLayer({
  nodes,
  childOrder,
  zoom = 1,
}: Pick<SceneRendererProps, "nodes" | "childOrder" | "zoom">) {
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);
  const { panning } = useCanvasInteraction();
  const toWorld = useCanvasToWorld();
  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      const el = document.querySelector<HTMLElement>("[data-canvas-viewport]");
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return { x: (clientX - r.left - pan.x) / z, y: (clientY - r.top - pan.y) / z };
    },
    [toWorld],
  );

  const handlers = useCanvasHitHandlers(clientToWorld);

  const pickAt = useCallback(
    (clientX: number, clientY: number) => {
      const w = clientToWorld(clientX, clientY);
      return pickDeepestNodeAtWorldPoint(w.x, w.y, nodes, childOrder, { zoom });
    },
    [clientToWorld, nodes, childOrder, zoom],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const hit = pickAt(e.clientX, e.clientY);
      if (hit) handlers.onEnter(hit);
      else {
        const st = useEditorStore.getState();
        if (st.hoveredCanvasId) handlers.onLeave(st.hoveredCanvasId);
      }
    },
    [handlers, pickAt],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const hit = pickAt(e.clientX, e.clientY);
      if (!hit) return;
      clearPostCreationPointerSuppress();
      handlers.onPointerDown(e, hit);
    },
    [handlers, pickAt],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const hit = pickAt(e.clientX, e.clientY);
      if (!hit) return;
      handlers.onDoubleClick(e, hit);
    },
    [handlers, pickAt],
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const hit = pickAt(e.clientX, e.clientY);
      if (!hit) return;
      handlers.onContextMenu(e, hit);
    },
    [handlers, pickAt],
  );

  return (
    <div
      className="absolute inset-0 z-[3] touch-none"
      data-native-hit-layer
      style={{
        // Let hand tool / Space+pan reach the canvas background; path edit uses screen overlays.
        pointerEvents: pathEditModeNodeId || panning ? "none" : "auto",
        touchAction: "none",
      }}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      aria-hidden
    />
  );
}
