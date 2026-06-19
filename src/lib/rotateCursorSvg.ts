/**
 * Rotate pointer cursor artwork from tldraw (MIT License).
 * Curved double-arrow with white outline — matches Figma / Sketch / tldraw UX.
 *
 * @see https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/hooks/useCursor.ts
 */

/** Filled glyph + even-odd white halo for contrast on any canvas background. */
const ROTATE_CORNER_PATHS =
  `<path d="M22.4789 9.45728L25.9935 12.9942L22.4789 16.5283V14.1032C18.126 14.1502 14.6071 17.6737 14.5675 22.0283H17.05L13.513 25.543L9.97889 22.0283H12.5674C12.6071 16.5691 17.0214 12.1503 22.4789 12.1031L22.4789 9.45728Z" fill="black"/>` +
  `<path fill-rule="evenodd" clip-rule="evenodd" d="M21.4789 7.03223L27.4035 12.9945L21.4789 18.9521V15.1868C18.4798 15.6549 16.1113 18.0273 15.649 21.0284H19.475L13.5128 26.953L7.55519 21.0284H11.6189C12.1243 15.8155 16.2679 11.6677 21.4789 11.1559L21.4789 7.03223ZM22.4789 12.1031C17.0214 12.1503 12.6071 16.5691 12.5674 22.0284H9.97889L13.513 25.543L17.05 22.0284H14.5675C14.5705 21.6896 14.5947 21.3558 14.6386 21.0284C15.1157 17.4741 17.9266 14.6592 21.4789 14.1761C21.8063 14.1316 22.1401 14.1069 22.4789 14.1032V16.5284L25.9935 12.9942L22.4789 9.45729L22.4789 12.1031Z" fill="white"/>`;

export const ROTATE_CURSOR_VIEW_SIZE = 32;
export const ROTATE_CURSOR_HOTSPOT = 16;

/** 32×32 SVG string for CSS `cursor: url(...)`. */
export function buildRotateCursorSvg(angleDeg: number): string {
  const r = Math.round(angleDeg * 10) / 10;
  const a = (-r * Math.PI) / 180;
  const dx = Math.cos(a) - Math.sin(a);
  const dy = Math.sin(a) + Math.cos(a);
  const paths = ROTATE_CORNER_PATHS.replaceAll('"', "'");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ROTATE_CURSOR_VIEW_SIZE}" height="${ROTATE_CURSOR_VIEW_SIZE}" viewBox="0 0 32 32">` +
    `<defs><filter id="shadow" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">` +
    `<feDropShadow dx="${dx.toFixed(2)}" dy="${dy.toFixed(2)}" stdDeviation="1.2" flood-opacity="0.5"/></filter></defs>` +
    `<g transform="rotate(${r} 16 16)" filter="url(#shadow)">${paths}</g></svg>`
  );
}
