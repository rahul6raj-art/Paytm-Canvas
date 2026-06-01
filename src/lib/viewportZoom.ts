import { ROOT, useEditorStore } from "@/stores/useEditorStore";
import { clampCanvasZoom, zoomAtScreenPoint } from "@/lib/canvasZoom";
import { worldRect } from "@/lib/tree";

export const CANVAS_VIEWPORT_SELECTOR = "[data-canvas-viewport]";

/** Zoom in/out keeping the viewport center fixed in world space. */
export function zoomCanvasAtViewportCenter(
  factor: number,
  options?: { recordHistory?: boolean },
) {
  const s = useEditorStore.getState();
  if (options?.recordHistory) {
    s.pushHistory();
  }
  const el = document.querySelector(CANVAS_VIEWPORT_SELECTOR) as HTMLElement | null;
  const newZoom = clampCanvasZoom(s.zoom * factor);
  if (!el) {
    useEditorStore.setState({ zoom: newZoom });
    return;
  }
  const rect = el.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const next = zoomAtScreenPoint({
    zoom: s.zoom,
    pan: s.pan,
    focusX: cx,
    focusY: cy,
    factor: newZoom / s.zoom,
  });
  useEditorStore.setState(next);
}

/** Reset zoom to 100% and center the primary artboard in the viewport (no history). */
export function resetCanvasView() {
  const s = useEditorStore.getState();
  const el = document.querySelector(CANVAS_VIEWPORT_SELECTOR) as HTMLElement | null;
  const roots = s.childOrder[ROOT] ?? [];
  const mainId =
    roots.find((id) => s.nodes[id]?.type === "frame") ?? roots[0] ?? null;
  const newZoom = 1;

  if (!el || !mainId) {
    useEditorStore.setState({ zoom: newZoom, pan: { x: 0, y: 0 } });
    return;
  }

  const wr = worldRect(mainId, s.nodes);
  const rect = el.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const worldCx = wr.x + wr.width / 2;
  const worldCy = wr.y + wr.height / 2;
  useEditorStore.setState({
    zoom: newZoom,
    pan: { x: cx - worldCx * newZoom, y: cy - worldCy * newZoom },
  });
}
