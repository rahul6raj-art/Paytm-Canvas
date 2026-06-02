import { clientToViewport, viewportToWorld } from "@/lib/canvasCoordinates";
import { CANVAS_RULER_SIZE } from "@/lib/canvasRulers";
import { useEditorStore } from "@/stores/useEditorStore";

export function worldPosFromClientForGuide(
  axis: "v" | "h",
  clientX: number,
  clientY: number,
  viewportEl: HTMLElement,
  pan: { x: number; y: number },
  zoom: number,
): number {
  const rect = viewportEl.getBoundingClientRect();
  const v = clientToViewport(clientX, clientY, rect);
  const w = viewportToWorld(v.x, v.y, pan, zoom);
  const raw = axis === "v" ? w.x : w.y;
  return Math.round(raw * 100) / 100;
}

export function isPointerOverRulerStrip(
  axis: "v" | "h",
  clientX: number,
  clientY: number,
  viewportEl: HTMLElement,
): boolean {
  const rect = viewportEl.getBoundingClientRect();
  const v = clientToViewport(clientX, clientY, rect);
  if (axis === "h") return v.y < CANVAS_RULER_SIZE;
  return v.x < CANVAS_RULER_SIZE;
}

/** Drag from a ruler to place a layout guide (Figma-style). */
export function startRulerGuideDragSession(opts: {
  axis: "v" | "h";
  pointerId: number;
  clientX: number;
  clientY: number;
  captureTarget: HTMLElement;
  viewportEl: HTMLElement;
  pan: { x: number; y: number };
  zoom: number;
}): void {
  const { axis, pointerId, captureTarget, viewportEl, pan, zoom } = opts;

  const updatePos = (clientX: number, clientY: number) => {
    const pos = worldPosFromClientForGuide(axis, clientX, clientY, viewportEl, pan, zoom);
    useEditorStore.getState().setLayoutGuideDraft({ axis, pos });
  };

  updatePos(opts.clientX, opts.clientY);

  const cleanup = () => {
    try {
      captureTarget.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    updatePos(e.clientX, e.clientY);
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    cleanup();
    const st = useEditorStore.getState();
    if (!st.layoutGuideDraft) return;
    if (isPointerOverRulerStrip(axis, e.clientX, e.clientY, viewportEl)) {
      st.cancelLayoutGuideDraft();
      return;
    }
    st.commitLayoutGuide();
  };

  const onCancel = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    cleanup();
    useEditorStore.getState().cancelLayoutGuideDraft();
  };

  captureTarget.setPointerCapture(pointerId);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
}
