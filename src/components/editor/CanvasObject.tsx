"use client";

import { useCallback, useMemo, useRef } from "react";
import { Artboard } from "./Artboard";
import { releaseFieldFocusForCanvas } from "@/lib/editorKeyboardFocus";
import { cn } from "@/lib/utils";
import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import {
  pickDeepestFrameOrGroupAtWorldPoint,
  pickDeepestFrameAtWorldPoint,
  pickDeepestNodeAtWorldPoint,
  worldRect,
  worldToLocalForNode,
} from "@/lib/tree";
import type { LayoutNode } from "@/lib/autoLayout";
import { buildParentMapFromChildOrder, isAncestorOf } from "@/lib/editorGraph";
import { findInstanceRoot } from "@/lib/componentModel";
import { isVariantMasterInComponentSet } from "@/lib/components/componentSet";
import { resolveNodeForDisplay } from "@/lib/components/resolveForDisplay";
import { ComponentCanvasMarker } from "./ComponentCanvasMarker";
import { useComponentInteractionPreview } from "./useComponentInteractionPreview";
import { legacyEffectShadowAppend, resolveEffectBoxShadow, resolveNodeWithDesignTokens } from "@/lib/designTokens";
import { buildNodeEffectRenderStyle, firstVisibleDropShadowFilter } from "@/lib/nodeEffects";
import { EffectOverlays } from "./EffectOverlays";
import { CANVAS_VISUAL, screenPxToWorld } from "@/lib/canvasVisual";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { useCanvasInteraction } from "./CanvasInteractionContext";
import { clientToWorldFromDocument } from "@/lib/canvasCoordinates";
import { beginCanvasNodeDrag } from "@/lib/canvasNodeDrag";
import {
  createRafPointerScheduler,
  forEachCoalescedPointerEvent,
} from "@/lib/smoothPointer";
import {
  applyMoveToolPointerSelection,
  isAdditiveSelectionClick,
  isDeepSelectClick,
  drillTargetForDoubleClick,
  frameBodyReceivesPointerHits,
  hasVisibleChildren,
  resolveCanvasDragNodeId,
  selectionTargetForClick,
  shouldCollapseContainerHits,
} from "@/lib/containerSelection";
import {
  findSlotPropertyForHit,
  isSlotShellLayer,
  slotDrillTargetForDoubleClick,
  slotSelectionTargetForClick,
} from "@/lib/slotEditScope";
import {
  canEnterParametricShapeEdit,
  shouldEnterPathEditOnEdit,
} from "@/lib/editMode/shapeEditGate";
import { clampCornerRadii, cornerRadiiToCss, getNodeCornerRadii } from "@/lib/cornerRadius";
import { isRoundedRectPath } from "@/lib/shapes/shapeToPath";
import {
  pathEditAnchorStyle,
  pathEditBezierHandleStyle,
  PATH_EDIT_HANDLE_LINE_STROKE,
  pathPointForBezierHandleDisplay,
  pathPointHandleAffordances,
} from "@/lib/pathEditAnchors";
import { applyPathPointHitOnPath } from "@/lib/pathEditSelection";
import { layerBlendCanvasStyle } from "@/lib/layerBlendMode";
import { prepareAltDragDuplicate } from "@/lib/canvasAltDrag";
import { EMPTY_CHILD_IDS } from "@/lib/editorConstants";
import {
  canCanvasObjectDrag,
  canCanvasObjectInteract,
  canvasObjectPointerEvents,
  isCanvasSelectTool,
} from "@/lib/canvasInteractionGuards";
import { TextCanvasView } from "./TextCanvasView";
import { enterTextEditModeAtWorldPoint } from "@/lib/text/textEditMode";
import { PathEditPathOutline } from "./PathEditPathOutline";
import { ShapeVectorView } from "./ShapeVectorView";
import { BooleanGroupView, MaskGroupView } from "./BooleanGroupView";
import { shouldClipChildren, clipContentContainerStyle } from "@/lib/clipChildren";
import { shouldRenderCanvasNode } from "@/lib/canvasViewportCull";
import { useCanvasViewportCull } from "./CanvasViewportContext";
import { getDragPreviewOffsetForIds } from "@/lib/canvasEphemeralTransform";
import { cssRotationStyle } from "@/lib/transformMath";
import { shouldSuppressCanvasPointer } from "@/lib/canvasCreationGuard";
import { didPointerExitElement } from "@/lib/domPointer";
import { isZeroAreaDraftNode } from "@/lib/shapes/shapeDraft";

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

