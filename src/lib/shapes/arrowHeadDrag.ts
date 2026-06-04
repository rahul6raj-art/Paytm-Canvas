import { useEditorStore } from "@/stores/useEditorStore";
import {
  arrowEndpointStylePatch,
  resolveArrowEndKind,
  resolveArrowStartKind,
  type ArrowHeadKind,
} from "@/lib/shapes/arrowGeometry";
import { arrowHeadSizeFromLocalPoint } from "@/lib/shapes/arrowEditGeometry";
import { isArrowNode } from "@/lib/shapes/arrowGeometry";
import { worldToLocalForNode } from "@/lib/tree";
import { coalescedPointerEvents } from "@/lib/smoothPointer";

export type ClientToWorldFn = (clientX: number, clientY: number) => { x: number; y: number };

const ARROW_KIND_CYCLE: ArrowHeadKind[] = ["none", "triangle", "line", "circle", "diamond"];

function nextArrowKind(current: ArrowHeadKind): ArrowHeadKind {
  const i = ARROW_KIND_CYCLE.indexOf(current);
  const next = i < 0 ? 1 : (i + 1) % ARROW_KIND_CYCLE.length;
  return ARROW_KIND_CYCLE[next]!;
}

export function beginArrowCapCycle(opts: {
  nodeId: string;
  end: "start" | "end";
}): boolean {
  const st = useEditorStore.getState();
  const n = st.nodes[opts.nodeId];
  if (!n || !isArrowNode(n) || n.locked) return false;
  st.pushHistory();
  const start = resolveArrowStartKind(n);
  const end = resolveArrowEndKind(n);
  const patch =
    opts.end === "start"
      ? arrowEndpointStylePatch({ startArrow: nextArrowKind(start) })
      : arrowEndpointStylePatch({ endArrow: nextArrowKind(end) });
  st.updateNode(opts.nodeId, patch);
  return true;
}

export function beginArrowHeadSizeDrag(opts: {
  nodeId: string;
  pointerId: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
  const state = useEditorStore.getState();
  const n = state.nodes[opts.nodeId];
  if (!n || !isArrowNode(n) || n.locked) return false;

  state.pushHistory();
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
      if (!node || !isArrowNode(node)) continue;
      const loc = worldToLocalForNode(w.x, w.y, d.nodeId, st.nodes, st.childOrder);
      const size = arrowHeadSizeFromLocalPoint(loc.x, loc.y, node);
      st.updateNode(d.nodeId, { arrowHeadSize: size }, { skipHistory: true });
    }
  };

  const onUp = (ev: PointerEvent) => {
    const d = activeDrag;
    if (!d || ev.pointerId !== d.pointerId) return;
    activeDrag = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  return true;
}

let activeDrag: { pointerId: number; nodeId: string } | null = null;
