import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { insertIndexInAutoLayout, type LayoutNode } from "@/lib/autoLayout";
import { screenDeltaToWorld } from "@/lib/canvasCoordinates";
import {
  getNodeTransformedWorldBounds,
  getNodeWorldOrigin,
  worldOriginToNodeXY,
} from "@/lib/transformMath";
import { isAncestorOf } from "@/lib/editorGraph";
import { pickDeepestFrameAtWorldPoint, pickDeepestFrameOrGroupAtWorldPoint, worldToLocalForNode } from "@/lib/tree";

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

function collectSnapXs(nodes: Record<string, EditorNode>, excludeId: string): number[] {
  const xs: number[] = [];
  const isUnder = (nodeId: string, ancestorId: string) => {
    let cur: string | null = nodes[nodeId]?.parentId ?? null;
    while (cur) {
      if (cur === ancestorId) return true;
      cur = nodes[cur]?.parentId ?? null;
    }
    return false;
  };
  for (const id of Object.keys(nodes)) {
    if (id === excludeId || isUnder(id, excludeId)) continue;
    const w = getNodeTransformedWorldBounds(id, nodes);
    xs.push(w.x, w.x + w.width / 2, w.x + w.width);
  }
  return xs;
}

function collectSnapYs(nodes: Record<string, EditorNode>, excludeId: string): number[] {
  const ys: number[] = [];
  const isUnder = (nodeId: string, ancestorId: string) => {
    let cur: string | null = nodes[nodeId]?.parentId ?? null;
    while (cur) {
      if (cur === ancestorId) return true;
      cur = nodes[cur]?.parentId ?? null;
    }
    return false;
  };
  for (const id of Object.keys(nodes)) {
    if (id === excludeId || isUnder(id, excludeId)) continue;
    const w = getNodeTransformedWorldBounds(id, nodes);
    ys.push(w.y, w.y + w.height / 2, w.y + w.height);
  }
  return ys;
}

type DragSession = {
  pointerId: number;
  sx: number;
  sy: number;
  primaryId: string;
  startWorld: Record<string, { x: number; y: number }>;
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
  for (const sid of dragTargets) {
    startWorld[sid] = getNodeWorldOrigin(sid, s1.nodes);
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
    startWorld,
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
    const { updateNode, setGuides, reorderNode, moveNodeToParent } = state;
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
      }
      return;
    }

    const z = state.zoom;
    const ddx = screenDeltaToWorld(ev.clientX - d.sx, z);
    const ddy = screenDeltaToWorld(ev.clientY - d.sy, z);

    const base = d.startWorld[pid]!;
    let worldX = base.x + ddx;
    let worldY = base.y + ddy;

    const SNAP = 5;
    const n0 = state.nodes[pid]!;
    const wr = { x: worldX, y: worldY, width: n0.width, height: n0.height };
    const snapXs = collectSnapXs(state.nodes, pid);
    const snapYs = collectSnapYs(state.nodes, pid);
    const guides: { axis: "v" | "h"; pos: number }[] = [];

    const tryX = (edgeX: number, target: number) => {
      if (Math.abs(edgeX - target) <= SNAP) {
        worldX += target - edgeX;
        guides.push({ axis: "v", pos: target });
        return true;
      }
      return false;
    };
    const tryY = (edgeY: number, target: number) => {
      if (Math.abs(edgeY - target) <= SNAP) {
        worldY += target - edgeY;
        guides.push({ axis: "h", pos: target });
        return true;
      }
      return false;
    };

    for (const tx of snapXs) {
      if (tryX(wr.x, tx)) break;
      if (tryX(wr.x + wr.width / 2, tx)) break;
      if (tryX(wr.x + wr.width, tx)) break;
    }
    for (const ty of snapYs) {
      if (tryY(wr.y, ty)) break;
      if (tryY(wr.y + wr.height / 2, ty)) break;
      if (tryY(wr.y + wr.height, ty)) break;
    }

    setGuides(guides);
    const fdx = worldX - base.x;
    const fdy = worldY - base.y;
    for (const sid of Object.keys(d.startWorld)) {
      const sw = d.startWorld[sid]!;
      const desired = { x: sw.x + fdx, y: sw.y + fdy };
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