export function CanvasObject({
  id,
  skipViewportCull = false,
}: {
  id: string;
  skipViewportCull?: boolean;
}) {
  const nodeRaw = useEditorStore((s) => s.nodes[id]);
  const childOrder = useEditorStore((s) => s.childOrder);
  const nodes = useEditorStore((s) => s.nodes);
  const instanceRootId = useEditorStore((s) => findInstanceRoot(s.nodes, id));
  const assets = useEditorStore((s) => s.assets);
  const designTokens = useEditorStore((s) => s.designTokens);
  const canvasColorMode = useEditorStore((s) => s.canvasColorMode);
  const projectCssSources = useEditorStore((s) => s.projectCssSources);
  const node = useMemo(() => {
    if (!nodeRaw) return null;
    const merged = resolveNodeForDisplay(nodes, childOrder, id) ?? nodeRaw;
    return resolveNodeWithDesignTokens(merged, designTokens, canvasColorMode, projectCssSources);
  }, [nodeRaw, nodes, childOrder, id, designTokens, canvasColorMode, projectCssSources]);
  const maskNode = useEditorStore((s) =>
    nodeRaw?.maskId ? s.nodes[nodeRaw.maskId] : undefined,
  );
  const viewportCull = useCanvasViewportCull();
  const dragOffset = getDragPreviewOffsetForIds([id]);
  const childIds = childOrder[id] ?? EMPTY_CHILD_IDS;
  const imageSrcResolved = useMemo(() => {
    if (!node || node.type !== "image") return undefined;
    return node.imageSrc ?? (node.assetId ? assets[node.assetId]?.dataUrl : undefined);
  }, [node, assets]);
  const objectEditModeNodeId = useEditorStore((s) => s.objectEditModeNodeId);
  const activeSlotEdit = useEditorStore((s) => s.activeSlotEdit);
  const tool = useEditorStore((s) => s.tool);
  const zoom = useEditorStore((s) => s.zoom);
  const penDrawingNodeId = useEditorStore((s) => s.penDrawingNodeId);
  const shapeDrawingNodeId = useEditorStore((s) => s.shapeDrawingSession?.nodeId ?? null);
  const frameDrawingNodeId = useEditorStore((s) => s.frameDrawingSession?.nodeId ?? null);
  const textDrawingNodeId = useEditorStore((s) => s.textDrawingSession?.nodeId ?? null);
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
  const editorMode = useEditorStore((s) => s.editorMode);
  const isPlacingComment = useEditorStore((s) => s.isPlacingComment);
  const startPrototypeConnection = useEditorStore((s) => s.startPrototypeConnection);
  const finishPrototypeConnection = useEditorStore((s) => s.finishPrototypeConnection);
  const updatePrototypeWirePointer = useEditorStore((s) => s.updatePrototypeWirePointer);
  const pathEditModeNodeId = useEditorStore((s) => s.pathEditModeNodeId);
  const selectedPathPointIds = useEditorStore((s) => s.selectedPathPointIds);
  const updatePathPoints = useEditorStore((s) => s.updatePathPoints);
  const togglePathPointSelection = useEditorStore((s) => s.togglePathPointSelection);
  const setPathEditMode = useEditorStore((s) => s.setPathEditMode);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const createInstance = useEditorStore((s) => s.createInstance);
  const interactionPreview = useComponentInteractionPreview(id);

  const toWorld = useCanvasToWorld();
  const { spaceDown, panning: canvasPanning, commandDown, optionDown, optionOverSelection } =
    useCanvasInteraction();
  const variantSetSize = useEditorStore((s) => {
    const n = s.nodes[id];
    if (!n?.isComponent || !n.variantGroupId) return 0;
    let count = 0;
    for (const m of Object.values(s.nodes)) {
      if (m.isComponent && m.variantGroupId === n.variantGroupId) count++;
    }
    return count;
  });
  const objectPointerEvents = canvasObjectPointerEvents({
    tool,
    editorMode,
    spaceDown,
    canvasPanning,
    isPlacingComment,
    nodeId: id,
  });


  const pathPointDragRef = useRef<{
    pointerId: number;
    pointIds: string[];
    startWorld: { x: number; y: number };
    startPts: Record<string, { x: number; y: number }>;
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
      if (editorMode === "inspect" || (tool !== "move" && tool !== "pen") || node?.type !== "path") return;
      e.stopPropagation();
      e.preventDefault();
      const st0 = useEditorStore.getState();
      const pathNode = st0.nodes[id];
      const pt = pathNode?.pathPoints?.find((p) => p.id === pointId);
      if (!pt || !pathNode) return;
      if (st0.pathEditModeNodeId !== id) {
        setPathEditMode(id);
      }
      let dragIds: string[];
      if (e.shiftKey) {
        if (st0.selectedPathPointIds.includes(pointId)) {
          togglePathPointSelection(pointId, true);
          return;
        }
        dragIds = [...st0.selectedPathPointIds, pointId];
        togglePathPointSelection(pointId, true);
      } else if (st0.selectedPathPointIds.includes(pointId) && st0.selectedPathPointIds.length > 1) {
        dragIds = st0.selectedPathPointIds;
      } else {
        dragIds = [pointId];
        togglePathPointSelection(pointId, false);
      }
      if (isRoundedRectPath(pathNode)) return;
      pushHistory();
      const w = clientToWorld(e.clientX, e.clientY);
      const startPts: Record<string, { x: number; y: number }> = {};
      for (const pid of dragIds) {
        const p = pathNode.pathPoints?.find((x) => x.id === pid);
        if (p) startPts[pid] = { x: p.x, y: p.y };
      }
      pathPointDragRef.current = {
        pointerId: e.pointerId,
        pointIds: dragIds,
        startWorld: w,
        startPts,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const applyMove = (clientX: number, clientY: number) => {
        const d = pathPointDragRef.current;
        if (!d) return;
        const nw = clientToWorld(clientX, clientY);
        const ddx = nw.x - d.startWorld.x;
        const ddy = nw.y - d.startWorld.y;
        const patches: Record<string, { x: number; y: number }> = {};
        for (const pid of d.pointIds) {
          const start = d.startPts[pid];
          if (!start) continue;
          patches[pid] = { x: start.x + ddx, y: start.y + ddy };
        }
        updatePathPoints(id, patches, { skipHistory: true });
      };

      const pathScheduler = createRafPointerScheduler<{ clientX: number; clientY: number }>(
        ({ clientX, clientY }) => applyMove(clientX, clientY),
      );

      const onMove = (ev: PointerEvent) => {
        const d = pathPointDragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        forEachCoalescedPointerEvent(ev, (pe) => {
          pathScheduler.schedule({ clientX: pe.clientX, clientY: pe.clientY });
        });
      };
      const onUp = (ev: PointerEvent) => {
        const d = pathPointDragRef.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        forEachCoalescedPointerEvent(ev, (pe) => {
          pathScheduler.schedule({ clientX: pe.clientX, clientY: pe.clientY });
        });
        pathScheduler.flush();
        pathScheduler.cancel();
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
      togglePathPointSelection,
      tool,
      updatePathPoints,
    ],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!node || !node.visible) return;

      if (shouldSuppressCanvasPointer()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (objectPointerEvents === "none") return;

      if (interactionPreview.previewActive) {
        interactionPreview.onPreviewPointerDown?.(e);
        return;
      }

      if (e.button === 0) releaseFieldFocusForCanvas();

      const st = useEditorStore.getState();
      const deepSelect = isDeepSelectClick(e);
      let targetId = selectionTargetForClick(
        node.id,
        st.nodes,
        st.childOrder,
        st.objectEditModeNodeId,
        deepSelect,
      );
      if (st.activeSlotEdit) {
        targetId = slotSelectionTargetForClick(
          node.id,
          st.nodes,
          st.childOrder,
          st.activeSlotEdit,
          st.objectEditModeNodeId,
          deepSelect,
        );
      }

      if (editorMode === "inspect") {
        e.stopPropagation();
        if (tool === "comment" || tool === "pen" || tool === "pencil" || e.button === 1) return;
        select(targetId, isAdditiveSelectionClick(e));
        return;
      }

      if (node.locked) {
        e.stopPropagation();
        if (isCanvasSelectTool()) select(targetId, isAdditiveSelectionClick(e));
        return;
      }
      e.stopPropagation();

      if (tool === "pen" && !st.penDrawingNodeId && node.type === "path") {
        const w = clientToWorld(e.clientX, e.clientY);
        if (
          applyPathPointHitOnPath(id, w.x, w.y, st, {
            setPathEditMode: st.setPathEditMode,
            setSelectedPathPointIds: st.setSelectedPathPointIds,
            select: (nodeId) => select(nodeId, false),
          })
        ) {
          return;
        }
      }

      if (tool === "comment" || tool === "pen" || tool === "pencil" || e.button === 1) return;

      if (tool !== "move" && tool !== "frame") {
        select(targetId, isAdditiveSelectionClick(e));
        return;
      }

      const additive = isAdditiveSelectionClick(e);
      applyMoveToolPointerSelection(targetId, st.selectedIds, additive, select, st.nodes);

      if (additive) return;

      const dragSt = useEditorStore.getState();
      const dragNodeId = resolveCanvasDragNodeId(targetId, dragSt.selectedIds, dragSt.nodes);
      const dragNode = dragSt.nodes[dragNodeId];
      if (
        e.button === 0 &&
        e.altKey &&
        dragNode?.isComponent &&
        (dragNode.type === "frame" || dragNode.type === "group") &&
        tool === "move" &&
        canCanvasObjectDrag()
      ) {
        const w = clientToWorld(e.clientX, e.clientY);
        createInstance(targetId, w.x, w.y);
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

      if (e.altKey && !prepareAltDragDuplicate(targetId)) return;

      beginCanvasNodeDrag({
        nodeId: dragNodeId,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld,
        captureTarget: e.currentTarget as HTMLElement,
        fromAltDragDuplicate: e.altKey,
      });
    },
    [node, select, tool, clientToWorld, editorMode, objectPointerEvents, createInstance],
  );

  const isEditingText = node?.type === "text" && editingTextId === id;

  const renderParentId = useMemo(() => {
    const parentOf = buildParentMapFromChildOrder(childOrder);
    return parentOf.get(id) ?? null;
  }, [childOrder, id]);

  if (!node || !node.visible) return null;

  const nodesSnapshot = useEditorStore.getState().nodes;
  if (
    !shouldRenderCanvasNode(id, nodesSnapshot, childOrder, viewportCull, {
      skipViewportCull,
      dragOffset: dragOffset.dx !== 0 || dragOffset.dy !== 0 ? dragOffset : undefined,
    })
  ) {
    return null;
  }

  const childSkipViewportCull = skipViewportCull || shouldClipChildren(node);

  const cornerRadiusCss =
    node.type === "rectangle" || node.type === "frame"
      ? cornerRadiiToCss(clampCornerRadii(getNodeCornerRadii(node), node.width, node.height))
      : undefined;
  const isRootFrame = node.type === "frame" && renderParentId === null;
  const frameIsSelected = selectedIds.includes(id);
  const frameBodyHits =
    frameBodyReceivesPointerHits(id, nodesSnapshot, childOrder, commandDown) ||
    (frameIsSelected && hasVisibleChildren(id, nodesSnapshot, childOrder));
  const collapseChildHits = shouldCollapseContainerHits(
    id,
    nodesSnapshot,
    childOrder,
    objectEditModeNodeId,
    commandDown,
    selectedIds,
  );
  const slotShellLocked =
    activeSlotEdit != null && isSlotShellLayer(nodesSnapshot, activeSlotEdit, id);
  const slotHoverTarget =
    !activeSlotEdit &&
    hoveredCanvasId != null &&
    findSlotPropertyForHit(nodesSnapshot, childOrder, hoveredCanvasId)?.containerId === id;
  const layerPointerEvents = slotShellLocked
    ? "none"
    : node.type === "frame" && !frameBodyHits
      ? "none"
      : objectPointerEvents;

  const childrenTree = (
    <div
      className="relative h-full w-full"
      style={collapseChildHits ? { pointerEvents: "none" } : undefined}
    >
      {childIds.map((cid) => (
        <CanvasObject key={cid} id={cid} skipViewportCull={childSkipViewportCull} />
      ))}
    </div>
  );

  const hideZeroDraft =
    (shapeDrawingNodeId === id ||
      frameDrawingNodeId === id ||
      textDrawingNodeId === id) &&
    isZeroAreaDraftNode(node);

  let body: React.ReactNode;
  if (node.type === "text") {
    body = hideZeroDraft ? null : (
      <TextCanvasView
        node={node}
        isEditing={isEditingText}
        selection={isEditingText ? textEditSelection : null}
      />
    );
  } else if (node.type === "group") {
    if (node.maskId) {
      const mask = maskNode;
      const contentIds = childIds.filter((cid) => cid !== node.maskId);
      body = (
        <MaskGroupView
          groupId={id}
          node={node}
          maskNode={mask ?? null}
          contentTree={
            <div className="relative h-full w-full">
              {contentIds.map((cid) => (
                <CanvasObject key={cid} id={cid} skipViewportCull={childSkipViewportCull} />
              ))}
            </div>
          }
          maskLayer={mask ? <CanvasObject id={node.maskId!} skipViewportCull={childSkipViewportCull} /> : null}
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
      const clipGroup = shouldClipChildren(node);
      body = (
        <div className="relative h-full w-full" style={{ overflow: "visible" }}>
          <div
            className="absolute inset-0"
            style={clipGroup ? clipContentContainerStyle(node) : { overflow: "visible" }}
          >
            {childrenTree}
          </div>
        </div>
      );
    }
  } else if (node.type === "frame") {
    const clipFrame = shouldClipChildren(node);
    const shell = (
      <div
        className="relative h-full w-full"
        style={{
          borderRadius: cornerRadiusCss,
          overflow: "visible",
        }}
      >
        {hideZeroDraft ? null : <ShapeVectorView node={node} nodeId={id} />}
        <div
          className="absolute inset-0"
          style={
            clipFrame
              ? clipContentContainerStyle(node, cornerRadiusCss)
              : { overflow: "visible", borderRadius: cornerRadiusCss }
          }
        >
          {childrenTree}
        </div>
      </div>
    );
    body = isRootFrame ? <Artboard>{shell}</Artboard> : shell;
  } else if (
    node.type === "ellipse" ||
    node.type === "rectangle" ||
    node.type === "line" ||
    node.type === "arrow" ||
    node.type === "polygon"
  ) {
    body = hideZeroDraft ? null : <ShapeVectorView node={node} nodeId={id} />;
  } else if (node.type === "path") {
    const pts = node.pathPoints ?? [];
    const singleSelected = selectedIds.length === 1 && selectedIds[0] === id;
    const showAnchors =
      editorMode === "design" &&
      (tool === "move" || tool === "pen") &&
      singleSelected &&
      pts.length > 0 &&
      pathEditModeNodeId !== id;
    const roundedRectPath = isRoundedRectPath(node);
    const selectedPt = pathPointForBezierHandleDisplay(pts, selectedPathPointIds, {
      roundedRect: roundedRectPath,
    });
    const showBezierHandles = selectedPt != null;
    body = (
      <>
        <ShapeVectorView node={node} nodeId={id} />
        {showAnchors ? (
          <div className="pointer-events-none absolute inset-0">
            <PathEditPathOutline node={node} nodeId={id} zoom={zoom} />
            {showBezierHandles && selectedPt ? (
              <>
                <svg
                  className="pointer-events-none absolute inset-0 overflow-visible"
                  width={node.width}
                  height={node.height}
                  aria-hidden
                >
                  {pathPointHandleAffordances(selectedPt, true).map(({ kind, vec }) => {
                    if (Math.hypot(vec.x, vec.y) < 1e-3) return null;
                    return (
                      <line
                        key={kind}
                        x1={selectedPt.x}
                        y1={selectedPt.y}
                        x2={selectedPt.x + vec.x}
                        y2={selectedPt.y + vec.y}
                        stroke={PATH_EDIT_HANDLE_LINE_STROKE}
                        strokeWidth={1}
                      />
                    );
                  })}
                </svg>
                {pathPointHandleAffordances(selectedPt, true).map(({ kind, vec, virtual }) => (
                  <button
                    key={kind}
                    type="button"
                    aria-label={kind === "handle-in" ? "Handle in" : "Handle out"}
                    className="pointer-events-auto absolute touch-none"
                    style={{
                      ...pathEditBezierHandleStyle(zoom),
                      left: selectedPt.x + vec.x,
                      top: selectedPt.y + vec.y,
                      opacity: virtual && Math.hypot(vec.x, vec.y) < 1e-3 ? 0.55 : 1,
                    }}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      togglePathPointSelection(selectedPt.id, ev.shiftKey);
                    }}
                  />
                ))}
              </>
            ) : null}
            {pts.map((pt) => {
              const selected = selectedPathPointIds.includes(pt.id);
              return (
              <button
                key={pt.id}
                type="button"
                aria-label="Anchor point"
                className="pointer-events-auto absolute touch-none"
                style={{
                  ...pathEditAnchorStyle(zoom, selected),
                  left: pt.x,
                  top: pt.y,
                }}
                onPointerDown={(ev) => onPathAnchorPointerDown(pt.id, ev)}
              />
            );
            })}
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
      <div className="flex h-full w-full items-center justify-center bg-slate-700 text-ui text-slate-300">
        Missing image
      </div>
    );
  }

  const radiusStyle = node.type === "frame" ? cornerRadiusCss : undefined;

  const tokenShadow = resolveEffectBoxShadow(node, designTokens);
  const hasRichEff = !!(node.effects && node.effects.length > 0);
  const tokenLeg = hasRichEff ? legacyEffectShadowAppend(node, designTokens) : tokenShadow;
  const er = buildNodeEffectRenderStyle(hasRichEff ? node.effects : undefined, tokenLeg);
  const dropF = firstVisibleDropShadowFilter(hasRichEff ? node.effects : undefined);
  const filterParts = [dropF, er.filter].filter(Boolean);
  const combinedFilter = filterParts.length ? filterParts.join(" ") : undefined;
  const combinedShadow = er.boxShadow || undefined;
  const glassBg =
    er.glassBackground && node.fillEnabled !== false
      ? er.glassBackground
      : undefined;
  const glassBorder = er.glassBorder;
  const effectOverlays = er.overlayLayers;
  const layerOpacity = node.opacity ?? 1;
  const imageAlpha = node.type === "image" ? layerOpacity * (node.fillOpacity ?? 1) : layerOpacity;
  const blendStyle = layerBlendCanvasStyle(node);
  /** Clip only on inner child layers; vector stroke/fill stays unclipped (Figma-like). */
  const clipOverflow =
    node.type === "frame" || node.type === "group" ? "visible" : shouldClipChildren(node) ? "hidden" : "visible";

  const isComponentMaster = Boolean(node.isComponent);
  const isComponentSetContainer = Boolean(node.isComponentSet);
  const isVariantInSet = isVariantMasterInComponentSet(nodes, id);
  const isComponentInstanceRoot =
    Boolean(node.sourceComponentId) && findInstanceRoot(nodes, id) === id;
  const isComponentFrame =
    isComponentMaster && (node.type === "frame" || node.type === "group");
  const componentMasterOutline = isComponentSetContainer
    ? "1px dashed rgba(139, 92, 246, 0.85)"
    : isComponentFrame && !isVariantInSet
    ? variantSetSize > 1
      ? "1px dashed rgba(139, 92, 246, 0.85)"
      : `1px solid ${CANVAS_VISUAL.component}`
    : isComponentFrame && isVariantInSet
      ? undefined
    : undefined;

  return (
    <div
      data-canvas-node={id}
      data-slot-hover={slotHoverTarget ? "true" : undefined}
      title={slotHoverTarget ? "Edit slot (double-click)" : undefined}
      className="absolute box-border select-none"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        pointerEvents: layerPointerEvents,
        borderRadius: radiusStyle,
        outline:
          componentMasterOutline ??
          (node.type === "group" &&
          !node.isBooleanGroup &&
          !node.maskId &&
          (node.layoutMode ?? "none") === "none"
            ? `1px dashed ${CANVAS_VISUAL.groupOutline}`
            : undefined),
        boxShadow: combinedShadow,
        filter: combinedFilter,
        backdropFilter: er.backdropFilter,
        cursor:
          editorMode === "inspect"
            ? "default"
            : slotHoverTarget
              ? "cell"
              : optionDown &&
                (tool === "move" || tool === "frame") &&
                selectedIds.includes(id) &&
                optionOverSelection
              ? "copy"
              : tool === "text"
                ? "text"
                : tool === "hand"
                  ? "grab"
                  : undefined,
        ...cssRotationStyle(node),
        opacity: slotShellLocked
          ? 0.35
          : imageAlpha < 0.999
            ? imageAlpha
            : undefined,
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        if (editorMode !== "design" || node.locked || !node.visible) return;

        const st0 = useEditorStore.getState();
        if (st0.pathEditModeNodeId && st0.pathEditModeNodeId !== id) {
          st0.setPathEditMode(null);
        }

        if (node.type === "text") {
          e.stopPropagation();
          const w = clientToWorld(e.clientX, e.clientY);
          enterTextEditModeAtWorldPoint(node.id, w.x, w.y);
          return;
        }

        const st = useEditorStore.getState();
        const w = clientToWorld(e.clientX, e.clientY);
        const slotDrill = slotDrillTargetForDoubleClick(
          id,
          w.x,
          w.y,
          st.nodes,
          st.childOrder,
          st.activeSlotEdit,
          (x, y) => pickDeepestNodeAtWorldPoint(x, y, st.nodes, st.childOrder),
        );
        if (slotDrill) {
          e.stopPropagation();
          const priorCrumbs = st.activeSlotEdit?.breadcrumb ?? [];
          if (st.activeSlotEdit) st.exitSlotEditMode(true);
          st.enterSlotEditMode(
            slotDrill.scope.instanceRootId,
            slotDrill.scope.propertyKey,
            priorCrumbs,
          );
          st.select(slotDrill.selectId);
          return;
        }

        const drill = drillTargetForDoubleClick(
          id,
          w.x,
          w.y,
          st.nodes,
          st.childOrder,
          st.objectEditModeNodeId,
          (x, y) => pickDeepestNodeAtWorldPoint(x, y, st.nodes, st.childOrder),
        );
        if (drill) {
          e.stopPropagation();
          st.enterObjectEditMode(drill.containerId);
          st.select(drill.selectId);
          return;
        }

        e.stopPropagation();
        if (shouldEnterPathEditOnEdit(node)) {
          if (st.pathEditModeNodeId === id) st.setPathEditMode(null);
          else st.setPathEditMode(id);
          return;
        }
        if (canEnterParametricShapeEdit(node)) {
          if (st.shapeEditModeNodeId === id) st.exitShapeEditMode();
          else st.enterShapeEditMode(id);
        }
      }}
      onPointerEnter={(e) => {
        if (!node.visible) return;
        if (interactionPreview.previewActive) {
          interactionPreview.onPreviewPointerEnter?.(e);
        }
        if (editorMode === "inspect") {
          setHoveredCanvasId(id);
          return;
        }
        if (!node.locked) setHoveredCanvasId(id);
      }}
      onPointerLeave={(e) => {
        if (interactionPreview.previewActive) {
          interactionPreview.onPreviewPointerLeave?.(e);
        }
        if (didPointerExitElement(e.currentTarget, e.relatedTarget)) {
          if (useEditorStore.getState().hoveredCanvasId === id) setHoveredCanvasId(null);
        }
      }}
      onPointerUp={(e) => {
        if (interactionPreview.previewActive) {
          interactionPreview.onPreviewPointerUp?.(e);
        }
      }}
      onContextMenu={(e) => {
        if (!node.visible) return;
        e.preventDefault();
        e.stopPropagation();
        const st = useEditorStore.getState();
        const targetId = selectionTargetForClick(
          id,
          st.nodes,
          st.childOrder,
          st.objectEditModeNodeId,
          isDeepSelectClick(e),
        );
        openContextMenu(targetId, e.clientX, e.clientY);
      }}
    >
      <div
        data-canvas-node-blend
        className="relative h-full w-full"
        style={{
          borderRadius: radiusStyle,
          overflow: clipOverflow,
          ...(glassBg ? { backgroundColor: glassBg } : {}),
          ...(glassBorder ? { border: glassBorder, boxSizing: "border-box" as const } : {}),
          ...blendStyle,
        }}
      >
        {body}
        {(isComponentMaster || isComponentInstanceRoot) && !isVariantInSet ? (
          <ComponentCanvasMarker nodeId={id} />
        ) : null}
        {effectOverlays?.length ? <EffectOverlays layers={effectOverlays} /> : null}
      </div>
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
