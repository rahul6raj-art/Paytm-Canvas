import type { ResizeHandle } from "@/lib/resize";
import { CANVAS_HANDLE_SCREEN_PX, screenPxToWorld } from "@/lib/canvasVisual";

/** Corner handles that support Figma-style rotate-from-corner. */
export const ROTATE_CORNER_HANDLES: ResizeHandle[] = ["nw", "ne", "se", "sw"];

/**
 * True when the pointer is on the outward half of a corner resize handle (rotate intent).
 * Pass `outwardScreen` (viewport px, center → corner) for rotated selections.
 */
export function pointerOnCornerHandleRotateHalf(
  handle: ResizeHandle,
  clientX: number,
  clientY: number,
  handleEl: HTMLElement,
  outwardScreen?: { x: number; y: number },
): boolean {
  if (!ROTATE_CORNER_HANDLES.includes(handle)) return false;
  const rect = handleEl.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;

  if (outwardScreen) {
    const len = Math.hypot(outwardScreen.x, outwardScreen.y);
    if (len < 1e-6) return false;
    const ux = outwardScreen.x / len;
    const uy = outwardScreen.y / len;
    const px = clientX - (rect.left + rect.width / 2);
    const py = clientY - (rect.top + rect.height / 2);
    return px * ux + py * uy > 0;
  }

  const lx = (clientX - rect.left) / rect.width;
  const ly = (clientY - rect.top) / rect.height;
  switch (handle) {
    case "nw":
      return lx < 0.5 && ly < 0.5;
    case "ne":
      return lx > 0.5 && ly < 0.5;
    case "se":
      return lx > 0.5 && ly > 0.5;
    case "sw":
      return lx < 0.5 && ly > 0.5;
    default:
      return false;
  }
}

/** Screen distance from top edge to the top-center rotate affordance. */
export const CANVAS_ROTATE_ZONE_OFFSET_SCREEN_PX = 16;

/** Gap past the corner resize handle to the rotate hit zone (screen px). */
export const CANVAS_ROTATE_CORNER_GAP_SCREEN_PX = 3;

/** Outward distance from shape corner to rotate zone center (past the square handle). */
export function rotateCornerZoneOffsetWorld(zoom: number): number {
  return screenPxToWorld(CANVAS_HANDLE_SCREEN_PX / 2 + CANVAS_ROTATE_CORNER_GAP_SCREEN_PX, zoom);
}

/** Rotate hit target size in screen pixels (tight corner target). */
export const CANVAS_ROTATE_HIT_SCREEN_PX = 18;

/** Thickness of rotate hit bands just outside selection edges (screen px). */
export const CANVAS_ROTATE_EDGE_BAND_THICKNESS_SCREEN_PX = 10;

/** Length of rotate hit bands along each edge from a corner (screen px). */
export const CANVAS_ROTATE_EDGE_BAND_LENGTH_SCREEN_PX = 22;

/** Screen-space vector from selection center toward a corner (for oriented hit tests). */
export function outwardScreenFromCorner(
  cornerX: number,
  cornerY: number,
  centerX: number,
  centerY: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: (cornerX - centerX) * zoom,
    y: (cornerY - centerY) * zoom,
  };
}

import {
  CANVAS_ROTATE_CURSOR_FALLBACK,
  canvasViewportRotateCursorCss,
  rotateCursorCssForHandle,
  rotateCursorCssForWorldOutward,
} from "@/lib/canvasRotateCursor";

export {
  rotateCursorCssForHandle,
  rotateCursorCssForWorldOutward,
} from "@/lib/canvasRotateCursor";

/** Corner vertex on axis-aligned overlay bounds. */
export function cornerOnOverlayBounds(
  handle: ResizeHandle,
  bounds: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  const { x, y, width, height } = bounds;
  switch (handle) {
    case "nw":
      return { x, y };
    case "ne":
      return { x: x + width, y };
    case "se":
      return { x: x + width, y: y + height };
    case "sw":
      return { x, y: y + height };
    default:
      return { x: x + width / 2, y: y + height / 2 };
  }
}

const CORNER_INDEX: Partial<Record<ResizeHandle, 0 | 1 | 2 | 3>> = {
  nw: 0,
  ne: 1,
  se: 2,
  sw: 3,
};

/** Hit point + pivot for orienting the rotate cursor from real geometry. */
export function rotateCursorGeometryForHandle(
  handle: ResizeHandle | "top",
  bounds: { x: number; y: number; width: number; height: number },
  zoom: number,
  worldCorners?: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] | null,
): { hit: { x: number; y: number }; center: { x: number; y: number } } {
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  if (handle === "top") {
    let topMid: { x: number; y: number } | undefined;
    if (worldCorners) {
      const [nw, ne] = worldCorners;
      topMid = { x: (nw.x + ne.x) / 2, y: (nw.y + ne.y) / 2 };
    }
    return { hit: topRotateHandleWorld(bounds, zoom, topMid), center };
  }
  const idx = CORNER_INDEX[handle];
  if (worldCorners && idx !== undefined) {
    return { hit: worldCorners[idx], center };
  }
  return { hit: cornerOnOverlayBounds(handle, bounds), center };
}

