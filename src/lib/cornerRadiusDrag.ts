import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import {
  clampCornerRadii,
  getNodeCornerRadii,
  hasIndependentCornerRadii,
  resolveCornerRadiusDragMax,
  type CornerRadii,
} from "@/lib/cornerRadius";
import {
  cornerRadiiStylePatch,
  isCornerRoundablePath,
  radiusFromRelativeCornerDrag,
} from "@/lib/shapes/shapeToPath";
import { worldToLocalForNode } from "@/lib/tree";
import { coalescedPointerEvents } from "@/lib/smoothPointer";

export type CornerIndex = 0 | 1 | 2 | 3;

export type ClientToWorldFn = (clientX: number, clientY: number) => { x: number; y: number };

export type CornerRadiusPreview = {
  nodeId: string;
  radii: CornerRadii;
  /** Corner being dragged (for on-canvas value badge). */
  cornerIndex: CornerIndex;
} | null;

export type CornerRadiusDragCallbacks = {
  onDrag?: (cornerIndex: CornerIndex, radius: number) => void;
  onEnd?: () => void;
};

let livePreview: CornerRadiusPreview = null;
let previewListeners = new Set<() => void>();
let pendingRadii: CornerRadii | null = null;
let rafId = 0;

function notifyPreview(): void {
  for (const fn of previewListeners) {
    fn();
  }
}

export function subscribeCornerRadiusPreview(onStoreChange: () => void): () => void {
  previewListeners.add(onStoreChange);
  return () => {
    previewListeners.delete(onStoreChange);
  };
}

export function getCornerRadiusPreview(): CornerRadiusPreview {
  return livePreview;
}

function setPreview(nodeId: string, radii: CornerRadii, cornerIndex: CornerIndex): void {
  livePreview = { nodeId, radii, cornerIndex };
  notifyPreview();
}

function clearPreview(): void {
  livePreview = null;
  notifyPreview();
}

function patchForCornerRadii(
  node: EditorNode,
  radii: CornerRadii,
): Partial<EditorNode> {
  if (node.type === "path" && isCornerRoundablePath(node)) {
    return cornerRadiiStylePatch(node, radii);
  }
  const clamped = clampCornerRadii(radii, node.width, node.height);
  const allSame =
    clamped[0] === clamped[1] && clamped[1] === clamped[2] && clamped[2] === clamped[3];
  if (allSame) {
    return { cornerRadius: clamped[0], cornerRadii: undefined };
  }
  return { cornerRadius: undefined, cornerRadii: clamped };
}

type DragSession = {
  pointerId: number;
  nodeId: string;
  cornerIndex: CornerIndex;
  grabRadius: number;
  grabLocalX: number;
  grabLocalY: number;
  linkCorners: boolean;
  startRadii: CornerRadii;
  callbacks?: CornerRadiusDragCallbacks;
};

let activeDrag: DragSession | null = null;

function flushStoreUpdate(): void {
  rafId = 0;
  const d = activeDrag;
  if (!d || !pendingRadii) return;
  const radii = pendingRadii;
  pendingRadii = null;
  const state = useEditorStore.getState();
  const n = state.nodes[d.nodeId];
  if (!n) return;
  const patch = patchForCornerRadii(n, radii);
  if (n.type === "path") {
    state.updateNodeStyle(d.nodeId, patch, { skipHistory: true });
  } else {
    state.updateNode(d.nodeId, patch, { skipHistory: true });
  }
}

function scheduleStoreUpdate(radii: CornerRadii): void {
  pendingRadii = radii;
  if (rafId) return;
  rafId = requestAnimationFrame(flushStoreUpdate);
}

const pointerEvents = coalescedPointerEvents;

function applyAtPointer(session: DragSession, clientX: number, clientY: number, clientToWorld: ClientToWorldFn): void {
  const state = useEditorStore.getState();
  const n = state.nodes[session.nodeId];
  if (!n) return;

  const world = clientToWorld(clientX, clientY);
  const local = worldToLocalForNode(
    world.x,
    world.y,
    session.nodeId,
    state.nodes,
    state.childOrder,
  );
  const maxR = resolveCornerRadiusDragMax(
    session.cornerIndex,
    session.startRadii,
    session.linkCorners,
    n.width,
    n.height,
  );
  const raw = radiusFromRelativeCornerDrag(
    session.cornerIndex,
    session.grabRadius,
    session.grabLocalX,
    session.grabLocalY,
    local.x,
    local.y,
    n.width,
    n.height,
    maxR,
  );

  let next: CornerRadii;
  if (session.linkCorners) {
    next = [raw, raw, raw, raw];
  } else {
    next = [...session.startRadii] as CornerRadii;
    next[session.cornerIndex] = raw;
  }
  next = clampCornerRadii(next, n.width, n.height);

  setPreview(session.nodeId, next, session.cornerIndex);
  scheduleStoreUpdate(next);
  const displayRadius = session.linkCorners ? next[0] : next[session.cornerIndex];
  session.callbacks?.onDrag?.(session.cornerIndex, displayRadius);
}

export function beginCornerRadiusDrag(opts: {
  nodeId: string;
  cornerIndex: CornerIndex;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
  callbacks?: CornerRadiusDragCallbacks;
}): boolean {
  const st = useEditorStore.getState();
  const node = st.nodes[opts.nodeId];
  if (!node || node.locked) return false;

  const startRadii = getNodeCornerRadii(node);
  const world0 = opts.clientToWorld(opts.clientX, opts.clientY);
  const local0 = worldToLocalForNode(
    world0.x,
    world0.y,
    opts.nodeId,
    st.nodes,
    st.childOrder,
  );

  st.pushHistory();
  activeDrag = {
    pointerId: opts.pointerId,
    nodeId: opts.nodeId,
    cornerIndex: opts.cornerIndex,
    grabRadius: startRadii[opts.cornerIndex] ?? 0,
    grabLocalX: local0.x,
    grabLocalY: local0.y,
    linkCorners: !hasIndependentCornerRadii(node),
    startRadii,
    callbacks: opts.callbacks,
  };
  setPreview(opts.nodeId, startRadii, opts.cornerIndex);

  try {
    opts.captureTarget.setPointerCapture(opts.pointerId);
  } catch {
    /* ignore */
  }

  const onMove = (ev: PointerEvent) => {
    const d = activeDrag;
    if (!d || ev.pointerId !== d.pointerId) return;
    for (const pe of pointerEvents(ev)) {
      applyAtPointer(d, pe.clientX, pe.clientY, opts.clientToWorld);
    }
  };

  const onUp = (ev: PointerEvent) => {
    const d = activeDrag;
    if (!d || ev.pointerId !== d.pointerId) return;
    for (const pe of pointerEvents(ev)) {
      applyAtPointer(d, pe.clientX, pe.clientY, opts.clientToWorld);
    }
    if (pendingRadii) {
      if (rafId) cancelAnimationFrame(rafId);
      flushStoreUpdate();
    }
    activeDrag = null;
    clearPreview();
    d.callbacks?.onEnd?.();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };

  applyAtPointer(activeDrag, opts.clientX, opts.clientY, opts.clientToWorld);

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  return true;
}

export function cancelCornerRadiusDrag(): void {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  pendingRadii = null;
  activeDrag = null;
  clearPreview();
}
