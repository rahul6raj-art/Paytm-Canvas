import { cancelCanvasMarqueeSession } from "@/lib/canvasMarqueeSession";
import { cancelCanvasNodeDrag } from "@/lib/canvasNodeDrag";
import { CANVAS_CLICK_SLOP_SCREEN_PX } from "@/lib/canvasInteractionGuards";
import { screenDeltaToWorld } from "@/lib/canvasCoordinates";
import { screenPxToWorld } from "@/lib/canvasVisual";
import {
  detachForManualPositionInAutoLayout,
  moveNodesByWorldDelta,
  syncInstancePositionOverrides,
} from "@/lib/alignSelection";
import { getRenderedWorldBounds } from "@/lib/editorGraph";
import { forEachCoalescedPointerEvent } from "@/lib/smoothPointer";
import { useEditorStore } from "@/stores/useEditorStore";
import type { SelectionSpacingHandle } from "@/lib/selectionSpacingHandles";
import { idsMovedBySelectionGapDrag } from "@/lib/selectionSpacingHandles";
import {
  isSelectionSpacingDragActive,
  setSelectionSpacingDragActive,
} from "@/lib/selectionSpacingDragSession";
import { mirrorWasmFromStore } from "@/engine/craftEngineAuthorityStructure";
import { isAutoLayoutHandleDragActive } from "@/lib/autoLayout/spacingPaddingDrag";

export type SelectionSpacingDragPreview = {
  axis: "horizontal" | "vertical";
  beforeId: string;
  afterId: string;
  gap: number;
  label: string;
  worldX: number;
  worldY: number;
} | null;

let livePreview: SelectionSpacingDragPreview = null;
const previewListeners = new Set<() => void>();

function notifyPreview(): void {
  for (const fn of previewListeners) fn();
}

export function subscribeSelectionSpacingDragPreview(onStoreChange: () => void): () => void {
  previewListeners.add(onStoreChange);
  return () => previewListeners.delete(onStoreChange);
}

export function getSelectionSpacingDragPreview(): SelectionSpacingDragPreview {
  return livePreview;
}

function setPreview(preview: SelectionSpacingDragPreview): void {
  livePreview = preview;
  notifyPreview();
}

type DragSession = {
  pointerId: number;
  handle: SelectionSpacingHandle;
  startClientX: number;
  startClientY: number;
  startGap: number;
  activated: boolean;
  appliedWorldDelta: number;
  movingIds: string[];
};

let activeDrag: DragSession | null = null;

function measureGapBetweenNodes(
  beforeId: string,
  afterId: string,
  axis: "horizontal" | "vertical",
  nodes: ReturnType<typeof useEditorStore.getState>["nodes"],
  childOrder: ReturnType<typeof useEditorStore.getState>["childOrder"],
): number {
  const before = getRenderedWorldBounds(beforeId, nodes, childOrder);
  const after = getRenderedWorldBounds(afterId, nodes, childOrder);
  if (axis === "horizontal") {
    return after.x - (before.x + before.width);
  }
  return after.y - (before.y + before.height);
}

function gapMidpointWorld(
  beforeId: string,
  afterId: string,
  axis: "horizontal" | "vertical",
  nodes: ReturnType<typeof useEditorStore.getState>["nodes"],
  childOrder: ReturnType<typeof useEditorStore.getState>["childOrder"],
): { x: number; y: number } {
  const before = getRenderedWorldBounds(beforeId, nodes, childOrder);
  const after = getRenderedWorldBounds(afterId, nodes, childOrder);
  if (axis === "horizontal") {
    const y =
      (Math.max(before.y, after.y) +
        Math.min(before.y + before.height, after.y + after.height)) /
      2;
    return { x: (before.x + before.width + after.x) / 2, y };
  }
  const x =
    (Math.max(before.x, after.x) +
      Math.min(before.x + before.width, after.x + after.width)) /
    2;
  return { x, y: (before.y + before.height + after.y) / 2 };
}

