import { applyDeepAutoLayout, applyLayoutPatchWithAutoLayout } from "@/lib/autoLayout";
import { CANVAS_CLICK_SLOP_SCREEN_PX } from "@/lib/canvasInteractionGuards";
import { screenDeltaToWorld } from "@/lib/canvasCoordinates";
import { screenPxToWorld } from "@/lib/canvasVisual";
import { cancelCanvasMarqueeSession } from "@/lib/canvasMarqueeSession";
import { cancelCanvasNodeDrag } from "@/lib/canvasNodeDrag";
import { worldPointToParentLocalFromChildOrder } from "@/lib/editorGraph";
import { flowChildIds } from "@/lib/layoutEngine/layoutAutoNode";
import { freezeAutoLayoutGap, inferAutoLayoutGap } from "@/lib/layoutEngine/inferGap";
import { computeMinLayoutGap } from "@/lib/layoutEngine/minLayoutGap";
import { childMainSizing, type LayoutEngineNode } from "@/lib/layoutEngine/types";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { forEachCoalescedPointerEvent } from "@/lib/smoothPointer";
import type { PaddingSide } from "./autoLayoutHandles";
import { computeFillDividerDragPatch } from "./fillDividerDrag";
import { setAutoLayoutHandleDragActive } from "./autoLayoutDragSession";
import { mirrorWasmFromStore } from "@/engine/craftEngineAuthorityStructure";

/** Fallback floor when geometry cannot be resolved (e.g. fewer than two flow children). */
export const LAYOUT_GAP_MIN = -256;
export const LAYOUT_GAP_MAX = 256;

export function clampLayoutGap(value: unknown, minGap: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(LAYOUT_GAP_MAX, Math.max(minGap, Math.round(n)));
}

export function sanitizeLayoutGap(value: unknown): number {
  return clampLayoutGap(value, LAYOUT_GAP_MIN);
}

export function sanitizeLayoutGapForFrame(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  value: unknown,
): number {
  const minGap = computeMinLayoutGap(
    parentId,
    nodes as Record<string, LayoutEngineNode>,
    childOrder,
  );
  return clampLayoutGap(value, minGap);
}

function resolveStartLayoutGap(
  parent: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  mode: "horizontal" | "vertical",
): number {
  if (parent.layoutGapAuto) {
    const kids = flowChildIds(parent.id, nodes as Record<string, LayoutEngineNode>, childOrder);
    if (kids.length >= 2) {
      return sanitizeLayoutGap(
        inferAutoLayoutGap(nodes as Record<string, LayoutEngineNode>, kids, mode),
      );
    }
    return 0;
  }
  return sanitizeLayoutGap(parent.layoutGap ?? 0);
}

/** Measured gap between adjacent flow children at a spacing handle index. */
export function resolveGapAtHandleIndex(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  mode: "horizontal" | "vertical",
  gapIndex: number,
): number {
  const kids = flowChildIds(parentId, nodes as Record<string, LayoutEngineNode>, childOrder);
  if (gapIndex < 0 || gapIndex >= kids.length - 1) {
    const parent = nodes[parentId];
    return parent ? resolveStartLayoutGap(parent, nodes, childOrder, mode) : 0;
  }
  const a = nodes[kids[gapIndex]!];
  const b = nodes[kids[gapIndex + 1]!];
  if (!a || !b) return 0;
  const raw =
    mode === "horizontal" ? b.x - (a.x + a.width) : b.y - (a.y + a.height);
  const parent = nodes[parentId];
  if (!parent) return sanitizeLayoutGap(raw);
  const measured = sanitizeLayoutGapForFrame(parentId, nodes, childOrder, raw);
  if (parent.layoutGapAuto) {
    return measured;
  }
  const configured = resolveStartLayoutGap(parent, nodes, childOrder, mode);
  // When stored gap lags behind on-canvas spacing, start the drag from what the user sees.
  if (measured > configured) return measured;
  return configured;
}

function primaryAxisAlignBlocksGapEdits(align: string | undefined): boolean {
  return align === "space-between" || align === "center" || align === "end";
}

