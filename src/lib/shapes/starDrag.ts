import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import {
  effectiveStarParams,
  isStarNode,
  starCornerRadiusFromLocalPoint,
  starGeometryPatch,
  starRatioFromLocalPoint,
  type StarParams,
} from "@/lib/shapes/starGeometry";
import { worldToLocalForNode } from "@/lib/tree";
import { coalescedPointerEvents } from "@/lib/smoothPointer";

export type ClientToWorldFn = (clientX: number, clientY: number) => { x: number; y: number };

export type StarPreview = {
  nodeId: string;
  pointCount: number;
  ratio: number;
  cornerRadius: number;
  outerCornerRadius: number;
  innerCornerRadius: number;
  vertexIndex: number;
} | null;

type StarDragKind = "ratio" | "cornerRadius";

type StarDragSession = {
  kind: StarDragKind;
  pointerId: number;
  nodeId: string;
  pointCount: number;
  vertexIndex: number;
  grabRatio: number;
  grabCornerRadius: number;
  grabLocalX: number;
  grabLocalY: number;
};

let activeDrag: StarDragSession | null = null;
let livePreview: StarPreview = null;
let previewListeners = new Set<() => void>();
let pendingPatch: Partial<
  Pick<EditorNode, "starInnerRadius" | "cornerRadius" | "starOuterCornerRadius" | "starInnerCornerRadius">
> | null = null;
let rafId = 0;

function notifyPreview(): void {
  for (const fn of previewListeners) {
    fn();
  }
}

export function subscribeStarPreview(onStoreChange: () => void): () => void {
  previewListeners.add(onStoreChange);
  return () => previewListeners.delete(onStoreChange);
}

export function getStarPreview(): StarPreview {
  return livePreview;
}

function setPreview(nodeId: string, params: StarParams, vertexIndex = 0): void {
  livePreview = {
    nodeId,
    pointCount: params.pointCount,
    ratio: params.ratio,
    cornerRadius: params.cornerRadius,
    outerCornerRadius: params.outerCornerRadius,
    innerCornerRadius: params.innerCornerRadius,
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
  const d = activeDrag;
  if (!d || !pendingPatch) return;
  const patch = pendingPatch;
  pendingPatch = null;
  const state = useEditorStore.getState();
  const n = state.nodes[d.nodeId];
  if (!n || !isStarNode(n)) return;
  state.updateNode(d.nodeId, starGeometryPatch(n, patch), { skipHistory: true });
}

function scheduleStoreUpdate(
  patch: Partial<
    Pick<EditorNode, "starInnerRadius" | "cornerRadius" | "starOuterCornerRadius" | "starInnerCornerRadius">
  >,
): void {
  pendingPatch = { ...pendingPatch, ...patch };
  if (rafId) return;
  rafId = requestAnimationFrame(flushStoreUpdate);
}

function beginStarDrag(
  kind: StarDragKind,
  opts: {
    nodeId: string;
    pointerId: number;
    clientX: number;
    clientY: number;
    clientToWorld: ClientToWorldFn;
    captureTarget: Element;
    vertexIndex?: number;
  },
): boolean {
  const state = useEditorStore.getState();
  const n = state.nodes[opts.nodeId];
  if (!n || !isStarNode(n) || n.locked) return false;

  state.pushHistory();
  const world = opts.clientToWorld(opts.clientX, opts.clientY);
  const local = worldToLocalForNode(world.x, world.y, opts.nodeId, state.nodes, state.childOrder);
  const pointCount = n.starPoints ?? 5;
  const ratio = n.starInnerRadius ?? 0.4;
  const params = effectiveStarParams(n);
  const vertexIndex = opts.vertexIndex ?? 0;

  activeDrag = {
    kind,
    pointerId: opts.pointerId,
    nodeId: opts.nodeId,
    pointCount,
    vertexIndex,
    grabRatio: ratio,
    grabCornerRadius: params.outerCornerRadius,
    grabLocalX: local.x,
    grabLocalY: local.y,
  };

  setPreview(opts.nodeId, params, vertexIndex);

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

      if (d.kind === "ratio") {
        const nextRatio = starRatioFromLocalPoint(
          loc.x,
          loc.y,
          d.pointCount,
          node.width,
          node.height,
        );
        const nextParams = effectiveStarParams({
          ...node,
          starInnerRadius: nextRatio,
        });
        setPreview(d.nodeId, nextParams);
        scheduleStoreUpdate({ starInnerRadius: nextRatio });
      } else {
        const nextOuter = starCornerRadiusFromLocalPoint(
          loc.x,
          loc.y,
          d.pointCount,
          node.starInnerRadius ?? 0.4,
          node.width,
          node.height,
          d.vertexIndex,
        );
        const nextParams = effectiveStarParams({
          ...node,
          starOuterCornerRadius: nextOuter,
          cornerRadius: nextOuter,
        });
        setPreview(d.nodeId, nextParams, d.vertexIndex);
        scheduleStoreUpdate({ starOuterCornerRadius: nextOuter, cornerRadius: nextOuter });
      }
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

export function beginStarRatioDrag(opts: {
  nodeId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
  return beginStarDrag("ratio", opts);
}

export function beginStarCornerRadiusDrag(opts: {
  nodeId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
  vertexIndex?: number;
}): boolean {
  return beginStarDrag("cornerRadius", opts);
}
