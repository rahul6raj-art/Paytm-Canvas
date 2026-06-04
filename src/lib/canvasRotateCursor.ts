/** Always-visible fallback when custom rotate cursor cannot load. */
export const CANVAS_ROTATE_CURSOR_FALLBACK = "grab";

const ROTATE_CURSOR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
  '<path d="M8 2A6 6 0 1 1 4.5 4.2" fill="none" stroke="#111" stroke-width="1.5" stroke-linecap="round"/>' +
  '<path d="M3.2 4.8V7.5H5.9" fill="none" stroke="#111" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

const ROTATE_CURSOR_HOTSPOT = 8;

function rotateCursorDataUrl(): string | null {
  if (typeof globalThis.btoa !== "function") return null;
  try {
    const bytes = new TextEncoder().encode(ROTATE_CURSOR_SVG);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/svg+xml;base64,${globalThis.btoa(binary)}`;
  } catch {
    return null;
  }
}

/** Custom rotate arrow with grab fallback (invalid url() alone hides the pointer in Chromium). */
export function canvasRotateCursorCss(): string {
  const dataUrl = rotateCursorDataUrl();
  if (!dataUrl) return CANVAS_ROTATE_CURSOR_FALLBACK;
  return `url(${dataUrl}) ${ROTATE_CURSOR_HOTSPOT} ${ROTATE_CURSOR_HOTSPOT}, ${CANVAS_ROTATE_CURSOR_FALLBACK}`;
}

export const CANVAS_ROTATE_CURSOR = canvasRotateCursorCss();

export function canvasViewportRotateCursorCss(): string {
  return CANVAS_ROTATE_CURSOR_FALLBACK;
}

export function isRotateCursorActive(input: {
  transformInteractionMode: "none" | "resize" | "rotate";
  rotateHandleHoverCount: number;
}): boolean {
  return input.transformInteractionMode === "rotate" || input.rotateHandleHoverCount > 0;
}
