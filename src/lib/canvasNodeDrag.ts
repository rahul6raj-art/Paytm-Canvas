import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { canSwapAutoLayoutSiblings } from "@/lib/autoLayoutArrowReorder";
import { idsToDetachForAutoLayoutDrag } from "@/lib/autoLayoutDrag";
import {
  computeAutoLayoutInsertIndicator,
  editorNodesToLayoutMap,
  flowInsertIndexFromPointer,
  flowInsertIndexToChildOrderIndex,
  getAutoLayoutReorderContext,
  resolveAutoLayoutDropTarget,
  type AutoLayoutReorderContext,
} from "@/lib/autoLayoutReorder";
import { isAutoLayoutHandleDragActive } from "@/lib/autoLayout/spacingPaddingDrag";
import { screenDeltaToWorld } from "@/lib/canvasCoordinates";
import {
  computeDragSmartGuides,
  proposedBoundsForMoving,
  type WorldRect,
} from "@/lib/dragSmartGuides";
import { getNodeTransformedWorldBounds } from "@/lib/transformMath";
import {
  getRenderedWorldBounds,
  isAncestorOf,
  worldOriginToNodeXYFromChildOrder,
  worldPointToParentLocalFromChildOrder,
} from "@/lib/editorGraph";
import {
  captureSwapWorldOrigins,
  findSwapTargetAtPoint,
  resolveSwapDropTarget,
  swapNodeWorldPositions,
  swapPartnerForMultiSelect,
} from "@/lib/canvasSwapDrag";
import { pickDeepestFrameAtWorldPoint } from "@/lib/tree";
import {
  createRafPointerScheduler,
  forEachCoalescedPointerEvent,
  type RafPointerScheduler,
} from "@/lib/smoothPointer";

export type ClientToWorldFn = (clientX: number, clientY: number) => { x: number; y: number };

function pointInWorldRect(
  px: number,
  py: number,
  r: { x: number; y: number; width: number; height: number },
): boolean {
  return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
}

type DragSession = {
  pointerId: number;
  sx: number;
  sy: number;
  primaryId: string;
  movingIds: string[];
  startWorld: Record<string, { x: number; y: number }>;
  startBounds: Record<string, WorldRect>;
  swapPartnerId?: string;
  swapTargetId?: string | null;
  mode: "free" | "al-reorder";
  alContext?: AutoLayoutReorderContext;
  lastAlInsert?: number;
};

let activeDrag: DragSession | null = null;
let activeMoveScheduler: RafPointerScheduler<{ clientX: number; clientY: number }> | null =
  null;

function detachAutoLayoutChildrenForDrag(movingIds: string[], nodes: Record<string, EditorNode>): void {
  const toDetach = idsToDetachForAutoLayoutDrag(movingIds, nodes, nodes);
  const { updateNode } = useEditorStore.getState();
  for (const id of toDetach) {
    updateNode(id, { layoutPositioning: "absolute", layoutDirty: true }, { skipHistory: true });
  }
}

function convertAlReorderToFreeDrag(d: DragSession): void {
  if (!d.alContext) return;
  detachAutoLayoutChildrenForDrag(d.movingIds, useEditorStore.getState().nodes);
  const st = useEditorStore.getState();
  d.mode = "free";
  d.alContext = undefined;
  d.lastAlInsert = undefined;
  st.setAutoLayoutReorderIndicator(null);
  d.startWorld = captureSwapWorldOrigins(
    d.swapPartnerId ? [d.primaryId, d.swapPartnerId] : d.movingIds,
    st.nodes,
    st.childOrder,
  );
  for (const sid of d.movingIds) {
    d.startBounds[sid] = getRenderedWorldBounds(sid, st.nodes, st.childOrder);
  }
}

