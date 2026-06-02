import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { insertIndexInAutoLayout, type LayoutNode } from "@/lib/autoLayout";
import { screenDeltaToWorld } from "@/lib/canvasCoordinates";
import {
  computeDragSmartGuides,
  proposedBoundsForMoving,
  type WorldRect,
} from "@/lib/dragSmartGuides";
import {
  getNodeTransformedWorldBounds,
  getNodeWorldOrigin,
  worldOriginToNodeXY,
} from "@/lib/transformMath";
import { isAncestorOf } from "@/lib/editorGraph";
import { pickDeepestFrameAtWorldPoint, worldToLocalForNode } from "@/lib/tree";

export type ClientToWorldFn = (clientX: number, clientY: number) => { x: number; y: number };

function pointInWorldRect(
  px: number,
  py: number,
  r: { x: number; y: number; width: number; height: number },
): boolean {
  return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
}

function toLayoutMap(nodes: Record<string, EditorNode>): Record<string, LayoutNode> {
  const m: Record<string, LayoutNode> = {};
  for (const nid of Object.keys(nodes)) {
    const n = nodes[nid]!;
    m[nid] = {
      id: n.id,
      type: n.type,
      parentId: n.parentId,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      visible: n.visible,
      locked: n.locked,
      layoutMode: n.layoutMode,
      layoutGap: n.layoutGap,
      paddingTop: n.paddingTop,
      paddingRight: n.paddingRight,
      paddingBottom: n.paddingBottom,
      paddingLeft: n.paddingLeft,
      primaryAxisAlign: n.primaryAxisAlign,
      counterAxisAlign: n.counterAxisAlign,
      constraintsHorizontal: n.constraintsHorizontal,
      constraintsVertical: n.constraintsVertical,
    };
  }
  return m;
}

type DragSession = {
  pointerId: number;
  sx: number;
  sy: number;
  primaryId: string;
  movingIds: string[];
  startWorld: Record<string, { x: number; y: number }>;
  startBounds: Record<string, WorldRect>;
  mode: "free" | "al-reorder";
  alParentId?: string;
  lastAlInsert?: number;
};

let activeDrag: DragSession | null = null;

