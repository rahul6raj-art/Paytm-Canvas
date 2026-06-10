import type { ResizeHandle } from "@/lib/resize";

/** Always-visible fallback when custom rotate cursor cannot load. */
export const CANVAS_ROTATE_CURSOR_FALLBACK = "grab";

const ROTATE_CURSOR_HOTSPOT = 12;
const ROTATE_CURSOR_SIZE = 24;

/** Quarter-arc radius in the 24×24 glyph (center 12,12). */
const ARC_RADIUS = 7.07;
const ARC_START = { x: 7, y: 17 };
const ARC_END = { x: 17, y: 7 };

/** Base glyph angle (deg) before adding selection rotation. */
const CORNER_CURSOR_BASE_DEG: Record<"nw" | "ne" | "se" | "sw", number> = {
  nw: 135,
  ne: 45,
  se: -45,
  sw: -135,
};

const TOP_ROTATE_CURSOR_BASE_DEG = 90;

const cursorCssCache = new Map<number, string>();

function arrowHeadPath(tipX: number, tipY: number, dirDeg: number): string {
  const rad = (dirDeg * Math.PI) / 180;
  const len = 3.6;
  const halfW = 2.15;
  const backRad = rad + Math.PI;
  const bx = tipX + len * Math.cos(backRad);
  const by = tipY + len * Math.sin(backRad);
  const lx = bx + halfW * Math.cos(backRad + Math.PI / 2);
  const ly = by + halfW * Math.sin(backRad + Math.PI / 2);
  const rx = bx + halfW * Math.cos(backRad - Math.PI / 2);
  const ry = by + halfW * Math.sin(backRad - Math.PI / 2);
  const f = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
  return `M ${f(tipX)} ${f(tipY)} L ${f(lx)} ${f(ly)} L ${f(rx)} ${f(ry)} Z`;
}

/** Figma-style bidirectional quarter-arc rotate glyph (white outline, dark fill). */
function rotateCursorSvg(angleDeg: number): string {
  const r = Math.round(angleDeg * 10) / 10;
  const arc = `M ${ARC_START.x} ${ARC_START.y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${ARC_END.x} ${ARC_END.y}`;
  const startArrow = arrowHeadPath(ARC_START.x, ARC_START.y, 225);
  const endArrow = arrowHeadPath(ARC_END.x, ARC_END.y, 315);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ROTATE_CURSOR_SIZE}" height="${ROTATE_CURSOR_SIZE}" viewBox="0 0 24 24">` +
    `<g transform="translate(12,12) rotate(${r}) translate(-12,-12)">` +
    `<path d="${arc}" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round"/>` +
    `<path d="${arc}" fill="none" stroke="#111111" stroke-width="1.35" stroke-linecap="round"/>` +
    `<path d="${startArrow}" fill="#111111" stroke="#ffffff" stroke-width="0.9" stroke-linejoin="round"/>` +
    `<path d="${endArrow}" fill="#111111" stroke="#ffffff" stroke-width="0.9" stroke-linejoin="round"/>` +
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
    ? `url("${dataUrl}") ${ROTATE_CURSOR_HOTSPOT} ${ROTATE_CURSOR_HOTSPOT}, ${CANVAS_ROTATE_CURSOR_FALLBACK}`
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
  rotateHandleHovered: boolean;
}): boolean {
  return input.transformInteractionMode === "rotate" || input.rotateHandleHovered;
}