/** Relayout auto-layout ancestors after a nested frame's gap/size changes. */
function relayoutAncestorAutoLayoutContainers(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeId: string,
): Record<string, EditorNode> {
  let next = nodes;
  let parentId = next[nodeId]?.parentId;
  while (parentId) {
    const parent = next[parentId];
    if (
      parent &&
      (parent.type === "frame" || parent.type === "group") &&
      (parent.layoutMode ?? "none") !== "none"
    ) {
      next = applyDeepAutoLayout(next, childOrder, parentId) as Record<string, EditorNode>;
    }
    parentId = next[parentId]?.parentId ?? null;
  }
  return next;
}

/** Screen-pixel drag delta → next gap (stable across relayout passes). */
export function computeSpacingGapFromDrag(
  startGap: number,
  startClientX: number,
  startClientY: number,
  clientX: number,
  clientY: number,
  mode: "horizontal" | "vertical",
  zoom: number,
  minGap: number,
): number {
  const deltaPx = mode === "horizontal" ? clientX - startClientX : clientY - startClientY;
  return clampLayoutGap(startGap + screenDeltaToWorld(deltaPx, zoom), minGap);
}

function parentLocalFromWorld(
  worldX: number,
  worldY: number,
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
    return { x: 0, y: 0 };
  }
  const local = worldPointToParentLocalFromChildOrder(worldX, worldY, parentId, nodes, childOrder);
  return {
    x: Number.isFinite(local.x) ? local.x : 0,
    y: Number.isFinite(local.y) ? local.y : 0,
  };
}

function finiteMainCoord(local: { x: number; y: number }, mode: "horizontal" | "vertical"): number {
  const v = mode === "horizontal" ? local.x : local.y;
  return Number.isFinite(v) ? v : 0;
}

export type ClientToWorldFn = (clientX: number, clientY: number) => { x: number; y: number };

export type AutoLayoutDragPreview = {
  nodeId: string;
  kind: "spacing" | "padding" | "fill-divider";
  value: number;
  label: string;
  /** Spacing drag: which gap handle is active (label sits at its midpoint). */
  gapIndex?: number;
  badgeX?: number;
  badgeY?: number;
} | null;

let livePreview: AutoLayoutDragPreview = null;
const previewListeners = new Set<() => void>();
let pendingPatch: { nodeId: string; patch: Record<string, unknown> } | null = null;
let rafId = 0;

function notifyPreview(): void {
  for (const fn of previewListeners) fn();
}

export function subscribeAutoLayoutDragPreview(onStoreChange: () => void): () => void {
  previewListeners.add(onStoreChange);
  return () => previewListeners.delete(onStoreChange);
}

export function getAutoLayoutDragPreview(): AutoLayoutDragPreview {
  return livePreview;
}

function setPreview(preview: AutoLayoutDragPreview): void {
  livePreview = preview;
  notifyPreview();
}

function flushStoreUpdate(): void {
  rafId = 0;
  if (!pendingPatch) return;
  const { nodeId, patch } = pendingPatch;
  pendingPatch = null;
  applyLayoutPatchNow(nodeId, patch);
}

function applyLayoutPatchNow(nodeId: string, patch: Record<string, unknown>): void {
  useEditorStore.setState((s) => {
    const n = s.nodes[nodeId];
    if (!n) return s;
    let nodes = applyLayoutPatchWithAutoLayout(
      s.nodes,
      s.childOrder,
      nodeId,
      patch,
    ) as typeof s.nodes;
    nodes = relayoutAncestorAutoLayoutContainers(nodes, s.childOrder, nodeId);
    return { nodes };
  });
  mirrorWasmFromStore();
}

function schedulePatch(nodeId: string, patch: Record<string, unknown>, immediate = false): void {
  pendingPatch = { nodeId, patch };
  if (immediate) {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    flushStoreUpdate();
    return;
  }
  if (!rafId) rafId = requestAnimationFrame(flushStoreUpdate);
}

