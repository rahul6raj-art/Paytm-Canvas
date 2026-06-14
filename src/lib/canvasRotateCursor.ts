import type { ResizeHandle } from "@/lib/resize";
import { rotateGlyphSvg } from "@/lib/rotateHandleGlyph";

/** Always-visible fallback when custom rotate cursor cannot load. */
export const CANVAS_ROTATE_CURSOR_FALLBACK = "default";

const ROTATE_CURSOR_HOTSPOT = 16;
const ROTATE_CURSOR_SIZE = 32;

/** Base glyph bulges along this outward angle at 0° rotation (SE diagonal). */
const GLYPH_BULGE_OUTWARD_DEG = 45;

/** Flip arc so it opens toward the shape and arrows match drag direction. */
const GLYPH_ROTATION_FLIP_DEG = 180;

/** Outward angle from selection center to each local corner (unrotated, y-down canvas). */
const HANDLE_OUTWARD_DEG: Record<"nw" | "ne" | "se" | "sw", number> = {
  se: 45,
  sw: 135,
  nw: 225,
  ne: 315,
};

const TOP_OUTWARD_DEG = -90;

const cursorCssCache = new Map<number, string>();

function normalizeCursorAngle(deg: number): number {
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
}

/** Figma-style bidirectional quarter-arc rotate glyph (white outline, dark fill). */
function rotateCursorSvg(angleDeg: number): string {
  return rotateGlyphSvg({
    pixelSize: ROTATE_CURSOR_SIZE,
    angleDeg,
    variant: "cursor",
  });
}

function rotateCursorDataUrl(angleDeg: number): string | null {
  if (typeof globalThis.btoa !== "function") return null;
  try {
    const bytes = new TextEncoder().encode(rotateCursorSvg(angleDeg));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/svg+xml;base64,${globalThis.btoa(binary)}`;
  } catch {
    return null;
  }
}

/** Custom bidirectional arc cursor with grab fallback. */
export function rotateCursorCssForAngle(angleDeg: number): string {
  const key = Math.round(angleDeg);
  const cached = cursorCssCache.get(key);
  if (cached) return cached;

  const dataUrl = rotateCursorDataUrl(angleDeg);
  const css = dataUrl
    ? `url("${dataUrl}") ${ROTATE_CURSOR_HOTSPOT} ${ROTATE_CURSOR_HOTSPOT}, ${CANVAS_ROTATE_CURSOR_FALLBACK}`
    : CANVAS_ROTATE_CURSOR_FALLBACK;
  cursorCssCache.set(key, css);
  return css;
}

/** Align glyph so its arc bulges along `outwardDeg` (canvas coords, y-down). */
export function rotateCursorAngleFromOutward(outwardDeg: number): number {
  return normalizeCursorAngle(
    outwardDeg - GLYPH_BULGE_OUTWARD_DEG + GLYPH_ROTATION_FLIP_DEG,
  );
}

/** Cursor oriented from a world hit point outward from the selection pivot. */
export function rotateCursorCssForWorldOutward(
  hit: { x: number; y: number },
  center: { x: number; y: number },
): string {
  const outwardDeg =
    (Math.atan2(hit.y - center.y, hit.x - center.x) * 180) / Math.PI;
  return rotateCursorCssForAngle(rotateCursorAngleFromOutward(outwardDeg));
}

export function rotateCursorAngleForHandle(
  handle: ResizeHandle | "top",
  selectionRotationDeg = 0,
): number {
  const outward =
    handle === "top"
      ? TOP_OUTWARD_DEG
      : HANDLE_OUTWARD_DEG[handle as keyof typeof HANDLE_OUTWARD_DEG] ?? 45;
  return rotateCursorAngleFromOutward(outward + selectionRotationDeg);
}

export function rotateCursorCssForHandle(
  handle: ResizeHandle | "top",
  selectionRotationDeg = 0,
): string {
  return rotateCursorCssForAngle(rotateCursorAngleForHandle(handle, selectionRotationDeg));
}

/** Default rotate cursor (nw-corner orientation). */
export function canvasRotateCursorCss(): string {
  return rotateCursorCssForHandle("nw");
}

export const CANVAS_ROTATE_CURSOR = canvasRotateCursorCss();

export function canvasViewportRotateCursorCss(
  handle: ResizeHandle | "top" | null = null,
  selectionRotationDeg = 0,
): string {
  if (handle) return rotateCursorCssForHandle(handle, selectionRotationDeg);
  return canvasRotateCursorCss();
}

export function isRotateCursorActive(input: {
  transformInteractionMode: "none" | "resize" | "rotate";
  rotateHandleHovered: boolean;
}): boolean {
  return input.transformInteractionMode === "rotate" || input.rotateHandleHovered;
}
