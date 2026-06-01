"use client";

import { useCallback, useMemo, useRef } from "react";
import { Artboard } from "./Artboard";
import { effectiveFillType, fillPaintCss } from "@/lib/fillGradient";
import { ShapeGradientFill } from "./ShapeGradientFill";
import { releaseFieldFocusForCanvas } from "@/lib/editorKeyboardFocus";
import { cn } from "@/lib/utils";
import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { pickDeepestFrameOrGroupAtWorldPoint, pickDeepestFrameAtWorldPoint, worldRect, worldToLocalForNode } from "@/lib/tree";
import { insertIndexInAutoLayout, type LayoutNode } from "@/lib/autoLayout";
import { isAncestorOf } from "@/lib/editorGraph";
import { mergeInstanceOverrides } from "@/lib/componentModel";
import { legacyEffectShadowAppend, resolveEffectBoxShadow, resolveNodeWithDesignTokens } from "@/lib/designTokens";
import { buildNodeEffectRenderStyle, firstVisibleDropShadowFilter } from "@/lib/nodeEffects";
import { CANVAS_VISUAL, screenPxToWorld } from "@/lib/canvasVisual";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { useCanvasInteraction } from "./CanvasInteractionContext";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import { beginCanvasNodeDrag } from "@/lib/canvasNodeDrag";
import { EMPTY_CHILD_IDS } from "@/lib/editorConstants";
import {
  canCanvasObjectDrag,
  canCanvasObjectInteract,
  canvasObjectPointerEvents,
  isCanvasSelectTool,
} from "@/lib/canvasInteractionGuards";
import { TextCanvasView } from "./TextCanvasView";
import { ShapeVectorView } from "./ShapeVectorView";
import { BooleanGroupView, MaskGroupView, MaskPreviewOverlay } from "./BooleanGroupView";

function isUnder(nodes: Record<string, EditorNode>, nodeId: string, ancestorId: string): boolean {
  let cur: string | null = nodes[nodeId]?.parentId ?? null;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = nodes[cur]?.parentId ?? null;
  }
  return false;
}

function collectSnapXs(nodes: Record<string, EditorNode>, excludeId: string): number[] {
  const xs: number[] = [];
  for (const id of Object.keys(nodes)) {
    if (id === excludeId || isUnder(nodes, id, excludeId)) continue;
    const w = worldRect(id, nodes);
    xs.push(w.x, w.x + w.width / 2, w.x + w.width);
  }
  return xs;
}

function collectSnapYs(nodes: Record<string, EditorNode>, excludeId: string): number[] {
  const ys: number[] = [];
  for (const id of Object.keys(nodes)) {
    if (id === excludeId || isUnder(nodes, id, excludeId)) continue;
    const w = worldRect(id, nodes);
    ys.push(w.y, w.y + w.height / 2, w.y + w.height);
  }
  return ys;
}

function toLayoutMap(nodes: Record<string, EditorNode>): Record<string, LayoutNode> {
  const m: Record<string, LayoutNode> = {};
  for (const id of Object.keys(nodes)) {
    const n = nodes[id]!;
    m[id] = {
      id: n.id,
      type: n.type,
      parentId: n.parentId,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      visible: n.visible,
      locked: n.locked,
      layoutMode: n.layoutMode,
      layoutGap: n.layoutGap,
      paddingTop: n.paddingTop,
      paddingRight: n.paddingRight,
      paddingBottom: n.paddingBottom,
      paddingLeft: n.paddingLeft,
      primaryAxisAlign: n.primaryAxisAlign,
      counterAxisAlign: n.counterAxisAlign,
      constraintsHorizontal: n.constraintsHorizontal,
      constraintsVertical: n.constraintsVertical,
    };
  }
  return m;
}

function pointInWorldRect(
  px: number,
  py: number,
  r: { x: number; y: number; width: number; height: number },
): boolean {
  return px >= r.x && py >= r.y && px <= r.x + r.width && py <= r.y + r.height;
}

/** Frames clip by default (Figma); groups only when import sets `clipChildren: true`. */
function clipsChildContent(node: EditorNode): boolean {
  if (node.type === "frame") return node.clipChildren !== false;
  if (node.type === "group") return node.clipChildren === true;
  return false;
}