type DragKind =
  | { type: "spacing"; startGap: number; startClientX: number; startClientY: number; gapIndex: number }
  | { type: "padding"; side: PaddingSide; startPad: number; grabCoord: number }
  | {
      type: "fill-divider";
      leftId: string;
      rightId: string;
      startLeftMain: number;
      startRightMain: number;
      startLeftGrow: number;
      startRightGrow: number;
      leftMainSizing: "fixed" | "hug" | "fill";
      rightMainSizing: "fixed" | "hug" | "fill";
      grabMain: number;
    };

type DragSession = {
  pointerId: number;
  nodeId: string;
  mode: "horizontal" | "vertical";
  drag: DragKind;
  clientToWorld: ClientToWorldFn;
  activated: boolean;
  startClientX: number;
  startClientY: number;
};

let activeDrag: DragSession | null = null;

export { isAutoLayoutHandleDragActive } from "./autoLayoutDragSession";

function applySpacingDrag(
  session: DragSession,
  clientX: number,
  clientY: number,
  local: { x: number; y: number },
): void {
  if (session.drag.type !== "spacing") return;
  const st = useEditorStore.getState();
  const minGap = computeMinLayoutGap(
    session.nodeId,
    st.nodes as Record<string, LayoutEngineNode>,
    st.childOrder,
  );
  const nextGap = computeSpacingGapFromDrag(
    session.drag.startGap,
    session.drag.startClientX,
    session.drag.startClientY,
    clientX,
    clientY,
    session.mode,
    st.zoom,
    minGap,
  );
  const parent = st.nodes[session.nodeId];
  const patch: Record<string, unknown> = { layoutGap: nextGap, layoutGapAuto: false };
  // Center/end/space-between redistribute slack — gap drags have no reliable effect until start.
  if (primaryAxisAlignBlocksGapEdits(parent?.primaryAxisAlign)) {
    patch.primaryAxisAlign = "start";
  }
  schedulePatch(session.nodeId, patch, true);
  setPreview({
    nodeId: session.nodeId,
    kind: "spacing",
    value: nextGap,
    label: `${nextGap}`,
    gapIndex: session.drag.gapIndex,
  });
}

function applyPaddingDrag(session: DragSession, local: { x: number; y: number }): void {
  if (session.drag.type !== "padding") return;
  const { side, startPad, grabCoord } = session.drag;
  const coord = finiteMainCoord(
    local,
    side === "top" || side === "bottom" ? "vertical" : "horizontal",
  );
  const delta = coord - grabCoord;
  const next = sanitizeLayoutGap(
    side === "top" || side === "left" ? startPad + delta : startPad - delta,
  );

  const key =
    side === "top"
      ? "paddingTop"
      : side === "right"
        ? "paddingRight"
        : side === "bottom"
          ? "paddingBottom"
          : "paddingLeft";

  setPreview({
    nodeId: session.nodeId,
    kind: "padding",
    value: next,
    label: `${next}`,
    badgeX: local.x,
    badgeY: local.y,
  });
  schedulePatch(session.nodeId, { [key]: next });
}

function applyFillDividerDrag(session: DragSession, local: { x: number; y: number }): void {
  if (session.drag.type !== "fill-divider") return;
  const delta = finiteMainCoord(local, session.mode) - session.drag.grabMain;
  const patch = computeFillDividerDragPatch(delta, session.mode, session.drag);
  const newLeft =
    session.mode === "horizontal"
      ? (patch.leftWidth ?? session.drag.startLeftMain + delta)
      : (patch.leftHeight ?? session.drag.startLeftMain + delta);
  const newRight =
    session.mode === "horizontal"
      ? (patch.rightWidth ?? session.drag.startRightMain - delta)
      : (patch.rightHeight ?? session.drag.startRightMain - delta);

  setPreview({
    nodeId: session.nodeId,
    kind: "fill-divider",
    value: Math.round(newLeft),
    label:
      patch.leftGrow != null && patch.rightGrow != null
        ? `${Math.round(patch.leftGrow * 10) / 10} : ${Math.round(patch.rightGrow * 10) / 10}`
        : `${Math.round(newLeft)} | ${Math.round(newRight)}`,
    badgeX: local.x,
    badgeY: local.y,
  });

  const st = useEditorStore.getState();
  const nodes = { ...st.nodes };
  const leftNode = { ...nodes[session.drag.leftId]!, layoutDirty: true };
  const rightNode = { ...nodes[session.drag.rightId]!, layoutDirty: true };

  if (patch.leftGrow != null) leftNode.layoutGrow = patch.leftGrow;
  if (patch.rightGrow != null) rightNode.layoutGrow = patch.rightGrow;
  if (patch.leftWidth != null) leftNode.width = patch.leftWidth;
  if (patch.leftHeight != null) leftNode.height = patch.leftHeight;
  if (patch.rightWidth != null) rightNode.width = patch.rightWidth;
  if (patch.rightHeight != null) rightNode.height = patch.rightHeight;

  nodes[session.drag.leftId] = leftNode;
  nodes[session.drag.rightId] = rightNode;

  const relayouted = applyLayoutPatchWithAutoLayout(nodes, st.childOrder, session.nodeId, {});
  useEditorStore.setState({ nodes: relayouted as typeof st.nodes });
}

