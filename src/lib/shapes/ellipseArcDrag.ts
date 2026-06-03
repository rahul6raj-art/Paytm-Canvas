import { useEditorStore } from "@/stores/useEditorStore";
import {
  arcInnerRadiusRatioFromPointer,
  arcInnerRadiusRatioFromRelativeDrag,
  degreesFromLocalPoint,
  effectiveEllipseArc,
  ellipseArcMidDeg,
  ellipseEndAngleUnwrapped,
  ellipseRatioHandleLocal,
  isFullEllipseArc,
  startDegAndSweepFromStartHandleDrag,
  sweepDegFromEndHandleDrag,
  type EllipseArcPreview,
} from "@/lib/shapes/ellipseArc";
import { worldToLocalForNode } from "@/lib/tree";
import { coalescedPointerEvents } from "@/lib/smoothPointer";

export type ClientToWorldFn = (clientX: number, clientY: number) => { x: number; y: number };

type ArcDragKind = "sweep" | "start" | "ratio";

type ArcDragSession = {
  kind: ArcDragKind;
  pointerId: number;
  nodeId: string;
  startDeg: number;
  sweepDeg: number;
  innerRadiusRatio: number;
  grabAngle: number;
  grabSweep: number;
  grabStart: number;
  grabRatio: number;
  grabLocalX: number;
  grabLocalY: number;
  grabEndUnwrapped: number;
  fixedEndUnwrapped: number;
  ratioAngleDeg: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
};

let activeDrag: ArcDragSession | null = null;
/** Frozen ratio-handle position during drag (handle must not chase the pointer). */
let ratioHandleAnchorLocal: { x: number; y: number } | null = null;
let livePreview: EllipseArcPreview = null;
let previewListeners = new Set<() => void>();
let pendingPatch: Partial<{
  arcSweepDeg: number;
  arcStartDeg: number;
  arcInnerRadiusRatio: number;
}> | null = null;
let rafId = 0;

function notifyPreview(): void {
  for (const fn of previewListeners) {
    fn();
  }
}

export function subscribeEllipseArcPreview(onStoreChange: () => void): () => void {
  previewListeners.add(onStoreChange);
  return () => {
    previewListeners.delete(onStoreChange);
  };
}

/** @deprecated Use subscribeEllipseArcPreview */
export const subscribeEllipseSweepPreview = subscribeEllipseArcPreview;

export function getEllipseArcPreview(): EllipseArcPreview {
  return livePreview;
}

/** Ratio handle screen position frozen for the duration of a ratio drag. */
export function getEllipseArcRatioHandleAnchor(): { x: number; y: number } | null {
  return ratioHandleAnchorLocal;
}

/** @deprecated Use getEllipseArcPreview */
export const getEllipseSweepPreview = getEllipseArcPreview;

function setPreview(
  nodeId: string,
  startDeg: number,
  sweepDeg: number,
  innerRadiusRatio: number,
): void {
  livePreview = { nodeId, startDeg, sweepDeg, innerRadiusRatio };
  notifyPreview();
}

function clearPreview(): void {
  livePreview = null;
  ratioHandleAnchorLocal = null;
  notifyPreview();
}

function flushStoreUpdate(): void {
  rafId = 0;
  const d = activeDrag;
  if (!d || !pendingPatch) return;
  const patch = pendingPatch;
  pendingPatch = null;
  const state = useEditorStore.getState();
  const n = state.nodes[d.nodeId];
  if (!n || n.type !== "ellipse") return;
  state.updateNode(d.nodeId, patch, { skipHistory: true });
}

function scheduleStoreUpdate(patch: NonNullable<typeof pendingPatch>): void {
  pendingPatch = { ...pendingPatch, ...patch };
  if (rafId) return;
  rafId = requestAnimationFrame(flushStoreUpdate);
}

function applyPointer(
  session: ArcDragSession,
  clientX: number,
  clientY: number,
  clientToWorld: ClientToWorldFn,
  shiftKey: boolean,
): void {
  const state = useEditorStore.getState();
  const n = state.nodes[session.nodeId];
  if (!n || n.type !== "ellipse") return;

  const world = clientToWorld(clientX, clientY);
  const local = worldToLocalForNode(
    world.x,
    world.y,
    session.nodeId,
    state.nodes,
    state.childOrder,
  );

  let startDeg = session.startDeg;
  let sweepDeg = session.sweepDeg;
  let innerRadiusRatio = session.innerRadiusRatio;

  if (session.kind === "sweep") {
    const moveAngle = degreesFromLocalPoint(session.cx, session.cy, local.x, local.y);
    sweepDeg = sweepDegFromEndHandleDrag(
      session.startDeg,
      session.grabEndUnwrapped,
      moveAngle,
      {
        shiftKey,
        fromFullCircle: isFullEllipseArc(session.grabSweep),
      },
    );
    session.sweepDeg = sweepDeg;
    scheduleStoreUpdate({ arcSweepDeg: sweepDeg, arcStartDeg: startDeg });
  } else if (session.kind === "start") {
    const moveAngle = degreesFromLocalPoint(session.cx, session.cy, local.x, local.y);
    const next = startDegAndSweepFromStartHandleDrag(
      session.fixedEndUnwrapped,
      moveAngle,
      { shiftKey },
    );
    startDeg = next.startDeg;
    sweepDeg = next.sweepDeg;
    session.startDeg = startDeg;
    session.sweepDeg = sweepDeg;
    scheduleStoreUpdate({ arcStartDeg: startDeg, arcSweepDeg: sweepDeg });
  } else {
    const pointerRatio = arcInnerRadiusRatioFromPointer(
      session.width,
      session.height,
      local.x,
      local.y,
      { shiftKey },
    );
    const bisectorRatio = arcInnerRadiusRatioFromRelativeDrag(
      session.width,
      session.height,
      session.ratioAngleDeg,
      session.grabRatio,
      session.grabLocalX,
      session.grabLocalY,
      local.x,
      local.y,
      { shiftKey },
    );
    // Pointer radial distance handles drag toward center; bisector handles drag along handle ray.
    const decreasing = pointerRatio < session.grabRatio - 1e-4;
    innerRadiusRatio = decreasing
      ? Math.min(pointerRatio, bisectorRatio)
      : Math.max(pointerRatio, bisectorRatio);
    session.innerRadiusRatio = innerRadiusRatio;
    scheduleStoreUpdate({ arcInnerRadiusRatio: innerRadiusRatio });
  }

  setPreview(session.nodeId, startDeg, sweepDeg, innerRadiusRatio);
}