function activateDrag(session: DragSession): void {
  session.activated = true;
  const st = useEditorStore.getState();
  st.pushHistory();
  useEditorStore.setState((s) => ({
    nodes: detachForManualPositionInAutoLayout(s.nodes, s.childOrder, session.movingIds),
  }));
  document.body.style.cursor = session.handle.axis === "horizontal" ? "ew-resize" : "ns-resize";
}

function applyDrag(session: DragSession, clientX: number, clientY: number): void {
  const st = useEditorStore.getState();
  const slop = screenPxToWorld(CANVAS_CLICK_SLOP_SCREEN_PX, st.zoom);

  if (!session.activated) {
    const probe =
      session.handle.axis === "horizontal"
        ? Math.abs(screenDeltaToWorld(clientX - session.startClientX, st.zoom))
        : Math.abs(screenDeltaToWorld(clientY - session.startClientY, st.zoom));
    if (probe < slop) return;
    activateDrag(session);
  }

  const deltaPx =
    session.handle.axis === "horizontal"
      ? clientX - session.startClientX
      : clientY - session.startClientY;
  const totalWorld = screenDeltaToWorld(deltaPx, st.zoom);
  const step = totalWorld - session.appliedWorldDelta;
  if (Math.abs(step) < 1e-9) return;
  session.appliedWorldDelta = totalWorld;

  const dx = session.handle.axis === "horizontal" ? step : 0;
  const dy = session.handle.axis === "vertical" ? step : 0;

  useEditorStore.setState((s) => {
    let nodes = moveNodesByWorldDelta(s.nodes, s.childOrder, session.movingIds, dx, dy);
    nodes = syncInstancePositionOverrides(nodes, session.movingIds);
    return { nodes };
  });
  mirrorWasmFromStore();

  const st2 = useEditorStore.getState();
  const gap = measureGapBetweenNodes(
    session.handle.beforeId,
    session.handle.afterId,
    session.handle.axis,
    st2.nodes,
    st2.childOrder,
  );
  const mid = gapMidpointWorld(
    session.handle.beforeId,
    session.handle.afterId,
    session.handle.axis,
    st2.nodes,
    st2.childOrder,
  );
  setPreview({
    axis: session.handle.axis,
    beforeId: session.handle.beforeId,
    afterId: session.handle.afterId,
    gap,
    label: `${Math.round(gap)}`,
    worldX: mid.x,
    worldY: mid.y,
  });
}

function endDrag(session: DragSession): void {
  activeDrag = null;
  setSelectionSpacingDragActive(false);
  setPreview(null);
  document.body.style.cursor = "";
}

function attachPointerListeners(session: DragSession, captureTarget: Element): void {
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== session.pointerId) return;
    forEachCoalescedPointerEvent(e, (pe) => {
      applyDrag(session, pe.clientX, pe.clientY);
    });
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== session.pointerId) return;
    forEachCoalescedPointerEvent(e, (pe) => {
      applyDrag(session, pe.clientX, pe.clientY);
    });
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    endDrag(session);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  try {
    captureTarget.setPointerCapture(session.pointerId);
  } catch {
    /* ignore */
  }
}

export function cancelSelectionSpacingDrag(): void {
  if (!activeDrag) return;
  endDrag(activeDrag);
}

export { isSelectionSpacingDragActive };

export function beginSelectionSpacingDrag(opts: {
  handle: SelectionSpacingHandle;
  pointerId: number;
  clientX: number;
  clientY: number;
  captureTarget: Element;
}): boolean {
  if (isAutoLayoutHandleDragActive()) return false;
  cancelCanvasMarqueeSession();
  cancelCanvasNodeDrag();

  const movingIds = idsMovedBySelectionGapDrag(opts.handle);
  if (movingIds.length === 0) return false;

  const session: DragSession = {
    pointerId: opts.pointerId,
    handle: opts.handle,
    startClientX: opts.clientX,
    startClientY: opts.clientY,
    startGap: opts.handle.gap,
    activated: false,
    appliedWorldDelta: 0,
    movingIds,
  };

  activeDrag = session;
  setSelectionSpacingDragActive(true);
  attachPointerListeners(session, opts.captureTarget);
  return true;
}