/** Begin dragging the current selection from a node pointer-down (move/frame tools). */
export function beginCanvasNodeDrag(opts: {
  nodeId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  clientToWorld: ClientToWorldFn;
  captureTarget: Element;
}): boolean {
  const s1 = useEditorStore.getState();
  const dragTargets = s1.selectedIds.filter((sid) => {
    const n = s1.nodes[sid];
    return n && !n.locked && n.visible;
  });
  if (dragTargets.length === 0) return false;

  s1.pushHistory();
  document.body.style.cursor = "move";

  const primaryId = dragTargets.includes(opts.nodeId) ? opts.nodeId : dragTargets[0]!;
  const startWorld: Record<string, { x: number; y: number }> = {};
  const startBounds: Record<string, WorldRect> = {};
  for (const sid of dragTargets) {
    startWorld[sid] = getNodeWorldOrigin(sid, s1.nodes);
    startBounds[sid] = getNodeTransformedWorldBounds(sid, s1.nodes);
  }

  const pAl = s1.nodes[primaryId]!.parentId;
  const useAl =
    dragTargets.length === 1 &&
    pAl &&
    (s1.nodes[pAl]!.layoutMode ?? "none") !== "none";

  activeDrag = {
    pointerId: opts.pointerId,
    sx: opts.clientX,
    sy: opts.clientY,
    primaryId,
    movingIds: dragTargets,
    startWorld,
    startBounds,
    mode: useAl ? "al-reorder" : "free",
    alParentId: useAl ? pAl! : undefined,
    lastAlInsert: -1,
  };

  try {
    opts.captureTarget.setPointerCapture(opts.pointerId);
  } catch {
    /* ignore */
  }

  const onMove = (ev: PointerEvent) => {
    const d = activeDrag;
    if (!d || ev.pointerId !== d.pointerId) return;
    const state = useEditorStore.getState();
    const { updateNode, setSnapOverlay, reorderNode, moveNodeToParent } = state;
    const pid = d.primaryId;

    if (d.mode === "al-reorder" && d.alParentId) {
      const world = opts.clientToWorld(ev.clientX, ev.clientY);
      const pw = getNodeTransformedWorldBounds(d.alParentId, state.nodes);
      if (pointInWorldRect(world.x, world.y, pw)) {
        const local = worldToLocalForNode(world.x, world.y, pid, state.nodes);
        const lm = toLayoutMap(state.nodes);
        const ins = insertIndexInAutoLayout(
          d.alParentId,
          lm,
          state.childOrder,
          local.x,
          local.y,
          pid,
        );
        const parentKey = state.nodes[pid]!.parentId ?? ROOT;
        if (ins !== d.lastAlInsert) {
          d.lastAlInsert = ins;
          reorderNode(pid, parentKey, ins);
        }
      } else {
        const roots = state.childOrder[ROOT] ?? [];
        const idx = roots.filter((r) => r !== pid).length;
        moveNodeToParent(pid, ROOT, idx);
        const st2 = useEditorStore.getState();
        d.mode = "free";
        d.alParentId = undefined;
        d.lastAlInsert = -1;
        d.sx = ev.clientX;
        d.sy = ev.clientY;
        const wrPid = getNodeWorldOrigin(pid, st2.nodes);
        d.startWorld = { [pid]: wrPid };
        d.startBounds = { [pid]: getNodeTransformedWorldBounds(pid, st2.nodes) };
        d.movingIds = [pid];
      }
      setSnapOverlay([], []);
      return;
    }

    const z = state.zoom;
    const fdx = screenDeltaToWorld(ev.clientX - d.sx, z);
    const fdy = screenDeltaToWorld(ev.clientY - d.sy, z);

    const proposed = proposedBoundsForMoving(d.movingIds, d.startBounds, fdx, fdy);
    const snap = computeDragSmartGuides(d.movingIds, proposed, state.nodes, z);
    setSnapOverlay(snap.guides, snap.measurements);

    const fdx2 = fdx + snap.dx;
    const fdy2 = fdy + snap.dy;

    for (const sid of d.movingIds) {
      const sw = d.startWorld[sid]!;
      const desired = { x: sw.x + fdx2, y: sw.y + fdy2 };
      const xy = worldOriginToNodeXY(sid, state.nodes, desired);
      updateNode(sid, { x: xy.x, y: xy.y }, { skipHistory: true });
    }
  };

  const onUp = (ev: PointerEvent) => {
    const d = activeDrag;
    if (!d || ev.pointerId !== d.pointerId) return;
    const endedFree = d.mode === "free";
    activeDrag = null;
    document.body.style.cursor = "";
    useEditorStore.getState().setGuides([]);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);

    if (endedFree) {
      const st = useEditorStore.getState();
      if (st.editorMode === "prototype") return;
      const primary = st.nodes[d.primaryId];
      if (!primary) return;
      const world = opts.clientToWorld(ev.clientX, ev.clientY);
      const frameHit = pickDeepestFrameAtWorldPoint(world.x, world.y, st.nodes, st.childOrder, {
        excludeDescendantsOf: d.primaryId,
      });
      if (
        frameHit &&
        frameHit !== d.primaryId &&
        !isAncestorOf(st.nodes, d.primaryId, frameHit) &&
        primary.parentId !== frameHit
      ) {
        const list = [...(st.childOrder[frameHit] ?? [])].filter((x) => x !== d.primaryId);
        st.moveNodeToParent(d.primaryId, frameHit, list.length);
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
          const roots = (st.childOrder[ROOT] ?? []).filter((x) => x !== d.primaryId);
          st.moveNodeToParent(d.primaryId, ROOT, roots.length);
        }
      }
    }
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  return true;
}

export function cancelCanvasNodeDrag(): void {
  activeDrag = null;
  document.body.style.cursor = "";
  useEditorStore.getState().setGuides([]);
}
