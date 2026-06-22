import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { applyLayoutPatchWithAutoLayout } from "@/lib/autoLayout";
import { canSwapAutoLayoutSiblings } from "@/lib/autoLayoutArrowReorder";
import { idsToDetachForAutoLayoutDrag } from "@/lib/autoLayoutDrag";
import { freezeAutoLayoutGap } from "@/lib/layoutEngine/inferGap";
import { isAutoLayoutContainer, type LayoutEngineNode } from "@/lib/layoutEngine/types";
import { CANVAS_CLICK_SLOP_SCREEN_PX } from "@/lib/canvasInteractionGuards";
import { screenPxToWorld } from "@/lib/canvasVisual";
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
import { isSelectionSpacingDragActive } from "@/lib/selectionSpacingDragSession";
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
  swapCandidatesForMultiSelect,
  swapNodeWorldPositions,
} from "@/lib/canvasSwapDrag";
import { pickDeepestFrameAtWorldPoint } from "@/lib/tree";
import { createRafPointerScheduler, forEachCoalescedPointerEvent } from "@/lib/smoothPointer";
import { commitWasmFirstGeometryPatches } from "@/engine/craftEngineWasmFirstMutation";
import {
  applyDragPreview,
  clearDragPreview,
} from "@/lib/canvasEphemeralTransform";
import { refreshDuplicateStepAfterMove } from "@/lib/duplicateRepeatOffset";

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
  swapCandidateIds?: string[];
  swapTargetId?: string | null;
  mode: "free" | "al-reorder";
  alContext?: AutoLayoutReorderContext;
  lastAlInsert?: number;
  lastPreviewDelta: { dx: number; dy: number };
  activated: boolean;
  clientToWorld: ClientToWorldFn;
  /** Option/Alt drag duplicate — do not learn Cmd+D repeat offset from this move. */
  skipDuplicateStepRefresh?: boolean;
};

let activeDrag: DragSession | null = null;

function resolveAlReorderChildOrderIndex(
  ctx: AutoLayoutReorderContext,
  clientX: number,
  clientY: number,
  clientToWorld: ClientToWorldFn,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): number {
  const world = clientToWorld(clientX, clientY);
  const local = worldPointToParentLocalFromChildOrder(
    world.x,
    world.y,
    ctx.parentId,
    nodes,
    childOrder,
  );
  const layoutMap = editorNodesToLayoutMap(nodes);
  const flowInsert = flowInsertIndexFromPointer(
    ctx.parentId,
    layoutMap,
    childOrder,
    local.x,
    local.y,
    ctx.draggedId,
  );
  return flowInsertIndexToChildOrderIndex(
    ctx.parentId,
    flowInsert,
    layoutMap,
    childOrder,
    ctx.mode,
    ctx.draggedId,
  );
}

