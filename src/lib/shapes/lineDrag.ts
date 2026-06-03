import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import {
  lineEndpointWithShiftSnap,
  lineEndpointsFromNode,
  linePatchFromEndpoints,
  type LineEndpoints,
} from "@/lib/shapes/lineGeometry";
import {
  buildParentMapFromChildOrder,
  getNodeWorldMatrixFromChildOrder,
} from "@/lib/editorGraph";
import { applyMatrixToPoint, invertMatrix } from "@/lib/transformMath";
import { coalescedPointerEvents } from "@/lib/smoothPointer";

export type ClientToWorldFn = (clientX: number, clientY: number) => { x: number; y: number };

export type LinePreview = {
  nodeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} | null;

type LineDragKind = "start" | "end" | "body";

type LineDragSession = {
  kind: LineDragKind;
  pointerId: number;
  nodeId: string;
  startEndpoints: LineEndpoints;
  grabOffset: { x: number; y: number };
};

let activeDrag: LineDragSession | null = null;
let livePreview: LinePreview = null;
let previewListeners = new Set<() => void>();
let pendingPatch: Partial<EditorNode> | null = null;
let rafId = 0;

function notifyPreview(): void {
  for (const fn of previewListeners) fn();
}

export function subscribeLinePreview(onStoreChange: () => void): () => void {
  previewListeners.add(onStoreChange);
  return () => previewListeners.delete(onStoreChange);
}

export function getLinePreview(): LinePreview {
  return livePreview;
}

function setPreview(nodeId: string, ep: LineEndpoints): void {
  livePreview = { nodeId, x1: ep.x1, y1: ep.y1, x2: ep.x2, y2: ep.y2 };
  notifyPreview();
}

function clearPreview(): void {
  livePreview = null;
  notifyPreview();
}

function worldToLineParentLocal(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { x: number; y: number } {
  const parentOf = buildParentMapFromChildOrder(childOrder);
  const parentId = parentOf.get(nodeId) ?? null;
  if (!parentId) return { x: worldX, y: worldY };
  const wm = getNodeWorldMatrixFromChildOrder(parentId, nodes, childOrder);
  if (!wm) return { x: worldX, y: worldY };
  const inv = invertMatrix(wm);
  if (!inv) return { x: worldX, y: worldY };
  return applyMatrixToPoint(inv, { x: worldX, y: worldY });
}

function flushStoreUpdate(): void {
  rafId = 0;
  const d = activeDrag;
  if (!d || !pendingPatch) return;
  const patch = pendingPatch;
  pendingPatch = null;
  useEditorStore.getState().updateNode(d.nodeId, patch, { skipHistory: true });
}

function scheduleStoreUpdate(patch: Partial<EditorNode>): void {
  pendingPatch = { ...pendingPatch, ...patch };
  if (rafId) return;
  rafId = requestAnimationFrame(flushStoreUpdate);
}

function beginLineDrag(
  kind: LineDragKind,
  opts: {
    nodeId: string;
    pointerId: number;
    clientX: number;
    clientY: number;
    clientToWorld: ClientToWorldFn;
    captureTarget: Element;
  },
): boolean {
  const state = useEditorStore.getState();
  const n = state.nodes[opts.nodeId];
  if (!n || (n.type !== "line" && n.type !== "arrow") || n.locked) return false;

  state.pushHistory();
  const world = opts.clientToWorld(opts.clientX, opts.clientY);
  const local = worldToLineParentLocal(
    world.x,
    world.y,
    opts.nodeId,
    state.nodes,
    state.childOrder,
  );
  const startEndpoints = lineEndpointsFromNode(n);
  const grabOffset = { x: local.x, y: local.y };

  activeDrag = {
    kind,
    pointerId: opts.pointerId,
    nodeId: opts.nodeId,
    startEndpoints,
    grabOffset,
  };
  setPreview(opts.nodeId, startEndpoints);

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
      const loc = worldToLineParentLocal(w.x, w.y, d.nodeId, st.nodes, st.childOrder);
      let ep = { ...d.startEndpoints };

      if (d.kind === "body") {
        const dx = loc.x - d.grabOffset.x;
        const dy = loc.y - d.grabOffset.y;
        ep = {
          x1: d.startEndpoints.x1 + dx,
          y1: d.startEndpoints.y1 + dy,
          x2: d.startEndpoints.x2 + dx,
          y2: d.startEndpoints.y2 + dy,
        };
      } else if (d.kind === "start") {
        const fixed = { x: d.startEndpoints.x2, y: d.startEndpoints.y2 };
        const snapped = lineEndpointWithShiftSnap(fixed, loc, pe.shiftKey);
        ep = { x1: snapped.x, y1: snapped.y, x2: fixed.x, y2: fixed.y };
      } else {
        const fixed = { x: d.startEndpoints.x1, y: d.startEndpoints.y1 };
        const snapped = lineEndpointWithShiftSnap(fixed, loc, pe.shiftKey);
        ep = { x1: fixed.x, y1: fixed.y, x2: snapped.x, y2: snapped.y };
      }

      setPreview(d.nodeId, ep);
      scheduleStoreUpdate(linePatchFromEndpoints(ep.x1, ep.y1, ep.x2, ep.y2, node));
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

export function beginLineStartDrag(opts: Parameters<typeof beginLineDrag>[1]): boolean {
  return beginLineDrag("start", opts);
}

export function beginLineEndDrag(opts: Parameters<typeof beginLineDrag>[1]): boolean {
  return beginLineDrag("end", opts);
}

export function beginLineBodyDrag(opts: Parameters<typeof beginLineDrag>[1]): boolean {
  return beginLineDrag("body", opts);
}
