import type { ResizeHandle } from "@/lib/resize";

/** Always-visible fallback when custom rotate cursor cannot load. */
export const CANVAS_ROTATE_CURSOR_FALLBACK = "grab";

const ROTATE_CURSOR_HOTSPOT = 12;
const ROTATE_CURSOR_SIZE = 24;

/** Base glyph angle (deg) before adding selection rotation. */
const CORNER_CURSOR_BASE_DEG: Record<"nw" | "ne" | "se" | "sw", number> = {
  nw: 135,
  ne: 45,
  se: -45,
  sw: -135,
};

const TOP_ROTATE_CURSOR_BASE_DEG = 90;

const cursorCssCache = new Map<number, string>();

function rotateCursorSvg(angleDeg: number): string {
  const r = Math.round(angleDeg * 10) / 10;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ROTATE_CURSOR_SIZE}" height="${ROTATE_CURSOR_SIZE}" viewBox="0 0 24 24">` +
    `<g transform="translate(12,12) rotate(${r}) translate(-12,-12)">` +
    `<path d="M6.5 16.5 A9 9 0 0 1 16.5 6.5" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M6.5 16.5 A9 9 0 0 1 16.5 6.5" fill="none" stroke="#111" stroke-width="1.75" stroke-linecap="round"/>` +
    `<path d="M6.2 16.8 L4.1 14.4 L7.4 14.6 Z" fill="#111" stroke="#fff" stroke-width="0.8" stroke-linejoin="round"/>` +
    `<path d="M16.8 6.2 L19.1 8.5 L15.6 8.3 Z" fill="#111" stroke="#fff" stroke-width="0.8" stroke-linejoin="round"/>` +
    `</g></svg>`
  );
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
    ? `url(${dataUrl}) ${ROTATE_CURSOR_HOTSPOT} ${ROTATE_CURSOR_HOTSPOT}, ${CANVAS_ROTATE_CURSOR_FALLBACK}`
    : CANVAS_ROTATE_CURSOR_FALLBACK;
  cursorCssCache.set(key, css);
  return css;
}

export function rotateCursorCssForHandle(
  handle: ResizeHandle | "top",
  selectionRotationDeg = 0,
): string {
  const base =
    handle === "top"
      ? TOP_ROTATE_CURSOR_BASE_DEG
      : CORNER_CURSOR_BASE_DEG[handle as keyof typeof CORNER_CURSOR_BASE_DEG] ?? 0;
  return rotateCursorCssForAngle(base + selectionRotationDeg);
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
  rotateHandleHoverCount: number;
}): boolean {
  return input.transformInteractionMode === "rotate" || input.rotateHandleHoverCount > 0;
}
