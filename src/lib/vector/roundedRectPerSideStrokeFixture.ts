import { buildRoundedRectBorderFills } from "@/lib/borderGeometry";
import {
  buildRoundedRectPath,
  outlineRoundedRectRingPath,
} from "@/lib/vector/roundedRectPath";
import { allStrokeSidesEnabled, type StrokeSideFlags } from "@/lib/vector/roundedRectStrokeSegments";

const W = 120;
const H = 80;
const R = 16;
const SMOOTHING = 0.6;
const STROKE = 6;

type FixtureCell = {
  label: string;
  strokeSides: StrokeSideFlags;
};

const CELLS: FixtureCell[] = [
  { label: "top + left", strokeSides: { top: true, right: false, bottom: false, left: true } },
  { label: "bottom + left", strokeSides: { top: false, right: false, bottom: true, left: true } },
  { label: "left only", strokeSides: { top: false, right: false, bottom: false, left: true } },
  { label: "right only", strokeSides: { top: false, right: true, bottom: false, left: false } },
  { label: "top + right", strokeSides: { top: true, right: true, bottom: false, left: false } },
  { label: "bottom + right", strokeSides: { top: false, right: true, bottom: true, left: false } },
  { label: "full stroke", strokeSides: { top: true, right: true, bottom: true, left: true } },
];

function renderCell(cell: FixtureCell, col: number, row: number): string {
  const x = 24 + col * 168;
  const y = 56 + row * 128;
  const fillPath = buildRoundedRectPath({
    width: W,
    height: H,
    radius: R,
    smoothing: SMOOTHING,
  });

  let strokeMarkup = "";
  if (allStrokeSidesEnabled(cell.strokeSides)) {
    const ring = outlineRoundedRectRingPath(W, H, R, STROKE, "center", SMOOTHING);
    if (ring) {
      strokeMarkup = `<path d="${ring.pathD}" fill="#ffffff" fill-rule="${ring.fillRule}"/>`;
    }
  } else {
    const fills = buildRoundedRectBorderFills({
      width: W,
      height: H,
      radii: [R, R, R, R],
      sides: cell.strokeSides,
      sideWidths: {
        top: cell.strokeSides.top ? STROKE : 0,
        right: cell.strokeSides.right ? STROKE : 0,
        bottom: cell.strokeSides.bottom ? STROKE : 0,
        left: cell.strokeSides.left ? STROKE : 0,
      },
      position: "center",
      smoothing: SMOOTHING,
    });
    strokeMarkup = fills
      .map((fill) => `<path d="${fill.pathD}" fill="#ffffff"/>`)
      .join("\n    ");
  }

  return `
  <g transform="translate(${x}, ${y})">
    <text x="0" y="-10" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="12">${cell.label}</text>
    <path d="${fillPath}" fill="#e53935"/>
    ${strokeMarkup}
  </g>`;
}

/** Visual fixture: red rounded rects with white per-side strokes (Figma-like). */
export function buildRoundedRectPerSideStrokeFixtureSvg(): string {
  const cells = CELLS.map((cell, i) => renderCell(cell, i % 4, Math.floor(i / 4))).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360" fill="none">
  <rect width="720" height="360" fill="#111827"/>
  <text x="24" y="28" fill="#f8fafc" font-family="Inter, system-ui, sans-serif" font-size="14">Rounded rectangle per-side stroke fixture</text>
${cells}
</svg>
`;
}
