"use client";

import { useCallback } from "react";
import { pathToSvgD } from "@/lib/pathGeometry";
import { screenPxToWorld } from "@/lib/canvasVisual";
import { beginCanvasNodeDrag, type ClientToWorldFn } from "@/lib/canvasNodeDrag";
import {
  canCanvasObjectDrag,
  canCanvasObjectInteract,
  isCanvasBgCreationTool,
  isCanvasSelectTool,
} from "@/lib/canvasInteractionGuards";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import {
  composeSvgTransform,
  getNodeWorldMatrix,
  matrixToSvgTransform,
} from "@/lib/transformMath";
import { useCanvasToWorld } from "@/components/editor/CanvasToWorldContext";
import { useCanvasInteraction } from "@/components/editor/CanvasInteractionContext";
import { pickDeepestNodeAtWorldPoint } from "@/lib/tree";
import type { SceneRendererProps } from "./RendererTypes";

const SCENE_SIZE = 6000;
const LINE_HIT_SCREEN_PX = 8;

type HitShapeProps = {
  node: EditorNode;
  zoom: number;
  onPointerDown: (e: React.PointerEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
  onEnter: (nodeId: string) => void;
  onLeave: (nodeId: string) => void;
};

function HitShape({
  node,
  zoom,
  onPointerDown,
  onDoubleClick,
  onContextMenu,
  onEnter,
  onLeave,
}: HitShapeProps) {
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  const common = {
    fill: "transparent",
    stroke: "transparent",
    "data-node-id": node.id,
    "data-svg-hit": true,
    style: { pointerEvents: "all" as const },
    onPointerDown: (e: React.PointerEvent) => onPointerDown(e, node.id),
    onDoubleClick: (e: React.MouseEvent) => onDoubleClick(e, node.id),
    onContextMenu: (e: React.MouseEvent) => onContextMenu(e, node.id),
    onPointerEnter: () => onEnter(node.id),
    onPointerLeave: () => onLeave(node.id),
  };

  if (node.type === "ellipse") {
    return (
      <ellipse
        cx={w / 2}
        cy={h / 2}
        rx={w / 2}
        ry={h / 2}
        {...common}
      />
    );
  }

  if (node.type === "line") {
    const hitW = screenPxToWorld(LINE_HIT_SCREEN_PX, zoom);
    const y = h / 2;
    return (
      <line
        x1={0}
        y1={y}
        x2={w}
        y2={y}
        stroke="transparent"
        strokeWidth={hitW}
        fill="none"
        data-node-id={node.id}
        data-svg-hit
        style={{ pointerEvents: "stroke" as const }}
        onPointerDown={(e) => onPointerDown(e, node.id)}
        onDoubleClick={(e) => onDoubleClick(e, node.id)}
        onContextMenu={(e) => onContextMenu(e, node.id)}
        onPointerEnter={() => onEnter(node.id)}
        onPointerLeave={() => onLeave(node.id)}
      />
    );
  }

  if (node.type === "path") {
    const pts = node.pathPoints ?? [];
    const d = pathToSvgD(pts, node.pathClosed ?? false);
    const hitW = Math.max(
      screenPxToWorld(LINE_HIT_SCREEN_PX, zoom),
      (node.strokeWidth ?? 2) + screenPxToWorld(4, zoom),
    );
    if (d) {
      const closed = node.pathClosed ?? false;
      return (
        <path
          d={d}
          fill={closed ? "transparent" : "none"}
          stroke="transparent"
          strokeWidth={hitW}
          data-node-id={node.id}
          data-svg-hit
          style={{ pointerEvents: closed ? ("painted" as const) : ("stroke" as const) }}
          onPointerDown={(e) => onPointerDown(e, node.id)}
          onDoubleClick={(e) => onDoubleClick(e, node.id)}
          onContextMenu={(e) => onContextMenu(e, node.id)}
          onPointerEnter={() => onEnter(node.id)}
          onPointerLeave={() => onLeave(node.id)}
        />
      );
    }
  }

  return <rect x={0} y={0} width={w} height={h} {...common} />;
}

function HitSubtree({
  nodeId,
  nodes,
  childOrder,
  zoom,
  onPointerDown,
  onDoubleClick,
  onContextMenu,
  onEnter,
  onLeave,
}: {
  nodeId: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  zoom: number;
  onPointerDown: (e: React.PointerEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
  onEnter: (nodeId: string) => void;
  onLeave: (nodeId: string) => void;
}) {
  const node = nodes[nodeId];
  if (!node?.visible) return null;
  const kids = childOrder[nodeId] ?? [];

  return (
    <g data-hit-subtree={nodeId}>
      <HitShape
        node={node}
        zoom={zoom}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onEnter={onEnter}
        onLeave={onLeave}
      />
      {kids.map((cid) => {
        const c = nodes[cid];
        if (!c?.visible) return null;
        return (
          <g key={cid} transform={`translate(${c.x}, ${c.y})`}>
            <HitSubtree
              nodeId={cid}
              nodes={nodes}
              childOrder={childOrder}
              zoom={zoom}
              onPointerDown={onPointerDown}
              onDoubleClick={onDoubleClick}
              onContextMenu={onContextMenu}
              onEnter={onEnter}
              onLeave={onLeave}
            />
          </g>
        );
      })}
    </g>
  );
}

export function SvgHitLayer({
  rootIds,
  nodes,
  childOrder,
  zoom = 1,
}: Pick<SceneRendererProps, "rootIds" | "nodes" | "childOrder" | "zoom">) {
  const tool = useEditorStore((s) => s.tool);
  const editorMode = useEditorStore((s) => s.editorMode);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);

  if (isCanvasBgCreationTool(tool, editorMode, { isPlacingComment })) {
    return null;
  }

  const toWorld = useCanvasToWorld();
  const { spaceDown, panning: canvasPanning } = useCanvasInteraction();

  const clientToWorld: ClientToWorldFn = useCallback(
    (clientX, clientY) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      const el = document.querySelector<HTMLElement>("[data-canvas-viewport]");
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return { x: (clientX - r.left - pan.x) / z, y: (clientY - r.top - pan.y) / z };
    },
    [toWorld],
  );

  const onEnter = useCallback((nodeId: string) => {
    const st = useEditorStore.getState();
    if (st.editingTextId || st.pathEditModeNodeId) return;
    const n = st.nodes[nodeId];
    if (!n?.visible) return;
    if (st.editorMode === "inspect") {
      st.setHoveredCanvasId(nodeId);
      return;
    }
    if (!n.locked) st.setHoveredCanvasId(nodeId);
  }, []);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      const st = useEditorStore.getState();
      const node = st.nodes[nodeId];
      if (!node?.visible || node.locked) return;
      if (st.editorMode === "inspect") return;

      let editTextId: string | null = node.type === "text" ? nodeId : null;
      if (!editTextId) {
        const w = clientToWorld(e.clientX, e.clientY);
        editTextId = pickDeepestNodeAtWorldPoint(w.x, w.y, st.nodes, st.childOrder, { types: ["text"] });
      }
      if (editTextId) {
        st.pushHistory();
        st.select(editTextId);
        st.setEditingTextId(editTextId);
        return;
      }

      if (node.type === "path" && st.tool === "move") {
        if (st.pathEditModeNodeId === nodeId) st.setPathEditMode(null);
        else st.setPathEditMode(nodeId);
      }
    },
    [clientToWorld],
  );

  const onLeave = useCallback((nodeId: string) => {
    const st = useEditorStore.getState();
    if (st.hoveredCanvasId === nodeId) st.setHoveredCanvasId(null);
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const n = useEditorStore.getState().nodes[nodeId];
    if (!n?.visible) return;
    useEditorStore.getState().openContextMenu(nodeId, e.clientX, e.clientY);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      const node = useEditorStore.getState().nodes[nodeId];
      if (!node?.visible) return;

      if (!canCanvasObjectInteract({ spaceDown, canvasPanning })) return;

      const st = useEditorStore.getState();
      const { select, editorMode, tool } = st;

      if (editorMode === "inspect") {
        e.stopPropagation();
        if (tool === "comment" || tool === "pen" || e.button === 1) return;
        select(nodeId, e.shiftKey);
        return;
      }

      if (node.locked) {
        e.stopPropagation();
        if (isCanvasSelectTool()) select(nodeId, e.shiftKey);
        return;
      }

      e.stopPropagation();

      if (tool === "comment" || tool === "pen" || e.button === 1) return;

      if (tool !== "move" && tool !== "frame") {
        select(nodeId, e.shiftKey);
        return;
      }

      select(nodeId, e.shiftKey);

      if (e.button !== 0) return;
      if (!canCanvasObjectDrag()) return;

      beginCanvasNodeDrag({
        nodeId,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld,
        captureTarget: e.currentTarget as Element,
      });
    },
    [clientToWorld, spaceDown, canvasPanning],
  );

  return (
    <svg
      className="absolute inset-0 z-[1] overflow-visible"
      width={SCENE_SIZE}
      height={SCENE_SIZE}
      viewBox={`0 0 ${SCENE_SIZE} ${SCENE_SIZE}`}
      style={{ pointerEvents: "none" }}
      data-svg-hit-layer
      aria-hidden
      focusable="false"
    >
      <g data-svg-hits>
        {rootIds.map((rid) => {
          const node = nodes[rid];
          if (!node?.visible) return null;
          const wm = getNodeWorldMatrix(rid, nodes);
          const rootTransform = wm ? matrixToSvgTransform(wm) : undefined;
          return (
            <g key={rid} transform={rootTransform} data-node-id={rid}>
              <HitSubtree
                nodeId={rid}
                nodes={nodes}
                childOrder={childOrder}
                zoom={zoom}
                onPointerDown={onPointerDown}
                onDoubleClick={onDoubleClick}
                onContextMenu={onContextMenu}
                onEnter={onEnter}
                onLeave={onLeave}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
