import { CANVAS_VIEWPORT_SELECTOR } from "@/lib/viewportZoom";

export type PanZoom = {
  pan: { x: number; y: number };
  zoom: number;
};

/** Client coordinates → viewport-local (px inside the viewport element). */
export function clientToViewport(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
): { x: number; y: number } {
  return { x: clientX - viewportRect.left, y: clientY - viewportRect.top };
}

/** Viewport-local → world (canvas) space. */
export function viewportToWorld(
  vx: number,
  vy: number,
  pan: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  return { x: (vx - pan.x) / zoom, y: (vy - pan.y) / zoom };
}

/** World (canvas) space → viewport-local pixels (screen-stable overlays). */
export function worldToViewport(
  worldX: number,
  worldY: number,
  pan: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  return { x: worldX * zoom + pan.x, y: worldY * zoom + pan.y };
}

/** Client → world using a known viewport rect and pan/zoom. */
export function clientToWorldFromRect(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  pan: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  const v = clientToViewport(clientX, clientY, viewportRect);
  return viewportToWorld(v.x, v.y, pan, zoom);
}

/** Client → world using a viewport element (or null → origin). */
export function clientToWorld(
  clientX: number,
  clientY: number,
  viewportEl: HTMLElement | null,
  { pan, zoom }: PanZoom,
): { x: number; y: number } {
  if (!viewportEl) return { x: 0, y: 0 };
  return clientToWorldFromRect(clientX, clientY, viewportEl.getBoundingClientRect(), pan, zoom);
}

/** Fallback when React context is unavailable (e.g. outside provider). */
export function clientToWorldFromDocument(
  clientX: number,
  clientY: number,
  panZoom: PanZoom,
): { x: number; y: number } {
  const el = document.querySelector<HTMLElement>(CANVAS_VIEWPORT_SELECTOR);
  return clientToWorld(clientX, clientY, el, panZoom);
}

/** Screen-pixel delta → world-space delta at the given zoom. */
export function screenDeltaToWorld(deltaPx: number, zoom: number): number {
  return deltaPx / zoom;
}
