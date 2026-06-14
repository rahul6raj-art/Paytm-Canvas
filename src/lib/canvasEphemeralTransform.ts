/**
 * Imperative pan/drag previews — avoids Zustand + React re-renders during pointer moves.
 * Committed to the store on pointer-up (see canvasNodeDrag + Canvas pan handler).
 */

import { snapScreenToDevicePixel } from "@/lib/crispRender";
import { isAncestorOf, topLevelSelectedIds } from "@/lib/editorGraph";
import { useEditorStore } from "@/stores/useEditorStore";

export type DragPreviewState = {
  dx: number;
  dy: number;
  movingIds: readonly string[];
};

type PanPreviewState = {
  basePan: { x: number; y: number };
  zoom: number;
  dx: number;
  dy: number;
};

let sceneTransformEl: HTMLElement | null = null;
let gridEl: HTMLElement | null = null;
let gridBasePosition: { x: number; y: number } | null = null;
let panPreview: PanPreviewState | null = null;
let dragPreview: DragPreviewState | null = null;

const dragListeners = new Set<() => void>();
const panListeners = new Set<() => void>();
const resizeListeners = new Set<() => void>();

let resizePreviewEpoch = 0;

const hasDom = typeof document !== "undefined";

function notifyDragListeners(): void {
  dragListeners.forEach((fn) => fn());
}

function notifyPanListeners(): void {
  panListeners.forEach((fn) => fn());
}

export function subscribePanPreview(listener: () => void): () => void {
  panListeners.add(listener);
  return () => panListeners.delete(listener);
}

/** Stable idle snapshot for useSyncExternalStore (must not allocate per read). */
export const PAN_PREVIEW_IDLE = { dx: 0, dy: 0 };

let cachedPanPreviewSnapshot: { dx: number; dy: number } = PAN_PREVIEW_IDLE;

export function getPanPreviewSnapshot(): { dx: number; dy: number } {
  if (!panPreview) {
    cachedPanPreviewSnapshot = PAN_PREVIEW_IDLE;
    return PAN_PREVIEW_IDLE;
  }
  const { dx, dy } = panPreview;
  if (cachedPanPreviewSnapshot.dx === dx && cachedPanPreviewSnapshot.dy === dy) {
    return cachedPanPreviewSnapshot;
  }
  cachedPanPreviewSnapshot = { dx, dy };
  return cachedPanPreviewSnapshot;
}

export function registerCanvasSceneTransform(el: HTMLElement | null): void {
  sceneTransformEl = el;
}

export function registerCanvasGrid(el: HTMLElement | null): void {
  gridEl = el;
}

export function subscribeDragPreview(listener: () => void): () => void {
  dragListeners.add(listener);
  return () => dragListeners.delete(listener);
}

export function subscribeResizePreview(listener: () => void): () => void {
  resizeListeners.add(listener);
  return () => resizeListeners.delete(listener);
}

/** Bumped on each resize move so SelectionBox can read live store geometry synchronously. */
export function getResizePreviewEpoch(): number {
  return resizePreviewEpoch;
}

export function bumpResizePreview(): void {
  resizePreviewEpoch += 1;
  resizeListeners.forEach((fn) => fn());
}

export function clearResizePreview(): void {
  if (resizePreviewEpoch === 0) return;
  resizePreviewEpoch = 0;
  resizeListeners.forEach((fn) => fn());
}

export function getDragPreviewSnapshot(): DragPreviewState | null {
  return dragPreview;
}

export function getDragPreviewOffsetForIds(ids: readonly string[]): { dx: number; dy: number } {
  if (!dragPreview || dragPreview.movingIds.length === 0) {
    return { dx: 0, dy: 0 };
  }
  const moving = new Set(dragPreview.movingIds);
  if (ids.some((id) => moving.has(id))) {
    return { dx: dragPreview.dx, dy: dragPreview.dy };
  }
  const { nodes } = useEditorStore.getState();
  for (const id of ids) {
    for (const movingId of dragPreview.movingIds) {
      if (isAncestorOf(nodes, movingId, id)) {
        return { dx: dragPreview.dx, dy: dragPreview.dy };
      }
    }
  }
  return { dx: 0, dy: 0 };
}

