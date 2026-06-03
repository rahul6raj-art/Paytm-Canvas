import { useEditorStore } from "@/stores/useEditorStore";
import { worldPosFromClientForGuide } from "@/lib/rulerGuideDrag";

/** Drag an existing layout guide to a new world position. */
export function startLayoutGuideMoveSession(opts: {
  guideId: string;
  pointerId: number;
  captureTarget: HTMLElement;
  viewportEl: HTMLElement;
}): void {
  const { guideId, pointerId, captureTarget, viewportEl } = opts;
  const guide0 = useEditorStore.getState().layoutGuides.find((g) => g.id === guideId);
  if (!guide0) return;

  useEditorStore.getState().pushHistory();

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
    const st = useEditorStore.getState();
    const g = st.layoutGuides.find((x) => x.id === guideId);
    if (!g) return;
    const pos = worldPosFromClientForGuide(
      g.axis,
      e.clientX,
      e.clientY,
      viewportEl,
      st.pan,
      st.zoom,
    );
    st.updateLayoutGuidePosition(guideId, pos, { skipHistory: true });
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    cleanup();
  };

  const onCancel = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    cleanup();
    useEditorStore.getState().undo();
  };

  captureTarget.setPointerCapture(pointerId);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
}
