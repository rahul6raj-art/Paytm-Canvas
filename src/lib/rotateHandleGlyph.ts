/** Shared Figma-style bidirectional quarter-arc rotate glyph (cursor + on-canvas handle). */

const GLYPH_CENTER = 12;
const ARC_RADIUS = 7.75;
const ARC_START = { x: 6.25, y: 17.75 };
const ARC_END = { x: 17.75, y: 6.25 };
const ARC_TANGENT_BACKWARD_DEG = 225;
const ARC_TANGENT_FORWARD_DEG = 45;

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function arrowHeadPath(tipX: number, tipY: number, dirDeg: number, len = 3.8, halfW = 2.25): string {
  const rad = (dirDeg * Math.PI) / 180;
  const backRad = rad + Math.PI;
  const bx = tipX + len * Math.cos(backRad);
  const by = tipY + len * Math.sin(backRad);
  const lx = bx + halfW * Math.cos(backRad + Math.PI / 2);
  const ly = by + halfW * Math.sin(backRad + Math.PI / 2);
  const rx = bx + halfW * Math.cos(backRad - Math.PI / 2);
  const ry = by + halfW * Math.sin(backRad - Math.PI / 2);
  return `M ${fmt(tipX)} ${fmt(tipY)} L ${fmt(lx)} ${fmt(ly)} L ${fmt(rx)} ${fmt(ry)} Z`;
}

export function rotateGlyphArcPath(): string {
  return `M ${ARC_START.x} ${ARC_START.y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${ARC_END.x} ${ARC_END.y}`;
}

export function rotateGlyphArrowPaths(): { start: string; end: string } {
  return {
    start: arrowHeadPath(ARC_START.x, ARC_START.y, ARC_TANGENT_BACKWARD_DEG),
    end: arrowHeadPath(ARC_END.x, ARC_END.y, ARC_TANGENT_FORWARD_DEG),
  };
}

export type RotateGlyphSvgOptions = {
  pixelSize: number;
  angleDeg?: number;
};

/** Inline SVG string for on-canvas rotate affordance (not the CSS cursor). */
export function rotateGlyphSvg({
  pixelSize,
  angleDeg = 0,
}: RotateGlyphSvgOptions): string {
  const arc = rotateGlyphArcPath();
  const arrows = rotateGlyphArrowPaths();
  const r = Math.round(angleDeg * 10) / 10;
  const transform = `translate(${GLYPH_CENTER},${GLYPH_CENTER}) rotate(${r}) translate(-${GLYPH_CENTER},-${GLYPH_CENTER})`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelSize}" height="${pixelSize}" viewBox="0 0 24 24">` +
    `<g transform="${transform}">` +
    `<path d="${arc}" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>` +
    `<path d="${arrows.start}" fill="currentColor" stroke="none"/>` +
    `<path d="${arrows.end}" fill="currentColor" stroke="none"/>` +
    `</g></svg>`
  );
}