export function CanvasObject({ id }: { id: string }) {
  const nodesMap = useEditorStore((s) => s.nodes);
  const assets = useEditorStore((s) => s.assets);
  const designTokens = useEditorStore((s) => s.designTokens);
  const nodeRaw = nodesMap[id];
  const node = useMemo(() => {
    if (!nodeRaw) return null;
    const merged = mergeInstanceOverrides(nodeRaw, nodesMap);
    return resolveNodeWithDesignTokens(merged, designTokens);
  }, [id, nodeRaw, nodesMap, designTokens]);
  const imageSrcResolved = useMemo(() => {
    if (!node || node.type !== "image") return undefined;
    return node.imageSrc ?? (node.assetId ? assets[node.assetId]?.dataUrl : undefined);
  }, [node, assets]);
  const childIds = useEditorStore((s) => s.childOrder[id] ?? EMPTY_CHILD_IDS);
  const tool = useEditorStore((s) => s.tool);
  const zoom = useEditorStore((s) => s.zoom);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const select = useEditorStore((s) => s.select);
  const updateNode = useEditorStore((s) => s.updateNode);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const setGuides = useEditorStore((s) => s.setGuides);
  const setHoveredCanvasId = useEditorStore((s) => s.setHoveredCanvasId);
  const hoveredCanvasId = useEditorStore((s) => s.hoveredCanvasId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const openContextMenu = useEditorStore((s) => s.openContextMenu);
  const editingTextId = useEditorStore((s) => s.editingTextId);
  const textEditSelection = useEditorStore((s) => s.textEditSelection);
  const setEditingTextId = useEditorStore((s) => s.setEditingTextId);
  const reorderNode = useEditorStore((s) => s.reorderNode);
  const moveNodeToParent = useEditorStore((s) => s.moveNodeToParent);
  const editorMode = useEditorStore((s) => s.editorMode);
  const startPrototypeConnection = useEditorStore((s) => s.startPrototypeConnection);
  const finishPrototypeConnection = useEditorStore((s) => s.finishPrototypeConnection);
  const updatePrototypeWirePointer = useEditorStore((s) => s.updatePrototypeWirePointer);
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);
  const selectedPathPointId = useEditorStore((s) => s.selectedPathPointId);
  const updatePathPoint = useEditorStore((s) => s.updatePathPoint);
  const setSelectedPathPointId = useEditorStore((s) => s.setSelectedPathPointId);
  const setPathEditMode = useEditorStore((s) => s.setPathEditMode);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const createInstance = useEditorStore((s) => s.createInstance);

  const toWorld = useCanvasToWorld();
  const { spaceDown, panning: canvasPanning } = useCanvasInteraction();
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const objectPointerEvents = canvasObjectPointerEvents({
    tool,
    editorMode,
    spaceDown,
    canvasPanning,
    isPlacingComment,
    nodeId: id,
  });


  const dragRef = useRef<{
    pointerId: number;
    sx: number;
    sy: number;
    primaryId: string;
    startWorld: Record<string, { x: number; y: number }>;
    mode: "free" | "al-reorder";
    alParentId?: string;
    lastAlInsert?: number;
  } | null>(null);

  const pathPointDragRef = useRef<{
    pointerId: number;
    pointId: string;
    startWorld: { x: number; y: number };
    startPt: { x: number; y: number };
  } | null>(null);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (toWorld) return toWorld(clientX, clientY);
      const { pan, zoom: z } = useEditorStore.getState();
      return clientToWorldFromDocument(clientX, clientY, { pan, zoom: z });
    },
    [toWorld],
  );

  const onPrototypeHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const st = useEditorStore.getState();
      const wr2 = worldRect(id, st.nodes);
      const wx = wr2.x + wr2.width;
      const wy = wr2.y + wr2.height / 2;
      startPrototypeConnection(id, e.pointerId, wx, wy);
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
          excludeDescendantsOf: id,
        });
        finishPrototypeConnection(target);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [id, clientToWorld, startPrototypeConnection, updatePrototypeWirePointer, finishPrototypeConnection],
  );

  const onPathAnchorPointerDown = useCallback(
    (pointId: string, e: React.PointerEvent) => {
      if (editorMode === "inspect" || tool !== "move" || node?.type !== "path") return;
      e.stopPropagation();
      e.preventDefault();
      pushHistory();
      const w = clientToWorld(e.clientX, e.clientY);
      const st0 = useEditorStore.getState();
      const pt = st0.nodes[id]?.pathPoints?.find((p) => p.id === pointId);
      if (!pt) return;
      setPathEditMode(id);
      setSelectedPathPointId(pointId);
      pathPointDragRef.current = {
        pointerId: e.pointerId,
        pointId,
        startWorld: w,
        startPt: { x: pt.x, y: pt.y },
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        const d = pathPointDragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        const nw = clientToWorld(ev.clientX, ev.clientY);
        const ddx = nw.x - d.startWorld.x;
        const ddy = nw.y - d.startWorld.y;
        updatePathPoint(id, pointId, { x: d.startPt.x + ddx, y: d.startPt.y + ddy }, { skipHistory: true });
      };
      const onUp = (ev: PointerEvent) => {
        const d = pathPointDragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        pathPointDragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [
      clientToWorld,
      editorMode,
      id,
      node?.type,
      pushHistory,
      setPathEditMode,
      setSelectedPathPointId,
      tool,
      updatePathPoint,
    ],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!node || !node.visible) return;

      if (objectPointerEvents === "none") return;

      if (e.button === 0) releaseFieldFocusForCanvas();

      if (editorMode === "inspect") {
        e.stopPropagation();
        if (tool === "comment" || tool === "pen" || e.button === 1) return;
        select(node.id, e.shiftKey);
        return;
      }

      if (node.locked) {
        e.stopPropagation();
        if (isCanvasSelectTool()) select(node.id, e.shiftKey);
        return;
      }
      e.stopPropagation();

      if (tool === "comment" || tool === "pen" || e.button === 1) return;

      if (tool !== "move" && tool !== "frame") {
        select(node.id, e.shiftKey);
        return;
      }

      select(node.id, e.shiftKey);

      if (
        e.button === 0 &&
        e.altKey &&
        node.isComponent &&
        (node.type === "frame" || node.type === "group") &&
        tool === "move" &&
        canCanvasObjectDrag()
      ) {
        const w = clientToWorld(e.clientX, e.clientY);
        createInstance(node.id, w.x, w.y);
        const newId = useEditorStore.getState().selectedIds[0];
        if (newId) {
          beginCanvasNodeDrag({
            nodeId: newId,
            pointerId: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY,
            clientToWorld,
            captureTarget: e.currentTarget as HTMLElement,
          });
        }
        return;
      }

      if (e.button !== 0 || !canCanvasObjectDrag()) return;

      beginCanvasNodeDrag({
        nodeId: node.id,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld,
        captureTarget: e.currentTarget as HTMLElement,
      });
    },
    [node, select, tool, clientToWorld, editorMode, objectPointerEvents, selectedIds, pushHistory, setEditingTextId, createInstance],
  );

  const isEditingText = node?.type === "text" && editingTextId === id;

  if (!node || !node.visible) return null;

  const r = node.cornerRadius ?? 0;
  const sw = node.strokeWidth ?? 0;
  const sc = node.strokeColor;
  const fill = fillPaintCss(node);
  const isGradientFill = effectiveFillType(node) === "gradient";
  const showShapeFill = node.fillEnabled !== false && isGradientFill;
  const isRootFrame = node.type === "frame" && node.parentId === null;
  const borderStyle =
    sw > 0 && sc
      ? `${sw}px ${node.strokeStyle === "dashed" ? "dashed" : node.strokeStyle === "dotted" ? "dotted" : "solid"} ${sc}`
      : undefined;
  const showInspectHover =
    editorMode === "inspect" && hoveredCanvasId === id && !selectedIds.includes(id) && node.visible;
  const showDesignHover =
    editorMode !== "inspect" &&
    hoveredCanvasId === id &&
    !selectedIds.includes(id) &&
    !node.locked &&
    node.visible;

  const childrenTree = (
    <div className="relative h-full w-full">
      {childIds.map((cid) => (
        <CanvasObject key={cid} id={cid} />
      ))}
    </div>
  );

  let body: React.ReactNode;
  if (node.type === "text") {
    body = (
      <TextCanvasView
        node={node}
        isEditing={isEditingText}
        selection={isEditingText ? textEditSelection : null}
      />
    );
  } else if (node.type === "group") {
    if (node.maskId) {
      const maskNode = nodesMap[node.maskId];
      const contentIds = childIds.filter((cid) => cid !== node.maskId);
      body = (
        <MaskGroupView
          groupId={id}
          node={node}
          maskNode={maskNode ?? null}
          contentTree={
            <div className="relative h-full w-full">
              {contentIds.map((cid) => (
                <CanvasObject key={cid} id={cid} />
              ))}
            </div>
          }
          maskPreview={
            maskNode ? (
              <MaskPreviewOverlay>
                <CanvasObject id={node.maskId!} />
              </MaskPreviewOverlay>
            ) : null
          }
        />
      );
    } else if (node.isBooleanGroup) {
      body = (
        <BooleanGroupView
          groupId={id}
          node={node}
          childIds={childIds}
          childrenTree={childrenTree}
        />
      );
    } else {
      body = clipsChildContent(node) ? (
        <div className="relative h-full w-full overflow-hidden">{childrenTree}</div>
      ) : (
        childrenTree
      );
    }
  } else if (node.type === "frame") {
    const shell = (
      <div
        className="relative h-full w-full"
        style={{
          background: showShapeFill
            ? undefined
            : node.fillEnabled === false
              ? "transparent"
              : (fill ?? "#ffffff"),
          borderRadius: r,
          border: isRootFrame ? undefined : borderStyle,
          overflow: clipsChildContent(node) ? "hidden" : "visible",
        }}
      >
        {showShapeFill ? <ShapeGradientFill node={node} nodeId={id} shape="rect" /> : null}
        {childrenTree}
      </div>
    );
    body = isRootFrame ? <Artboard>{shell}</Artboard> : shell;
  } else if (node.type === "ellipse" || node.type === "rectangle" || node.type === "line") {
    body = <ShapeVectorView node={node} nodeId={id} />;
  } else if (node.type === "path") {
    const pts = node.pathPoints ?? [];
    const singleSelected = selectedIds.length === 1 && selectedIds[0] === id;
    const showAnchors =
      editorMode === "design" && tool === "move" && singleSelected && pts.length > 0;
    body = (
      <>
        <ShapeVectorView node={node} nodeId={id} />
        {showAnchors ? (
          <div className="pointer-events-none absolute inset-0">
            {pts.map((pt) => (
              <button
                key={pt.id}
                type="button"
                aria-label="Anchor point"
                className={cn(
                  "pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 border-2 border-[#18a0fb] bg-white",
                  pathEditModeNodeId === id && selectedPathPointId === pt.id ? "ring-2 ring-amber-300" : "",
                )}
                style={{ left: pt.x, top: pt.y }}
                onPointerDown={(ev) => onPathAnchorPointerDown(pt.id, ev)}
              />
            ))}
          </div>
        ) : null}
      </>
    );
  } else if (node.type === "image") {
    const fit = node.imageFitMode ?? "fill";
    const objectFit: "contain" | "cover" | "fill" =
      fit === "fit" ? "contain" : fit === "crop" ? "cover" : "fill";
    body = imageSrcResolved ? (
      <div className="relative h-full w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrcResolved}
          alt={node.imageName ?? node.name}
          draggable={false}
          className="h-full w-full select-none"
          style={{ objectFit, objectPosition: "50% 50%" }}
        />
      </div>
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-slate-700 text-[11px] text-slate-300">
        Missing image
      </div>
    );
  }

  const radiusStyle =
    node.type === "frame" ? (node.cornerRadius ?? 0) : undefined;

  const tokenShadow = resolveEffectBoxShadow(node, designTokens);
  const ringShadow = showInspectHover
    ? `0 0 0 1px rgba(244,114,182,0.75)`
    : showDesignHover
      ? `0 0 0 1px ${CANVAS_VISUAL.hoverOutline}`
      : undefined;
  const hasRichEff = !!(node.effects && node.effects.length > 0);
  const tokenLeg = hasRichEff ? legacyEffectShadowAppend(node, designTokens) : tokenShadow;
  const er = buildNodeEffectRenderStyle(hasRichEff ? node.effects : undefined, tokenLeg);
  const dropF = firstVisibleDropShadowFilter(hasRichEff ? node.effects : undefined);
  const filterParts = [dropF, er.filter].filter(Boolean);
  const combinedFilter = filterParts.length ? filterParts.join(" ") : undefined;
  const combinedShadow = [er.boxShadow, ringShadow].filter(Boolean).join(", ") || undefined;
  const layerOpacity = node.opacity ?? 1;
  const imageAlpha = node.type === "image" ? layerOpacity * (node.fillOpacity ?? 1) : layerOpacity;

  return (
    <div
      data-canvas-node={id}
      className={cn(
        "absolute box-border select-none",
        isRootFrame && node.type === "frame" && "shadow-artboard",
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        pointerEvents: objectPointerEvents,
        borderRadius: radiusStyle,
        overflow: clipsChildContent(node) ? "hidden" : "visible",
        outline:
          node.type === "group" &&
          !node.isBooleanGroup &&
          !node.maskId &&
          (node.layoutMode ?? "none") === "none"
            ? "1px dashed rgba(15,23,42,0.12)"
            : node.isBooleanGroup
            ? "1px dashed rgba(24,160,251,0.45)"
            : node.maskId
              ? "1px dashed rgba(168,85,247,0.45)"
              : undefined,
        boxShadow: combinedShadow,
        filter: combinedFilter,
        backdropFilter: er.backdropFilter,
        cursor:
          editorMode === "inspect"
            ? "default"
            : tool === "text"
              ? "text"
              : tool === "hand"
                ? "grab"
                : undefined,
        transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
        transformOrigin: "50% 50%",
        opacity: imageAlpha < 0.999 ? imageAlpha : undefined,
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        if (node.type === "text" && editorMode === "design" && !node.locked && node.visible) {
          e.stopPropagation();
          setEditingTextId(node.id);
          return;
        }
        if (node.isBooleanGroup && editorMode === "design" && !node.locked) {
          e.stopPropagation();
          useEditorStore.getState().enterObjectEditMode(node.id);
          return;
        }
        if (node.type !== "path" || editorMode === "inspect") return;
        e.stopPropagation();
        const st = useEditorStore.getState();
        if (st.pathEditModeNodeId === id) st.setPathEditMode(null);
        else st.setPathEditMode(id);
      }}
      onPointerEnter={() => {
        if (!node.visible) return;
        if (editorMode === "inspect") {
          setHoveredCanvasId(id);
          return;
        }
        if (!node.locked) setHoveredCanvasId(id);
      }}
      onPointerLeave={(e) => {
        const rt = e.relatedTarget as Node | null;
        if (!rt || !(e.currentTarget as HTMLElement).contains(rt)) {
          if (useEditorStore.getState().hoveredCanvasId === id) setHoveredCanvasId(null);
        }
      }}
      onContextMenu={(e) => {
        if (!node.visible) return;
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(id, e.clientX, e.clientY);
      }}
    >
      {body}
      {editorMode === "prototype" &&
      tool === "move" &&
      selectedIds.length === 1 &&
      selectedIds[0] === id ? (
        <button
          type="button"
          data-prototype-handle
          className="absolute top-1/2 z-20 -translate-y-1/2 translate-x-1/2 cursor-crosshair rounded-full border border-white bg-[#18a0fb]"
          style={{
            right: 0,
            width: screenPxToWorld(10, zoom),
            height: screenPxToWorld(10, zoom),
          }}
          aria-label="Drag to connect prototype"
          onPointerDown={onPrototypeHandlePointerDown}
        />
      ) : null}
    </div>
  );
}
