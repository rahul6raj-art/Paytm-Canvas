import { screenPxToWorld } from "@/lib/canvasVisual";
import { CANVAS_CLICK_SLOP_SCREEN_PX } from "@/lib/canvasInteractionGuards";
import {
  mergeMarqueeSelection,
  pickNodesInMarquee,
  selectionIdsEqual,
  type WorldMarqueeRect,
} from "@/lib/canvasMarqueeSelection";
import { useEditorStore } from "@/stores/useEditorStore";
import type { ClientToWorldFn } from "@/lib/canvasNodeDrag";

export type MarqueeSessionOptions = {
  pointerId: number;
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  captureTarget: HTMLElement;
  clientToWorld: ClientToWorldFn;
  onRectChange: (rect: WorldMarqueeRect | null) => void;
  onFinish?: () => void;
};

let activeCleanup: (() => void) | null = null;

export function cancelCanvasMarqueeSession(): boolean {
  if (!activeCleanup) return false;
  activeCleanup();
  return true;
}

export function startCanvasMarqueeSession(opts: MarqueeSessionOptions): void {
  activeCleanup?.();

  const w0 = opts.clientToWorld(opts.clientX, opts.clientY);
  const rect0: WorldMarqueeRect = { x0: w0.x, y0: w0.y, x1: w0.x, y1: w0.y };
  let draft = rect0;
  const baseSelection = opts.shiftKey ? [...useEditorStore.getState().selectedIds] : [];
  let lastPreview: string[] | null = null;
  let rafId = 0;
  let active = false;

  const target = opts.captureTarget;
  const capId = opts.pointerId;
  let ended = false;

  const removeListeners = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
    target.removeEventListener("lostpointercapture", onLostCapture);
  };

  const activate = () => {
    if (active || ended) return;
    active = true;
    opts.onRectChange(draft);
    try {
      target.setPointerCapture(capId);
    } catch {
      /* ignore */
    }
  };

  const flush = () => {
    rafId = 0;
    if (!active) return;
    opts.onRectChange(draft);
    const st = useEditorStore.getState();
    const slop = screenPxToWorld(CANVAS_CLICK_SLOP_SCREEN_PX, st.zoom);
    const w = Math.abs(draft.x1 - draft.x0);
    const h = Math.abs(draft.y1 - draft.y0);
    if (w < slop && h < slop) {
      if (!selectionIdsEqual(lastPreview ?? [], baseSelection)) {
        st.setSelection(baseSelection);
        lastPreview = baseSelection;
      }
      return;
    }
    const picked = pickNodesInMarquee(st.nodes, draft);
    const next = mergeMarqueeSelection(baseSelection, picked, opts.shiftKey);
    if (!selectionIdsEqual(lastPreview ?? [], next)) {
      st.setSelection(next);
      lastPreview = next;
    }
  };

  const scheduleFlush = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(flush);
  };

  const finish = (commit: boolean) => {
    if (ended) return;
    ended = true;
    activeCleanup = null;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    removeListeners();
    try {
      target.releasePointerCapture(capId);
    } catch {
      /* already released */
    }

    opts.onRectChange(null);

    if (!commit) {
      opts.onFinish?.();
      return;
    }

    const st = useEditorStore.getState();
    const slop = screenPxToWorld(CANVAS_CLICK_SLOP_SCREEN_PX, st.zoom);
    const w = Math.abs(draft.x1 - draft.x0);
    const h = Math.abs(draft.y1 - draft.y0);

    if (!active) {
      if (!opts.shiftKey) st.clearSelection();
    } else if (w < slop && h < slop) {
      if (!opts.shiftKey) st.clearSelection();
      else st.setSelection(baseSelection);
    } else {
      const picked = pickNodesInMarquee(st.nodes, draft);
      const next = mergeMarqueeSelection(baseSelection, picked, opts.shiftKey);
      st.setSelection(next);
    }

    opts.onFinish?.();
  };

  activeCleanup = () => finish(false);

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== capId) return;
    const ww = opts.clientToWorld(ev.clientX, ev.clientY);
    draft = { ...draft, x1: ww.x, y1: ww.y };
    if (!active) {
      const st = useEditorStore.getState();
      const slop = screenPxToWorld(CANVAS_CLICK_SLOP_SCREEN_PX, st.zoom);
      const w = Math.abs(draft.x1 - draft.x0);
      const h = Math.abs(draft.y1 - draft.y0);
      if (w < slop && h < slop) return;
      activate();
    }
    scheduleFlush();
  };

  const onPointerEnd = (ev: PointerEvent) => {
    if (ev.pointerId !== capId) return;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      flush();
    }
    finish(ev.type === "pointerup");
  };

  const onLostCapture = (ev: Event) => {
    const pe = ev as PointerEvent;
    if (pe.pointerId !== capId) return;
    finish(false);
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onPointerEnd);
  window.addEventListener("pointercancel", onPointerEnd);
  target.addEventListener("lostpointercapture", onLostCapture);
}