/** Begin dragging the current selection from a node pointer-down (move/frame tools). */
export function beginCanvasNodeDrag(opts: {
  nodeId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
  if (useEditorStore.getState().transformInteractionMode !== "none") return false;
  if (isAutoLayoutHandleDragActive()) return false;

  const s1 = useEditorStore.getState();
  const dragTargets = s1.selectedIds.filter((sid) => {
    const n = s1.nodes[sid];
    return n && !n.locked && n.visible;
  });
  if (dragTargets.length === 0) return false;

  s1.pushHistory();
  document.body.style.cursor = "move";

  const primaryId = dragTargets.includes(opts.nodeId) ? opts.nodeId : dragTargets[0]!;
  const swapPartnerId = swapPartnerForMultiSelect(opts.nodeId, s1.selectedIds, s1.nodes);
  const movingIds =
    swapPartnerId && dragTargets.includes(opts.nodeId) ? [opts.nodeId] : dragTargets;

  const dragNode = s1.nodes[opts.nodeId];
  const dragContainerUnit =
    dragNode?.type === "frame" || dragNode?.type === "group";
  const alContext =
    swapPartnerId || dragContainerUnit
      ? null
      : getAutoLayoutReorderContext([opts.nodeId], s1.nodes, s1.nodes);

  const dragMovingIds = alContext ? [opts.nodeId] : movingIds;

  if (!alContext) {
    detachAutoLayoutChildrenForDrag(dragMovingIds, s1.nodes);
  }

  const st = useEditorStore.getState();
  const startWorld = captureSwapWorldOrigins(
    swapPartnerId ? [primaryId, swapPartnerId] : dragMovingIds,
    st.nodes,
    st.childOrder,
  );
  const startBounds: Record<string, WorldRect> = {};
  for (const sid of dragMovingIds) {
    startBounds[sid] = getRenderedWorldBounds(sid, st.nodes, st.childOrder);
  }
  if (swapPartnerId) {
    startBounds[swapPartnerId] = getRenderedWorldBounds(swapPartnerId, st.nodes, st.childOrder);
  }

  activeDrag = {
    pointerId: opts.pointerId,
    sx: opts.clientX,
    sy: opts.clientY,
    primaryId: alContext ? opts.nodeId : primaryId,
    movingIds: dragMovingIds,
    startWorld,
    startBounds,
    swapPartnerId,
    swapTargetId: null,
    mode: alContext ? "al-reorder" : "free",
    alContext: alContext ?? undefined,
  };
  useEditorStore.getState().setIsMovingSelection(true);
  useEditorStore.getState().setSwapDragIndicator(null);
  useEditorStore.getState().setAutoLayoutReorderIndicator(null);

  try {
    opts.captureTarget.setPointerCapture(opts.pointerId);
  } catch {
    /* ignore */
  }

  const applyMove = (clientX: number, clientY: number) => {
    const d = activeDrag;
    if (!d) return;
    const state = useEditorStore.getState();
    const { updateNode, setSnapOverlay, reorderNode } = state;

    const world = opts.clientToWorld(clientX, clientY);

    if (d.mode === "al-reorder" && d.alContext) {
      const parent = state.nodes[d.alContext.parentId];
      const parentBounds = parent
        ? getRenderedWorldBounds(d.alContext.parentId, state.nodes, state.childOrder)
        : null;
      const insideParent =
        parentBounds &&
        world.x >= parentBounds.x &&
        world.x <= parentBounds.x + parentBounds.width &&
        world.y >= parentBounds.y &&
        world.y <= parentBounds.y + parentBounds.height;
      if (!insideParent) {
        convertAlReorderToFreeDrag(d);
      } else {
        const local = worldPointToParentLocalFromChildOrder(
          world.x,
          world.y,
          d.alContext.parentId,
          state.nodes,
          state.childOrder,
        );
        const layoutMap = editorNodesToLayoutMap(state.nodes);
        const flowInsert = flowInsertIndexFromPointer(
          d.alContext.parentId,
          layoutMap,
          state.childOrder,
          local.x,
          local.y,
          d.alContext.draggedId,
        );
        const idx = flowInsertIndexToChildOrderIndex(
          d.alContext.parentId,
          flowInsert,
          layoutMap,
          state.childOrder,
          d.alContext.mode,
          d.alContext.draggedId,
        );
        if (idx !== d.lastAlInsert) {
          d.lastAlInsert = idx;
          reorderNode(d.alContext.draggedId, d.alContext.parentId, idx);
        }
        const indicator = computeAutoLayoutInsertIndicator(
          d.alContext.parentId,
          flowInsert,
          d.alContext.draggedId,
          state.nodes,
          state.childOrder,
        );
        state.setAutoLayoutReorderIndicator(indicator);
        state.setGuides([]);
        return;
      }
    }

    const z = state.zoom;
    const fdx = screenDeltaToWorld(clientX - d.sx, z);
    const fdy = screenDeltaToWorld(clientY - d.sy, z);

    const swapTarget = findSwapTargetAtPoint(
      d.primaryId,
      world.x,
      world.y,
      state.nodes,
      state.childOrder,
      d.swapPartnerId,
    );
    if (swapTarget !== d.swapTargetId) {
      d.swapTargetId = swapTarget;
      if (
        swapTarget &&
        d.startWorld[d.primaryId] &&
        d.startWorld[swapTarget]
      ) {
        state.setSwapDragIndicator({
          sourceId: d.primaryId,
          targetId: swapTarget,
          sourceOrigin: d.startWorld[d.primaryId]!,
          targetOrigin: d.startWorld[swapTarget]!,
        });
      } else {
        state.setSwapDragIndicator(null);
      }
    }

    if (!swapTarget) {
      const alDrop = resolveAutoLayoutDropTarget(
        world.x,
        world.y,
        state.nodes,
        state.childOrder,
        d.primaryId,
        d.primaryId,
      );
      if (alDrop) {
        const indicator = computeAutoLayoutInsertIndicator(
          alDrop.parentId,
          alDrop.flowInsertIndex,
          d.primaryId,
          state.nodes,
          state.childOrder,
        );
        state.setAutoLayoutReorderIndicator(indicator);
      } else {
        state.setAutoLayoutReorderIndicator(null);
      }
    } else {
      state.setAutoLayoutReorderIndicator(null);
    }

    const snap =
      swapTarget != null
        ? { guides: [] as typeof state.guides, measurements: [], dx: 0, dy: 0 }
        : computeDragSmartGuides(
            d.movingIds,
            proposedBoundsForMoving(d.movingIds, d.startBounds, fdx, fdy),
            state.nodes,
            z,
          );
    setSnapOverlay(snap.guides, snap.measurements);

    const fdx2 = fdx + snap.dx;
    const fdy2 = fdy + snap.dy;

    if (Math.abs(fdx2) < 1e-9 && Math.abs(fdy2) < 1e-9) return;

    for (const sid of d.movingIds) {
      const sw = d.startWorld[sid]!;
      const desired = { x: sw.x + fdx2, y: sw.y + fdy2 };
      const xy = worldOriginToNodeXYFromChildOrder(sid, state.nodes, state.childOrder, desired);
      updateNode(sid, { x: xy.x, y: xy.y }, { skipHistory: true });
    }
  };

  const moveScheduler = createRafPointerScheduler<{ clientX: number; clientY: number }>(
    ({ clientX, clientY }) => applyMove(clientX, clientY),
  );
  activeMoveScheduler = moveScheduler;

  const onMove = (ev: PointerEvent) => {
    const d = activeDrag;
    if (!d || ev.pointerId !== d.pointerId) return;
    forEachCoalescedPointerEvent(ev, (pe) => {
      moveScheduler.schedule({ clientX: pe.clientX, clientY: pe.clientY });
    });
  };

  const onUp = (ev: PointerEvent) => {
    const d = activeDrag;
    if (!d || ev.pointerId !== d.pointerId) return;
    forEachCoalescedPointerEvent(ev, (pe) => {
      moveScheduler.schedule({ clientX: pe.clientX, clientY: pe.clientY });
    });
    moveScheduler.flush();
    moveScheduler.cancel();
    activeMoveScheduler = null;
    activeDrag = null;
    document.body.style.cursor = "";
    const stEnd = useEditorStore.getState();
    stEnd.setIsMovingSelection(false);
    stEnd.setGuides([]);
    stEnd.setSwapDragIndicator(null);
    stEnd.setAutoLayoutReorderIndicator(null);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);

    const st = useEditorStore.getState();
    if (st.editorMode === "prototype") return;
    const primary = st.nodes[d.primaryId];
    if (!primary) return;

    const world = opts.clientToWorld(ev.clientX, ev.clientY);
    const swapDropId = resolveSwapDropTarget(
      d.primaryId,
      d.swapPartnerId,
      d.swapTargetId,
      world.x,
      world.y,
      st.nodes,
      st.childOrder,
    );
    if (swapDropId && d.startWorld[d.primaryId] && d.startWorld[swapDropId]) {
      if (canSwapAutoLayoutSiblings(d.primaryId, swapDropId, st.nodes)) {
        st.swapAutoLayoutSiblings(d.primaryId, swapDropId, { skipHistory: true });
        return;
      }
      const swapped = swapNodeWorldPositions(
        d.primaryId,
        swapDropId,
        d.startWorld[d.primaryId]!,
        d.startWorld[swapDropId]!,
        st.nodes,
        st.childOrder,
      );
      st.updateNode(d.primaryId, { x: swapped.nodes[d.primaryId]!.x, y: swapped.nodes[d.primaryId]!.y }, {
        skipHistory: true,
      });
      st.updateNode(
        swapDropId,
        { x: swapped.nodes[swapDropId]!.x, y: swapped.nodes[swapDropId]!.y },
        { skipHistory: true },
      );
      return;
    }

    const alDrop = resolveAutoLayoutDropTarget(
      world.x,
      world.y,
      st.nodes,
      st.childOrder,
      d.primaryId,
      d.primaryId,
    );
    if (alDrop) {
      const idsToMove = d.movingIds.filter((id) => {
        const n = st.nodes[id];
        return (
          n &&
          !n.locked &&
          id !== alDrop.parentId &&
          !isAncestorOf(st.nodes, id, alDrop.parentId)
        );
      });
      if (idsToMove.length > 0) {
        let insertAt = alDrop.insertIndex;
        for (const id of idsToMove) {
          st.moveNodeToParent(id, alDrop.parentId, insertAt);
          insertAt += 1;
        }
        return;
      }
    }

    const frameHit = pickDeepestFrameAtWorldPoint(world.x, world.y, st.nodes, st.childOrder, {
      excludeDescendantsOf: d.primaryId,
    });
    if (
      frameHit &&
      frameHit !== d.primaryId &&
      !isAncestorOf(st.nodes, d.primaryId, frameHit) &&
      primary.parentId !== frameHit
    ) {
      const list = [...(st.childOrder[frameHit] ?? [])].filter((x) => x !== d.primaryId);
      st.moveNodeToParent(d.primaryId, frameHit, list.length);
      return;
    }
    if (primary.parentId) {
      const parent = st.nodes[primary.parentId];
      const parentBounds =
        parent && (parent.type === "frame" || parent.type === "group")
          ? getNodeTransformedWorldBounds(primary.parentId, st.nodes)
          : null;
      const stillOverParent = parentBounds && pointInWorldRect(world.x, world.y, parentBounds);
      if (!stillOverParent && !frameHit) {
        const roots = (st.childOrder[ROOT] ?? []).filter((x) => x !== d.primaryId);
        st.moveNodeToParent(d.primaryId, ROOT, roots.length);
      }
    }
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  return true;
}

export function cancelCanvasNodeDrag(): void {
  activeMoveScheduler?.cancel();
  activeMoveScheduler = null;
  activeDrag = null;
  document.body.style.cursor = "";
  const st = useEditorStore.getState();
  st.setIsMovingSelection(false);
  st.setGuides([]);
  st.setSwapDragIndicator(null);
  st.setAutoLayoutReorderIndicator(null);
}
