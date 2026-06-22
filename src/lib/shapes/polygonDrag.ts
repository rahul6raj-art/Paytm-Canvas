import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { hasIndependentVertexCornerRadii } from "@/lib/cornerRadius";
import {
  clampPolygonSides,
  effectivePolygonParams,
  getPolygonVertexCornerRadii,
  isPolygonNode,
  polygonCornerRadiusFromLocalPoint,
  polygonCornerRadiiPatch,
  polygonGeometryPatch,
  type PolygonParams,
} from "@/lib/shapes/polygonGeometry";
import { worldToLocalForNode } from "@/lib/tree";
import { coalescedPointerEvents } from "@/lib/smoothPointer";

export type ClientToWorldFn = (clientX: number, clientY: number) => { x: number; y: number };

export type PolygonPreview = {
  nodeId: string;
  sides: number;
  cornerRadius: number;
  cornerRadii: number[];
  vertexIndex: number;
} | null;

let livePreview: PolygonPreview = null;
let previewListeners = new Set<() => void>();
let activeDrag: { pointerId: number; nodeId: string; vertexIndex: number; linkCorners: boolean } | null =
  null;
let pendingPatch: Partial<EditorNode> | null = null;
let rafId = 0;

function notifyPreview(): void {
  for (const fn of previewListeners) fn();
}

export function subscribePolygonPreview(onStoreChange: () => void): () => void {
  previewListeners.add(onStoreChange);
  return () => previewListeners.delete(onStoreChange);
}

export function getPolygonPreview(): PolygonPreview {
  return livePreview;
}

function setPreview(
  nodeId: string,
  params: PolygonParams,
  cornerRadii: number[],
  vertexIndex: number,
): void {
  livePreview = {
    nodeId,
    sides: params.sides,
    cornerRadius: params.cornerRadius,
    cornerRadii,
    vertexIndex,
  };
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

function scheduleStoreUpdate(patch: Partial<EditorNode>): void {
  pendingPatch = { ...pendingPatch, ...patch };
  if (rafId) return;
  rafId = requestAnimationFrame(flushStoreUpdate);
}

export function beginPolygonCornerRadiusDrag(opts: {
  nodeId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
  vertexIndex?: number;
}): boolean {
  const state = useEditorStore.getState();
  const n = state.nodes[opts.nodeId];
  if (!n || !isPolygonNode(n) || n.locked) return false;

  const vertexIndex = opts.vertexIndex ?? 0;
  const params = effectivePolygonParams(n);
  const startRadii = getPolygonVertexCornerRadii(n);
  const linkCorners =
    !n.cornerRadii?.length || !hasIndependentVertexCornerRadii(startRadii);

  state.pushHistory();
  setPreview(opts.nodeId, params, startRadii, vertexIndex);

  activeDrag = { pointerId: opts.pointerId, nodeId: opts.nodeId, vertexIndex, linkCorners };
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
      const sides = clampPolygonSides(node.polygonSides ?? params.sides);
      const nextAtVertex = polygonCornerRadiusFromLocalPoint(
        loc.x,
        loc.y,
        sides,
        node.width,
        node.height,
        d.vertexIndex,
      );
      let nextRadii = [...getPolygonVertexCornerRadii(node)];
      if (d.linkCorners) {
        nextRadii = Array.from({ length: nextRadii.length }, () => nextAtVertex);
      } else {
        nextRadii[d.vertexIndex] = nextAtVertex;
      }
      const radiiPatch = polygonCornerRadiiPatch(node, nextRadii);
      const nextParams = effectivePolygonParams({ ...node, ...radiiPatch, polygonSides: sides });
      setPreview(d.nodeId, nextParams, nextRadii, d.vertexIndex);
      scheduleStoreUpdate({
        ...polygonGeometryPatch(node, { polygonSides: sides }),
        ...radiiPatch,
      });
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
