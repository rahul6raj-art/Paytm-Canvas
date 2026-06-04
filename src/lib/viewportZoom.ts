import { waitForNextPaint } from "@/lib/figImport/figImportRuntime";
import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import {
  clampCanvasZoom,
  pickViewportRootIds,
  viewportForRootNodes,
  zoomAtScreenPoint,
} from "@/lib/canvasZoom";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import { worldRect } from "@/lib/tree";

export const CANVAS_VIEWPORT_SELECTOR = "[data-canvas-viewport]";

/** Size of the canvas viewport element when available (editor chrome). */
export function readCanvasViewportSize(
  fallbackW = 1200,
  fallbackH = 800,
): { width: number; height: number } {
  if (typeof document === "undefined") {
    return { width: fallbackW, height: fallbackH };
  }
  const el = document.querySelector<HTMLElement>(CANVAS_VIEWPORT_SELECTOR);
  const width = el?.clientWidth ?? fallbackW;
  const height = el?.clientHeight ?? fallbackH;
  return {
    width: width > 0 ? width : fallbackW,
    height: height > 0 ? height : fallbackH,
  };
}

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

function worldBoundsMeasure(
  nodes: Record<string, EditorNode>,
): (id: string) => { minX: number; minY: number; maxX: number; maxY: number } | null {
  return (id) => {
    if (!nodes[id]) return null;
    const wr = worldRect(id, nodes);
    if (!Number.isFinite(wr.x) || !Number.isFinite(wr.y)) return null;
    return {
      minX: wr.x,
      minY: wr.y,
      maxX: wr.x + Math.max(0, wr.width),
      maxY: wr.y + Math.max(0, wr.height),
    };
  };
}

/** Wait until the editor canvas viewport is mounted with non-zero size. */
export async function waitForCanvasViewport(maxWaitMs = 4000): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const el = document.querySelector<HTMLElement>(CANVAS_VIEWPORT_SELECTOR);
    if (el && el.clientWidth > 0 && el.clientHeight > 0) return true;
    await waitForNextPaint();
  }
  return false;
}

/** Fit imported roots with retries, then fall back to centering the primary frame at 100% zoom. */
export async function fitCanvasToImportedDocumentWithRetry(attempts = 10): Promise<boolean> {
  await waitForCanvasViewport();
  for (let i = 0; i < attempts; i++) {
    if (fitCanvasToImportedDocument()) return true;
    await waitForNextPaint();
  }
  const roots = useEditorStore.getState().childOrder[ROOT] ?? [];
  if (roots.length === 0) return false;
  resetCanvasView();
  return true;
}

function applyCanvasViewport(
  vp: { zoom: number; pan: { x: number; y: number } },
  patch?: { selectedIds?: string[] },
): void {
  const s = useEditorStore.getState();
  const pages = s.pages
    ? Object.fromEntries(
        Object.entries(s.pages).map(([id, page]) => [
          id,
          id === s.activePageId ? { ...page, zoom: vp.zoom, pan: vp.pan } : page,
        ]),
      )
    : s.pages;

  useEditorStore.setState({
    zoom: vp.zoom,
    pan: vp.pan,
    ...(pages ? { pages } : {}),
    ...patch,
  });
}

/** Figma ⇧1 — zoom so all top-level frames fit in the viewport. */
export function zoomCanvasToFit(options?: { recordHistory?: boolean }): boolean {
  const s = useEditorStore.getState();
  if (options?.recordHistory) {
    s.pushHistory();
  }

  const roots = s.childOrder[ROOT] ?? [];
  if (roots.length === 0) {
    resetCanvasView();
    return false;
  }

  const visibleRoots = roots.filter((id) => s.nodes[id]?.visible !== false);
  const fitRoots = visibleRoots.length > 0 ? visibleRoots : roots;
  const { width, height } = readCanvasViewportSize();
  const measure = worldBoundsMeasure(s.nodes);

  let vp = viewportForRootNodes(s.nodes, fitRoots, width, height, {
    fit: "all",
    measureWorldBounds: measure,
  });
  if (!vp) {
    vp = viewportForRootNodes(s.nodes, fitRoots, width, height, {
      fit: "primary",
      measureWorldBounds: measure,
    });
  }
  if (!vp) {
    resetCanvasView();
    return false;
  }

  applyCanvasViewport(vp);
  return true;
}

/** Pan/zoom to the main imported frame(s) using live viewport size and world bounds. */
export function fitCanvasToImportedDocument(): boolean {
  const s = useEditorStore.getState();
  const roots = s.childOrder[ROOT] ?? [];
  if (roots.length === 0) return false;

  const { width, height } = readCanvasViewportSize();
  const measure = worldBoundsMeasure(s.nodes);
  const fitRoots = pickViewportRootIds(s.nodes, roots);
  const vp = viewportForRootNodes(s.nodes, roots, width, height, {
    fit: "primary",
    measureWorldBounds: measure,
  });
  if (!vp) return false;

  applyCanvasViewport(vp, { selectedIds: fitRoots.slice(0, 1) });
  return true;
}

/** Figma ⇧2 — zoom/pan so the current selection fits in the viewport. */
export function zoomCanvasToSelection(options?: { recordHistory?: boolean }): boolean {
  const s = useEditorStore.getState();
  if (options?.recordHistory) {
    s.pushHistory();
  }

  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && n.visible && !n.locked;
  });
  if (tops.length === 0) return false;

  const { width, height } = readCanvasViewportSize();
  const measure = worldBoundsMeasure(s.nodes);
  const vp = viewportForRootNodes(s.nodes, tops, width, height, {
    fit: "all",
    measureWorldBounds: measure,
  });
  if (!vp) return false;
  applyCanvasViewport(vp);
  return true;
}

/** Figma N / ⇧N — focus the next or previous top-level frame on the canvas. */
export function cycleCanvasFrame(direction: 1 | -1): boolean {
  const s = useEditorStore.getState();
  const roots = (s.childOrder[ROOT] ?? []).filter((id) => {
    const n = s.nodes[id];
    return n?.type === "frame" && n.visible !== false;
  });
  if (roots.length === 0) return false;

  const selectedFrame = s.selectedIds.find((id) => roots.includes(id));
  const currentIdx = selectedFrame ? roots.indexOf(selectedFrame) : -1;
  const nextIdx = (currentIdx + direction + roots.length) % roots.length;
  const nextId = roots[nextIdx]!;

  const { width, height } = readCanvasViewportSize();
  const measure = worldBoundsMeasure(s.nodes);
  const vp = viewportForRootNodes(s.nodes, [nextId], width, height, {
    fit: "primary",
    measureWorldBounds: measure,
  });

  s.select(nextId);
  if (vp) applyCanvasViewport(vp);
  return true;
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
  applyCanvasViewport({
    zoom: newZoom,
    pan: { x: cx - worldCx * newZoom, y: cy - worldCy * newZoom },
  });
}