function sceneTransformString(panX: number, panY: number, zoom: number): string {
  const x = snapScreenToDevicePixel(panX);
  const y = snapScreenToDevicePixel(panY);
  return `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
}

export function applyPanPreview(
  basePan: { x: number; y: number },
  zoom: number,
  dx: number,
  dy: number,
): void {
  panPreview = { basePan, zoom, dx, dy };
  if (sceneTransformEl) {
    sceneTransformEl.style.willChange = "transform";
    sceneTransformEl.style.transform = sceneTransformString(
      basePan.x + dx,
      basePan.y + dy,
      zoom,
    );
  }
  if (gridEl) {
    if (!gridBasePosition) {
      gridBasePosition = { ...basePan };
    }
    gridEl.style.backgroundPosition = `${basePan.x + dx}px ${basePan.y + dy}px`;
  }
  notifyPanListeners();
}

export function clearPanPreview(): void {
  panPreview = null;
  gridBasePosition = null;
  if (sceneTransformEl) {
    sceneTransformEl.style.removeProperty("transform");
    sceneTransformEl.style.removeProperty("will-change");
  }
  if (gridEl) {
    gridEl.style.removeProperty("background-position");
  }
  notifyPanListeners();
}

export function readPanPreviewDelta(): { dx: number; dy: number } {
  if (!panPreview) return { dx: 0, dy: 0 };
  return { dx: panPreview.dx, dy: panPreview.dy };
}

function nodeElements(ids: readonly string[]): HTMLElement[] {
  if (!hasDom) return [];
  const out: HTMLElement[] = [];
  for (const id of ids) {
    const el = document.querySelector<HTMLElement>(`[data-canvas-node="${CSS.escape(id)}"]`);
    if (el) out.push(el);
  }
  return out;
}

function svgDragRootGroups(movingIds: readonly string[]): SVGGElement[] {
  if (!hasDom || movingIds.length === 0) return [];
  const scene = document.querySelector<SVGGElement>("[data-svg-scene]");
  if (!scene) return [];
  const { nodes } = useEditorStore.getState();
  const tops = topLevelSelectedIds([...movingIds], nodes);
  const out: SVGGElement[] = [];
  for (const id of tops) {
    const el = scene.querySelector<SVGGElement>(`:scope > [data-node-id="${CSS.escape(id)}"]`);
    if (el) out.push(el);
  }
  return out;
}

function applySvgTranslate(el: SVGGElement, dx: number, dy: number): void {
  if (el.dataset.pcBaseSvgTransform == null) {
    el.dataset.pcBaseSvgTransform = el.getAttribute("transform") ?? "";
  }
  const base = el.dataset.pcBaseSvgTransform;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    if (base) el.setAttribute("transform", base);
    else el.removeAttribute("transform");
    return;
  }
  const suffix = `translate(${dx} ${dy})`;
  el.setAttribute("transform", base ? `${base} ${suffix}` : suffix);
}

function clearSvgTranslate(el: SVGGElement): void {
  const base = el.dataset.pcBaseSvgTransform ?? "";
  if (base) el.setAttribute("transform", base);
  else el.removeAttribute("transform");
  delete el.dataset.pcBaseSvgTransform;
}

export function applyDragPreview(movingIds: readonly string[], dx: number, dy: number): void {
  const prevIds = dragPreview?.movingIds ?? [];
  dragPreview = { dx, dy, movingIds: [...movingIds] };

  const nextSet = new Set(movingIds);
  const nextTops = new Set(topLevelSelectedIds([...movingIds], useEditorStore.getState().nodes));

  for (const el of svgDragRootGroups(prevIds)) {
    const id = el.getAttribute("data-node-id");
    if (id && nextTops.has(id)) continue;
    clearSvgTranslate(el);
  }

  for (const id of prevIds) {
    if (nextSet.has(id)) continue;
    if (!hasDom) continue;
    const el = document.querySelector<HTMLElement>(`[data-canvas-node="${CSS.escape(id)}"]`);
    if (!el) continue;
    const base = el.dataset.pcBaseTransform ?? "";
    if (base) el.style.transform = base;
    else el.style.removeProperty("transform");
    delete el.dataset.pcBaseTransform;
  }

  for (const el of nodeElements(movingIds)) {
    if (el.dataset.pcBaseTransform == null) {
      el.dataset.pcBaseTransform = el.style.transform || "";
    }
    const base = el.dataset.pcBaseTransform;
    const prefix = base ? `${base} ` : "";
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
      el.style.transform = base;
    } else {
      el.style.transform = `${prefix}translate(${dx}px, ${dy}px)`;
    }
  }

  for (const el of svgDragRootGroups(movingIds)) {
    applySvgTranslate(el, dx, dy);
  }

  notifyDragListeners();
}

export function clearDragPreview(): void {
  const ids = dragPreview?.movingIds ?? [];
  dragPreview = null;
  for (const el of nodeElements(ids)) {
    const base = el.dataset.pcBaseTransform ?? "";
    if (base) el.style.transform = base;
    else el.style.removeProperty("transform");
    delete el.dataset.pcBaseTransform;
  }
  for (const el of svgDragRootGroups(ids)) {
    clearSvgTranslate(el);
  }
  notifyDragListeners();
}

export function readDragPreviewDelta(): { dx: number; dy: number; movingIds: readonly string[] } {
  if (!dragPreview) return { dx: 0, dy: 0, movingIds: [] };
  return { dx: dragPreview.dx, dy: dragPreview.dy, movingIds: dragPreview.movingIds };
}

export function isCanvasNodeDragActive(): boolean {
  return Boolean(dragPreview?.movingIds.length);
}