function clickSlopWorld(zoom: number): number {
  return screenPxToWorld(CANVAS_CLICK_SLOP_SCREEN_PX, zoom);
}

function ensureHandleDragActivated(
  session: DragSession,
  clientX: number,
  clientY: number,
): boolean {
  if (session.activated) return true;
  const st = useEditorStore.getState();
  const fdx = screenDeltaToWorld(clientX - session.startClientX, st.zoom);
  const fdy = screenDeltaToWorld(clientY - session.startClientY, st.zoom);
  if (Math.hypot(fdx, fdy) < clickSlopWorld(st.zoom)) return false;
  session.activated = true;
  st.pushHistory();
  return true;
}

function applyDragAtClient(session: DragSession, clientX: number, clientY: number): void {
  if (!ensureHandleDragActivated(session, clientX, clientY)) return;
  const st = useEditorStore.getState();
  const world = session.clientToWorld(clientX, clientY);
  const local = parentLocalFromWorld(
    world.x,
    world.y,
    session.nodeId,
    st.nodes,
    st.childOrder,
  );

  if (session.drag.type === "spacing") applySpacingDrag(session, clientX, clientY, local);
  else if (session.drag.type === "padding") applyPaddingDrag(session, local);
  else applyFillDividerDrag(session, local);
}

function endDrag(session: DragSession): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (session.activated) {
      flushStoreUpdate();
    } else {
      pendingPatch = null;
    }
  }
  activeDrag = null;
  setAutoLayoutHandleDragActive(false);
  setPreview(null);
  document.body.style.cursor = "";
}