function freezeAutoLayoutParentGapsForDrag(
  movingIds: readonly string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, EditorNode> {
  const parents = new Set<string>();
  for (const id of movingIds) {
    const parentId = nodes[id]?.parentId;
    if (!parentId) continue;
    const parent = nodes[parentId];
    if (parent && isAutoLayoutContainer(parent as LayoutEngineNode)) {
      parents.add(parentId);
    }
  }
  if (parents.size === 0) return nodes;
  let next = nodes;
  for (const parentId of parents) {
    const patch = freezeAutoLayoutGap(
      next[parentId] as LayoutEngineNode,
      next as Record<string, LayoutEngineNode>,
      childOrder,
    );
    if (patch) {
      next = applyLayoutPatchWithAutoLayout(next, childOrder, parentId, patch) as Record<
        string,
        EditorNode
      >;
    }
  }
  return next;
}

function detachAutoLayoutChildrenForDrag(movingIds: string[], nodes: Record<string, EditorNode>): void {
  const toDetach = idsToDetachForAutoLayoutDrag(movingIds, nodes, nodes);
  const { updateNode } = useEditorStore.getState();
  for (const id of toDetach) {
    updateNode(id, { layoutPositioning: "absolute", layoutDirty: true }, { skipHistory: true });
  }
}

function clickSlopWorld(zoom: number): number {
  return screenPxToWorld(CANVAS_CLICK_SLOP_SCREEN_PX, zoom);
}

function swapCaptureIds(
  primaryId: string,
  movingIds: string[],
  swapCandidateIds?: string[],
): string[] {
  if (swapCandidateIds?.length) {
    return Array.from(new Set([primaryId, ...swapCandidateIds]));
  }
  return movingIds;
}

function activateNodeDrag(d: DragSession): void {
  if (d.activated) return;
  d.activated = true;
  const st = useEditorStore.getState();
  st.pushHistory();

  if (!d.alContext) {
    const frozen = freezeAutoLayoutParentGapsForDrag(d.movingIds, st.nodes, st.childOrder);
    if (frozen !== st.nodes) {
      useEditorStore.setState({ nodes: frozen });
    }
    detachAutoLayoutChildrenForDrag(d.movingIds, useEditorStore.getState().nodes);
    const st2 = useEditorStore.getState();
    d.startWorld = captureSwapWorldOrigins(
      swapCaptureIds(d.primaryId, d.movingIds, d.swapCandidateIds),
      st2.nodes,
      st2.childOrder,
    );
    for (const sid of d.movingIds) {
      d.startBounds[sid] = getRenderedWorldBounds(sid, st2.nodes, st2.childOrder);
    }
    for (const cid of d.swapCandidateIds ?? []) {
      d.startBounds[cid] = getRenderedWorldBounds(cid, st2.nodes, st2.childOrder);
    }
  } else if (d.alContext) {
    const st2 = useEditorStore.getState();
    d.lastAlInsert = resolveAlReorderChildOrderIndex(
      d.alContext,
      d.sx,
      d.sy,
      d.clientToWorld,
      st2.nodes,
      st2.childOrder,
    );
  }

  st.setIsMovingSelection(true);
  document.body.style.cursor = "move";
}

function commitDragPositions(d: DragSession): boolean {
  const { dx, dy } = d.lastPreviewDelta;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return false;
  const state = useEditorStore.getState();
  const updates: Array<{ nodeId: string; node: (typeof state.nodes)[string] }> = [];
  for (const sid of d.movingIds) {
    const sw = d.startWorld[sid];
    const n = state.nodes[sid];
    if (!sw || !n) continue;
    const desired = { x: sw.x + dx, y: sw.y + dy };
    const xy = worldOriginToNodeXYFromChildOrder(sid, state.nodes, state.childOrder, desired);
    updates.push({ nodeId: sid, node: { ...n, x: xy.x, y: xy.y } });
  }
  if (updates.length === 0) return false;
  if (commitWasmFirstGeometryPatches(updates)) return true;
  for (const { nodeId, node } of updates) {
    state.updateNode(nodeId, { x: node.x, y: node.y }, { skipHistory: true });
  }
  return true;
}

function refreshDuplicateStepAfterDragCommit(): void {
  const st = useEditorStore.getState();
  refreshDuplicateStepAfterMove(st.selectedIds, st.nodes, st.childOrder);
}

function convertAlReorderToFreeDrag(d: DragSession): void {
  if (!d.alContext) return;
  clearDragPreview();
  d.lastPreviewDelta = { dx: 0, dy: 0 };
  detachAutoLayoutChildrenForDrag(d.movingIds, useEditorStore.getState().nodes);
  const st = useEditorStore.getState();
  d.mode = "free";
  d.alContext = undefined;
  d.lastAlInsert = undefined;
  st.setAutoLayoutReorderIndicator(null);
  d.startWorld = captureSwapWorldOrigins(
    swapCaptureIds(d.primaryId, d.movingIds, d.swapCandidateIds),
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
  forceSwapDrag?: boolean;
  /** Set when the drag follows Option/Alt in-place clone (not Cmd+D repeat). */
  fromAltDragDuplicate?: boolean;
}): boolean {
  if (useEditorStore.getState().transformInteractionMode !== "none") return false;
  if (isAutoLayoutHandleDragActive()) return false;
  if (isSelectionSpacingDragActive()) return false;

  const s1 = useEditorStore.getState();
  const dragTargets = s1.selectedIds.filter((sid) => {
    const n = s1.nodes[sid];
    return n && !n.locked && n.visible;
  });
  if (dragTargets.length === 0) return false;

  const swapCandidates = swapCandidatesForMultiSelect(
    opts.nodeId,
    s1.selectedIds,
    s1.nodes,
    s1.childOrder,
  );
  const swapMode = opts.forceSwapDrag === true && swapCandidates.length > 0;

  if (opts.forceSwapDrag && swapCandidates.length === 0) return false;

  const primaryId = dragTargets.includes(opts.nodeId) ? opts.nodeId : dragTargets[0]!;
  const movingIds = swapMode ? [opts.nodeId] : dragTargets;

  const dragNode = s1.nodes[opts.nodeId];
  const dragContainerUnit =
    dragNode?.type === "frame" || dragNode?.type === "group";
  // Multi-select always moves the whole selection; in-flow reorder is single-layer only.
  const alContext =
    swapMode || dragContainerUnit || dragTargets.length > 1
      ? null
      : getAutoLayoutReorderContext([opts.nodeId], s1.nodes, s1.nodes);

  const dragMovingIds = alContext ? [opts.nodeId] : movingIds;
  const swapCandidateIds = swapMode ? swapCandidates : undefined;

  const st = useEditorStore.getState();
  const startWorld = captureSwapWorldOrigins(
    swapCaptureIds(primaryId, dragMovingIds, swapCandidateIds),
    st.nodes,
    st.childOrder,
  );
  const startBounds: Record<string, WorldRect> = {};
  for (const sid of dragMovingIds) {
    startBounds[sid] = getRenderedWorldBounds(sid, st.nodes, st.childOrder);
  }
  for (const cid of swapCandidateIds ?? []) {
    startBounds[cid] = getRenderedWorldBounds(cid, st.nodes, st.childOrder);
  }

  activeDrag = {
    pointerId: opts.pointerId,
    sx: opts.clientX,
    sy: opts.clientY,
    primaryId: alContext ? opts.nodeId : primaryId,
    movingIds: dragMovingIds,
    startWorld,
    startBounds,
    swapCandidateIds,
    swapTargetId: null,
    mode: alContext ? "al-reorder" : "free",
    alContext: alContext ?? undefined,
    lastPreviewDelta: { dx: 0, dy: 0 },
    activated: false,
    clientToWorld: opts.clientToWorld,
    skipDuplicateStepRefresh: opts.fromAltDragDuplicate === true,
  };
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
    const { setSnapOverlay, reorderNode } = state;

    if (!d.activated) {
      const fdx = screenDeltaToWorld(clientX - d.sx, state.zoom);
      const fdy = screenDeltaToWorld(clientY - d.sy, state.zoom);
      if (Math.hypot(fdx, fdy) < clickSlopWorld(state.zoom)) return;
      activateNodeDrag(d);
    }

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
        if (d.lastAlInsert !== undefined && idx !== d.lastAlInsert) {
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
      d.swapCandidateIds,
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

    d.lastPreviewDelta = { dx: fdx2, dy: fdy2 };
    applyDragPreview(d.movingIds, fdx2, fdy2);
  };

  const moveScheduler = createRafPointerScheduler<{ clientX: number; clientY: number }>(
    ({ clientX, clientY }) => applyMove(clientX, clientY),
  );

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
    const session = d;
    activeDrag = null;
    document.body.style.cursor = "";
    if (!session.activated) {
      clearDragPreview();
      const stEnd = useEditorStore.getState();
      stEnd.setIsMovingSelection(false);
      stEnd.setGuides([]);
      stEnd.setSwapDragIndicator(null);
      stEnd.setAutoLayoutReorderIndicator(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      return;
    }
    let committedFreeDrag = false;
    if (session.mode === "free") {
      committedFreeDrag = commitDragPositions(session);
    }
    clearDragPreview();
    const stEnd = useEditorStore.getState();
    stEnd.setIsMovingSelection(false);
    if (committedFreeDrag && !session.skipDuplicateStepRefresh) {
      refreshDuplicateStepAfterDragCommit();
    }
    stEnd.setGuides([]);
    stEnd.setSwapDragIndicator(null);
    stEnd.setAutoLayoutReorderIndicator(null);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);

    const st = useEditorStore.getState();
    if (st.editorMode === "prototype") return;
    const primary = st.nodes[session.primaryId];
    if (!primary) return;

    const world = opts.clientToWorld(ev.clientX, ev.clientY);
    const swapDropId = resolveSwapDropTarget(
      session.primaryId,
      session.swapCandidateIds,
      session.swapTargetId,
      world.x,
      world.y,
      st.nodes,
      st.childOrder,
    );
    if (swapDropId && session.startWorld[session.primaryId] && session.startWorld[swapDropId]) {
      if (canSwapAutoLayoutSiblings(session.primaryId, swapDropId, st.nodes)) {
        st.swapAutoLayoutSiblings(session.primaryId, swapDropId, { skipHistory: true });
        return;
      }
      const swapped = swapNodeWorldPositions(
        session.primaryId,
        swapDropId,
        session.startWorld[session.primaryId]!,
        session.startWorld[swapDropId]!,
        st.nodes,
        st.childOrder,
      );
      st.updateNode(session.primaryId, { x: swapped.nodes[session.primaryId]!.x, y: swapped.nodes[session.primaryId]!.y }, {
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
      session.primaryId,
      session.primaryId,
    );
    if (alDrop) {
      const idsToMove = session.movingIds.filter((id) => {
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
      excludeDescendantsOf: session.primaryId,
    });
    if (
      frameHit &&
      frameHit !== session.primaryId &&
      !isAncestorOf(st.nodes, session.primaryId, frameHit) &&
      primary.parentId !== frameHit
    ) {
      const list = [...(st.childOrder[frameHit] ?? [])].filter((x) => x !== session.primaryId);
      st.moveNodeToParent(session.primaryId, frameHit, list.length);
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
        const roots = (st.childOrder[ROOT] ?? []).filter((x) => x !== session.primaryId);
        st.moveNodeToParent(session.primaryId, ROOT, roots.length);
      }
    }
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  return true;
}

/** Begin a swap-only drag from a multi-select pink center handle. */
export function beginCanvasSwapHandleDrag(opts: {
  nodeId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
  return beginCanvasNodeDrag({ ...opts, forceSwapDrag: true });
}

export function cancelCanvasNodeDrag(): void {
  clearDragPreview();
  activeDrag = null;
  document.body.style.cursor = "";
  const st = useEditorStore.getState();
  st.setIsMovingSelection(false);
  st.setGuides([]);
  st.setSwapDragIndicator(null);
  st.setAutoLayoutReorderIndicator(null);
}