function canvasViewportEl(): HTMLElement | null {
  return document.querySelector("[data-canvas-viewport]") as HTMLElement | null;
}

/** Keep rotate cursor visible while dragging (viewport inline cursor overrides `body`). */
export function applyRotateDragCursor(
  captureEl?: HTMLElement | null,
  handle?: ResizeHandle | "top",
  selectionRotationDeg = 0,
  opts?: {
    hit?: { x: number; y: number };
    center?: { x: number; y: number };
  },
): void {
  const cursor =
    opts?.hit && opts?.center
      ? rotateCursorCssForWorldOutward(opts.hit, opts.center)
      : canvasViewportRotateCursorCss(handle ?? null, selectionRotationDeg);
  document.body.style.cursor = cursor;
  const viewport = canvasViewportEl();
  if (viewport) {
    viewport.style.cursor = cursor;
    viewport.setAttribute("data-rotate-active", "true");
  }
  if (captureEl) captureEl.style.cursor = cursor;
}

export function clearRotateDragCursor(captureEl?: HTMLElement | null): void {
  document.body.style.cursor = "";
  const viewport = canvasViewportEl();
  if (viewport) {
    viewport.style.cursor = "";
    viewport.removeAttribute("data-rotate-active");
  }
  if (captureEl) captureEl.style.cursor = "";
}

export type RotateZone = {
  handle: ResizeHandle;
  x: number;
  y: number;
  size: number;
};

/** L-shaped rotate hit target along edges outside a corner (Figma-style). */
export type RotateEdgeBand = {
  id: string;
  handle: ResizeHandle;
  x: number;
  y: number;
  width: number;
  height: number;
  /** CSS transform for oriented (rotated) selections. */
  transform?: string;
  transformOrigin?: string;
};

type Point = { x: number; y: number };

function outwardFromCenter(
  cornerX: number,
  cornerY: number,
  centerX: number,
  centerY: number,
  distance: number,
): { x: number; y: number } {
  const dx = cornerX - centerX;
  const dy = cornerY - centerY;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: cornerX, y: cornerY };
  return {
    x: cornerX + (dx / len) * distance,
    y: cornerY + (dy / len) * distance,
  };
}

