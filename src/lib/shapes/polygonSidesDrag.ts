import { useEditorStore } from "@/stores/useEditorStore";
import {
  effectivePolygonParams,
  isPolygonNode,
  polygonGeometryPatch,
  polygonSidesFromLocalPoint,
} from "@/lib/shapes/polygonGeometry";
import { worldToLocalForNode } from "@/lib/tree";
import { coalescedPointerEvents } from "@/lib/smoothPointer";

export type ClientToWorldFn = (clientX: number, clientY: number) => { x: number; y: number };

export type PolygonSidesPreview = {
  nodeId: string;
  sides: number;
  cornerRadius: number;
} | null;

let livePreview: PolygonSidesPreview = null;
let previewListeners = new Set<() => void>();
let activeDrag: { pointerId: number; nodeId: string } | null = null;
let pendingPatch: Partial<import("@/stores/useEditorStore").EditorNode> | null = null;
let rafId = 0;

function notifyPreview(): void {
  for (const fn of previewListeners) fn();
}

export function subscribePolygonSidesPreview(onStoreChange: () => void): () => void {
  previewListeners.add(onStoreChange);
  return () => previewListeners.delete(onStoreChange);
}

export function getPolygonSidesPreview(): PolygonSidesPreview {
  return livePreview;
}

function setPreview(nodeId: string, sides: number, cornerRadius: number): void {
  livePreview = { nodeId, sides, cornerRadius };
  notifyPreview();
}

function clearPreview(): void {
  livePreview = null;
  notifyPreview();
}

function flushStoreUpdate(): void {
  rafId = 0;
  if (!activeDrag || !pendingPatch) return;
  const patch = pendingPatch;
  pendingPatch = null;
  useEditorStore.getState().updateNode(activeDrag.nodeId, patch, { skipHistory: true });
}

function scheduleStoreUpdate(patch: Partial<import("@/stores/useEditorStore").EditorNode>): void {
  pendingPatch = { ...pendingPatch, ...patch };
  if (rafId) return;
  rafId = requestAnimationFrame(flushStoreUpdate);
}

export function beginPolygonSidesDrag(opts: {
  nodeId: string;
  pointerId: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
  const state = useEditorStore.getState();
  const n = state.nodes[opts.nodeId];
  if (!n || !isPolygonNode(n) || n.locked) return false;

  state.pushHistory();
  const params = effectivePolygonParams(n);
  setPreview(opts.nodeId, params.sides, params.cornerRadius);

  activeDrag = { pointerId: opts.pointerId, nodeId: opts.nodeId };
  try {
    opts.captureTarget.setPointerCapture(opts.pointerId);
  } catch {
    /* ignore */
  }

  const onMove = (ev: PointerEvent) => {
    const d = activeDrag;
    if (!d || ev.pointerId !== d.pointerId) return;
    for (const pe of coalescedPointerEvents(ev)) {
      const w = opts.clientToWorld(pe.clientX, pe.clientY);
      const st = useEditorStore.getState();
      const node = st.nodes[d.nodeId];
      if (!node) continue;
      const loc = worldToLocalForNode(w.x, w.y, d.nodeId, st.nodes, st.childOrder);
      const sides = polygonSidesFromLocalPoint(loc.x, loc.y, node.width, node.height);
      const p = effectivePolygonParams(node);
      setPreview(d.nodeId, sides, p.cornerRadius);
      scheduleStoreUpdate(polygonGeometryPatch(node, { polygonSides: sides }));
    }
  };

  const onUp = (ev: PointerEvent) => {
    const d = activeDrag;
    if (!d || ev.pointerId !== d.pointerId) return;
    flushStoreUpdate();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    pendingPatch = null;
    activeDrag = null;
    clearPreview();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  return true;
}