const pointerEvents = coalescedPointerEvents;

function beginArcDrag(
  kind: ArcDragKind,
  opts: {
    nodeId: string;
    pointerId: number;
    clientX: number;
    clientY: number;
    clientToWorld: ClientToWorldFn;
    captureTarget: Element;
  },
): boolean {
  const st = useEditorStore.getState();
  const node = st.nodes[opts.nodeId];
  if (!node || node.type !== "ellipse" || node.locked) return false;

  const arc = effectiveEllipseArc(node);
  const cx = node.width / 2;
  const cy = node.height / 2;
  const world0 = opts.clientToWorld(opts.clientX, opts.clientY);
  const local0 = worldToLocalForNode(
    world0.x,
    world0.y,
    opts.nodeId,
    st.nodes,
    st.childOrder,
  );
  const grabAngle = degreesFromLocalPoint(cx, cy, local0.x, local0.y);
  const grabEndUnwrapped = ellipseEndAngleUnwrapped(arc.startDeg, arc.sweepDeg, grabAngle);
  const fixedEndUnwrapped = grabEndUnwrapped;

  const ratioAngleDeg =
    kind === "ratio" ? ellipseArcMidDeg(arc.startDeg, arc.sweepDeg) : 0;
  const grabLocalX = local0.x;
  const grabLocalY = local0.y;
  const grabRatio =
    kind === "ratio"
      ? arcInnerRadiusRatioFromPointer(node.width, node.height, grabLocalX, grabLocalY)
      : arc.innerRadiusRatio;

  if (kind === "ratio") {
    ratioHandleAnchorLocal = ellipseRatioHandleLocal(
      node.width,
      node.height,
      arc.startDeg,
      arc.sweepDeg,
      arc.innerRadiusRatio,
    );
  }

  st.pushHistory();
  activeDrag = {
    kind,
    pointerId: opts.pointerId,
    nodeId: opts.nodeId,
    startDeg: arc.startDeg,
    sweepDeg: arc.sweepDeg,
    innerRadiusRatio: kind === "ratio" ? grabRatio : arc.innerRadiusRatio,
    grabAngle,
    grabSweep: arc.sweepDeg,
    grabStart: arc.startDeg,
    grabRatio,
    grabLocalX,
    grabLocalY,
    grabEndUnwrapped,
    fixedEndUnwrapped,
    ratioAngleDeg,
    width: node.width,
    height: node.height,
    cx,
    cy,
  };

  setPreview(
    opts.nodeId,
    arc.startDeg,
    arc.sweepDeg,
    kind === "ratio" ? grabRatio : arc.innerRadiusRatio,
  );

  try {
    opts.captureTarget.setPointerCapture(opts.pointerId);
  } catch {
    /* ignore */
  }

  const onMove = (ev: PointerEvent) => {
    const d = activeDrag;
    if (!d || ev.pointerId !== d.pointerId) return;
    for (const pe of pointerEvents(ev)) {
      applyPointer(d, pe.clientX, pe.clientY, opts.clientToWorld, pe.shiftKey);
    }
  };

  const onUp = (ev: PointerEvent) => {
    const d = activeDrag;
    if (!d || ev.pointerId !== d.pointerId) return;
    for (const pe of pointerEvents(ev)) {
      applyPointer(d, pe.clientX, pe.clientY, opts.clientToWorld, pe.shiftKey);
    }
    if (pendingPatch) {
      if (rafId) cancelAnimationFrame(rafId);
      flushStoreUpdate();
    }
    activeDrag = null;
    clearPreview();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };

  applyPointer(activeDrag, opts.clientX, opts.clientY, opts.clientToWorld, false);

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  return true;
}

export function beginEllipseSweepDrag(opts: {
  nodeId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
  return beginArcDrag("sweep", opts);
}

export function beginEllipseStartDrag(opts: {
  nodeId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
  return beginArcDrag("start", opts);
}

export function beginEllipseRatioDrag(opts: {
  nodeId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
  return beginArcDrag("ratio", opts);
}

export function cancelEllipseArcDrag(): void {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  pendingPatch = null;
  activeDrag = null;
  ratioHandleAnchorLocal = null;
  clearPreview();
}

/** @deprecated Use cancelEllipseArcDrag */
export const cancelEllipseSweepDrag = cancelEllipseArcDrag;
