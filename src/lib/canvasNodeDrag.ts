import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { idsToDetachForAutoLayoutDrag } from "@/lib/autoLayoutDrag";
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
  /** Other selected layer when dragging one of two (Figma swap). */
  swapPartnerId?: string;
  swapTargetId?: string | null;
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

/** Begin dragging the current selection from a node pointer-down (move/frame tools). */
export function beginCanvasNodeDrag(opts: {
  nodeId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
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

  detachAutoLayoutChildrenForDrag(movingIds, s1.nodes);

  const st = useEditorStore.getState();
  const startWorld = captureSwapWorldOrigins(
    swapPartnerId ? [primaryId, swapPartnerId] : movingIds,
    st.nodes,
    st.childOrder,
  );
  const startBounds: Record<string, WorldRect> = {};
  for (const sid of movingIds) {
    startBounds[sid] = getRenderedWorldBounds(sid, st.nodes, st.childOrder);
  }
  if (swapPartnerId) {
    startBounds[swapPartnerId] = getRenderedWorldBounds(swapPartnerId, st.nodes, st.childOrder);
  }

  activeDrag = {
    pointerId: opts.pointerId,
    sx: opts.clientX,
    sy: opts.clientY,
    primaryId,
    movingIds,
    startWorld,
    startBounds,
    swapPartnerId,
    swapTargetId: null,
  };
  useEditorStore.getState().setSwapDragIndicator(null);

  try {
    opts.captureTarget.setPointerCapture(opts.pointerId);
  } catch {
    /* ignore */
  }

  const applyMove = (clientX: number, clientY: number) => {
    const d = activeDrag;
    if (!d) return;
    const state = useEditorStore.getState();
    const { updateNode, setSnapOverlay } = state;

    const z = state.zoom;
    const fdx = screenDeltaToWorld(clientX - d.sx, z);
    const fdy = screenDeltaToWorld(clientY - d.sy, z);

    const world = opts.clientToWorld(clientX, clientY);
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
    stEnd.setGuides([]);
    stEnd.setSwapDragIndicator(null);
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
  st.setGuides([]);
  st.setSwapDragIndicator(null);
}