function attachDragPointerListeners(session: DragSession, captureTarget: Element): void {
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== session.pointerId) return;
    forEachCoalescedPointerEvent(e, (pe) => {
      applyDragAtClient(session, pe.clientX, pe.clientY);
    });
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== session.pointerId) return;
    forEachCoalescedPointerEvent(e, (pe) => {
      applyDragAtClient(session, pe.clientX, pe.clientY);
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

export function beginSpacingDrag(opts: {
  nodeId: string;
  gapIndex?: number;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
  cancelCanvasMarqueeSession();
  cancelCanvasNodeDrag();

  const st = useEditorStore.getState();
  const parent = st.nodes[opts.nodeId];
  if (!parent || (parent.layoutMode ?? "none") === "none") return false;
  const mode = parent.layoutMode as "horizontal" | "vertical";

  const prePatch: Record<string, unknown> = {};
  const gapFreeze = freezeAutoLayoutGap(
    parent as LayoutEngineNode,
    st.nodes as Record<string, LayoutEngineNode>,
    st.childOrder,
  );
  if (gapFreeze) Object.assign(prePatch, gapFreeze);
  if (primaryAxisAlignBlocksGapEdits(parent.primaryAxisAlign)) {
    prePatch.primaryAxisAlign = "start";
  }
  if (Object.keys(prePatch).length > 0) {
    applyLayoutPatchNow(opts.nodeId, prePatch);
  }

  const st2 = useEditorStore.getState();
  const parent2 = st2.nodes[opts.nodeId];
  if (!parent2) return false;

  const gapIndex = opts.gapIndex ?? 0;
  const startGap = resolveGapAtHandleIndex(
    opts.nodeId,
    st2.nodes,
    st2.childOrder,
    mode,
    gapIndex,
  );

  const session: DragSession = {
    pointerId: opts.pointerId,
    nodeId: opts.nodeId,
    mode,
    clientToWorld: opts.clientToWorld,
    activated: false,
    startClientX: opts.clientX,
    startClientY: opts.clientY,
    drag: {
      type: "spacing",
      startGap,
      startClientX: opts.clientX,
      startClientY: opts.clientY,
      gapIndex,
    },
  };
  activeDrag = session;
  setAutoLayoutHandleDragActive(true);
  document.body.style.cursor = mode === "horizontal" ? "ew-resize" : "ns-resize";
  attachDragPointerListeners(session, opts.captureTarget);
  return true;
}

export function beginPaddingDrag(opts: {
  nodeId: string;
  side: PaddingSide;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
  const st = useEditorStore.getState();
  const parent = st.nodes[opts.nodeId];
  if (!parent || (parent.layoutMode ?? "none") === "none") return false;
  const mode = parent.layoutMode as "horizontal" | "vertical";
  const world = opts.clientToWorld(opts.clientX, opts.clientY);
  const local = parentLocalFromWorld(world.x, world.y, opts.nodeId, st.nodes, st.childOrder);

  const startPad =
    opts.side === "top"
      ? parent.paddingTop ?? 0
      : opts.side === "right"
        ? parent.paddingRight ?? 0
        : opts.side === "bottom"
          ? parent.paddingBottom ?? 0
          : parent.paddingLeft ?? 0;

  const session: DragSession = {
    pointerId: opts.pointerId,
    nodeId: opts.nodeId,
    mode,
    clientToWorld: opts.clientToWorld,
    activated: false,
    startClientX: opts.clientX,
    startClientY: opts.clientY,
    drag: {
      type: "padding",
      side: opts.side,
      startPad,
      grabCoord: finiteMainCoord(
        local,
        opts.side === "top" || opts.side === "bottom" ? "vertical" : "horizontal",
      ),
    },
  };
  activeDrag = session;
  setAutoLayoutHandleDragActive(true);
  attachDragPointerListeners(session, opts.captureTarget);
  return true;
}

export function beginFillDividerDrag(opts: {
  nodeId: string;
  leftChildId: string;
  rightChildId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
  const st = useEditorStore.getState();
  const parent = st.nodes[opts.nodeId];
  const left = st.nodes[opts.leftChildId];
  const right = st.nodes[opts.rightChildId];
  if (!parent || !left || !right || (parent.layoutMode ?? "none") === "none") return false;
  const mode = parent.layoutMode as "horizontal" | "vertical";
  const world = opts.clientToWorld(opts.clientX, opts.clientY);
  const local = parentLocalFromWorld(world.x, world.y, opts.nodeId, st.nodes, st.childOrder);

  const leftMainSizing = childMainSizing(left as LayoutEngineNode, mode);
  const rightMainSizing = childMainSizing(right as LayoutEngineNode, mode);
  const session: DragSession = {
    pointerId: opts.pointerId,
    nodeId: opts.nodeId,
    mode,
    clientToWorld: opts.clientToWorld,
    activated: false,
    startClientX: opts.clientX,
    startClientY: opts.clientY,
    drag: {
      type: "fill-divider",
      leftId: opts.leftChildId,
      rightId: opts.rightChildId,
      startLeftMain: mode === "horizontal" ? left.width : left.height,
      startRightMain: mode === "horizontal" ? right.width : right.height,
      startLeftGrow: left.layoutGrow ?? 1,
      startRightGrow: right.layoutGrow ?? 1,
      leftMainSizing,
      rightMainSizing,
      grabMain: finiteMainCoord(local, mode),
    },
  };
  activeDrag = session;
  setAutoLayoutHandleDragActive(true);
  attachDragPointerListeners(session, opts.captureTarget);
  return true;
}
