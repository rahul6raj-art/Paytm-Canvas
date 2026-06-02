import type { ResizeHandle } from "@/lib/resize";
import { screenPxToWorld } from "@/lib/canvasVisual";

/** Corner handles that support Figma-style rotate-from-corner. */
export const ROTATE_CORNER_HANDLES: ResizeHandle[] = ["nw", "ne", "se", "sw"];

/** Screen distance from corner along outward diagonal to the rotate hit zone center. */
export const CANVAS_ROTATE_ZONE_OFFSET_SCREEN_PX = 18;

/** Rotate hit target size in screen pixels. */
export const CANVAS_ROTATE_HIT_SCREEN_PX = 16;

/** Curved-arrow cursor (fallback `grab`). */
export const CANVAS_ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
    '<path d="M8 2.2A5.8 5.8 0 1 1 4.4 3.6" fill="none" stroke="%23111" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M2.8 2.8v2.6h2.6" fill="none" stroke="%23111" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>",
)}") 8 8, grab`;

export type RotateZone = {
  handle: ResizeHandle;
  x: number;
  y: number;
  size: number;
};

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
  const offset = screenPxToWorld(CANVAS_ROTATE_ZONE_OFFSET_SCREEN_PX, zoom);
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
  const offset = screenPxToWorld(CANVAS_ROTATE_ZONE_OFFSET_SCREEN_PX, zoom);
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