/** Rotate zones outside each corner of an axis-aligned selection bounds. */
export function rotateZonesForAxisBounds(
  bounds: { x: number; y: number; width: number; height: number },
  zoom: number,
): RotateZone[] {
  const offset = rotateCornerZoneOffsetWorld(zoom);
  const size = screenPxToWorld(CANVAS_ROTATE_HIT_SCREEN_PX, zoom);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  const corners: { handle: ResizeHandle; x: number; y: number }[] = [
    { handle: "nw", x: bounds.x, y: bounds.y },
    { handle: "ne", x: bounds.x + bounds.width, y: bounds.y },
    { handle: "se", x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { handle: "sw", x: bounds.x, y: bounds.y + bounds.height },
  ];

  return corners.map(({ handle, x, y }) => {
    const p = outwardFromCenter(x, y, cx, cy, offset);
    return { handle, x: p.x, y: p.y, size };
  });
}

/** Rotate zones from world-space corner resize handle positions (rotated selection). */
export function rotateZonesForCornerHandles(
  handles: { handle: ResizeHandle; x: number; y: number }[],
  bounds: { x: number; y: number; width: number; height: number },
  zoom: number,
): RotateZone[] {
  const offset = rotateCornerZoneOffsetWorld(zoom);
  const size = screenPxToWorld(CANVAS_ROTATE_HIT_SCREEN_PX, zoom);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  return ROTATE_CORNER_HANDLES.map((handle) => {
    const h = handles.find((t) => t.handle === handle);
    if (!h) return null;
    const p = outwardFromCenter(h.x, h.y, cx, cy, offset);
    return { handle, x: p.x, y: p.y, size };
  }).filter((z): z is RotateZone => z != null);
}

function unit(dx: number, dy: number): Point {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

/** Unit normal pointing away from shape center (outside the box). */
function outwardNormal(
  edgeUx: number,
  edgeUy: number,
  fromX: number,
  fromY: number,
  centerX: number,
  centerY: number,
): Point {
  const perpA = { x: -edgeUy, y: edgeUx };
  const perpB = { x: edgeUy, y: -edgeUx };
  const toCenterX = centerX - fromX;
  const toCenterY = centerY - fromY;
  const dotA = perpA.x * toCenterX + perpA.y * toCenterY;
  return unit(dotA > 0 ? perpB.x : perpA.x, dotA > 0 ? perpB.y : perpA.y);
}

function bandAlongEdge(
  corner: Point,
  toward: Point,
  center: Point,
  length: number,
  thickness: number,
  handle: ResizeHandle,
  segment: string,
): RotateEdgeBand {
  const ux = toward.x - corner.x;
  const uy = toward.y - corner.y;
  const u = unit(ux, uy);
  const out = outwardNormal(u.x, u.y, corner.x, corner.y, center.x, center.y);
  const angleDeg = (Math.atan2(u.y, u.x) * 180) / Math.PI;
  const offsetX = out.x * thickness;
  const offsetY = out.y * thickness;
  return {
    id: `${handle}-${segment}`,
    handle,
    x: corner.x,
    y: corner.y,
    width: length,
    height: thickness,
    transform: `translate(${offsetX}px, ${offsetY}px) rotate(${angleDeg}deg)`,
    transformOrigin: "0 0",
  };
}

/** Rotate hit bands outside edges near each corner (axis-aligned bounds). */
export function rotateEdgeBandsForAxisBounds(
  bounds: { x: number; y: number; width: number; height: number },
  zoom: number,
): RotateEdgeBand[] {
  const thickness = screenPxToWorld(CANVAS_ROTATE_EDGE_BAND_THICKNESS_SCREEN_PX, zoom);
  const length = screenPxToWorld(CANVAS_ROTATE_EDGE_BAND_LENGTH_SCREEN_PX, zoom);
  const { x, y, width, height } = bounds;
  const r = x + width;
  const b = y + height;

  return [
    { id: "nw-top", handle: "nw", x, y: y - thickness, width: length, height: thickness },
    { id: "nw-left", handle: "nw", x: x - thickness, y, width: thickness, height: length },
    { id: "ne-top", handle: "ne", x: r - length, y: y - thickness, width: length, height: thickness },
    { id: "ne-right", handle: "ne", x: r, y, width: thickness, height: length },
    { id: "se-right", handle: "se", x: r, y: b - length, width: thickness, height: length },
    { id: "se-bottom", handle: "se", x: r - length, y: b, width: length, height: thickness },
    { id: "sw-bottom", handle: "sw", x, y: b, width: length, height: thickness },
    { id: "sw-left", handle: "sw", x: x - thickness, y: b - length, width: thickness, height: length },
  ];
}

/**
 * Rotate hit bands along edges outside corners (world-space corner positions).
 * Corner order: nw → ne → se → sw.
 */
export function rotateEdgeBandsForCorners(
  corners: { handle: ResizeHandle; x: number; y: number }[],
  bounds: { x: number; y: number; width: number; height: number },
  zoom: number,
): RotateEdgeBand[] {
  const thickness = screenPxToWorld(CANVAS_ROTATE_EDGE_BAND_THICKNESS_SCREEN_PX, zoom);
  const length = screenPxToWorld(CANVAS_ROTATE_EDGE_BAND_LENGTH_SCREEN_PX, zoom);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const center = { x: cx, y: cy };
  const byHandle = Object.fromEntries(corners.map((c) => [c.handle, c])) as Partial<
    Record<ResizeHandle, { x: number; y: number }>
  >;

  const nw = byHandle.nw;
  const ne = byHandle.ne;
  const se = byHandle.se;
  const sw = byHandle.sw;
  if (!nw || !ne || !se || !sw) return [];

  return [
    bandAlongEdge(nw, ne, center, length, thickness, "nw", "along-ne"),
    bandAlongEdge(nw, sw, center, length, thickness, "nw", "along-sw"),
    bandAlongEdge(ne, nw, center, length, thickness, "ne", "along-nw"),
    bandAlongEdge(ne, se, center, length, thickness, "ne", "along-se"),
    bandAlongEdge(se, ne, center, length, thickness, "se", "along-ne"),
    bandAlongEdge(se, sw, center, length, thickness, "se", "along-sw"),
    bandAlongEdge(sw, se, center, length, thickness, "sw", "along-se"),
    bandAlongEdge(sw, nw, center, length, thickness, "sw", "along-nw"),
  ];
}

/** World position for the top-center rotate affordance (above the top edge). */
export function topRotateHandleWorld(
  bounds: { x: number; y: number; width: number; height: number },
  zoom: number,
  topEdgeMid?: { x: number; y: number },
): { x: number; y: number } {
  const offset = screenPxToWorld(CANVAS_ROTATE_ZONE_OFFSET_SCREEN_PX, zoom);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const topMid = topEdgeMid ?? { x: cx, y: bounds.y };
  return outwardFromCenter(topMid.x, topMid.y, cx, cy, offset);
}
