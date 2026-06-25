import {
  buildRoundedRectFillAndStrokePaths,
  buildRoundedRectPath,
  buildRoundedRectStrokePath,
  outlineRoundedRectRingPath,
} from "@/lib/vector/roundedRectPath";
import { analyzeRoundedRectPath } from "@/lib/vector/roundedRectPathDebug";

function pathShape(
  d: string,
  opts?: { stroke?: string; strokeWidth?: number; fill?: string },
): string {
  const fill = opts?.fill ?? "#e53935";
  const stroke = opts?.stroke ?? "#ffffff";
  const strokeWidth = opts?.strokeWidth ?? 8;
  const strokeAttrs =
    opts?.stroke === "none"
      ? 'fill="none"'
      : `fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"`;
  return `<path d="${d}" ${strokeAttrs}/>`;
}

/** Debug/story SVG comparing standard rx/ry vs Figma-like cubic rounded rects. */
export function buildRoundedRectVisualFixtureSvg(): string {
  const standardRect =
    '<rect x="0" y="0" width="140" height="100" rx="24" ry="24" fill="#e53935" stroke="#ffffff" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>';

  const smoothed = buildRoundedRectPath({
    width: 140,
    height: 100,
    radius: 24,
    smoothing: 0.6,
  });

  const largeRadius = buildRoundedRectPath({
    width: 140,
    height: 140,
    radius: 48,
    smoothing: 0,
  });

  const centerFillStroke = buildRoundedRectFillAndStrokePaths({
    width: 140,
    height: 100,
    radius: 24,
    smoothing: 0.6,
    strokeAlign: "center",
    strokeWidth: 8,
  });

  const insideFill = buildRoundedRectPath({
    width: 140,
    height: 100,
    radius: 24,
    smoothing: 0.6,
  });
  const insideStroke = buildRoundedRectStrokePath({
    width: 140,
    height: 100,
    radius: 24,
    smoothing: 0.6,
    strokeAlign: "inside",
    strokeWidth: 8,
  });

  const outsideFill = buildRoundedRectPath({
    width: 140,
    height: 100,
    radius: 24,
    smoothing: 0.6,
  });
  const outsideStroke = buildRoundedRectStrokePath({
    width: 140,
    height: 100,
    radius: 24,
    smoothing: 0.6,
    strokeAlign: "outside",
    strokeWidth: 8,
  });

  const mixed = buildRoundedRectPath({
    width: 160,
    height: 60,
    radius: { topLeft: 32, topRight: 8, bottomRight: 16, bottomLeft: 0 },
    smoothing: 0.6,
  });

  const regressionFill = buildRoundedRectPath({
    width: 300,
    height: 300,
    radius: 80,
    smoothing: 0,
  });
  const regressionRing = outlineRoundedRectRingPath(300, 300, 80, 20, "center", 0);

  const debug0Analysis = analyzeRoundedRectPath({ width: 140, height: 100, radius: 24, smoothing: 0 });
  const debug06Analysis = analyzeRoundedRectPath({ width: 140, height: 100, radius: 24, smoothing: 0.6 });

  const debugCell = (analysis: typeof debug0Analysis, label: string, offsetX: number) => `
  <g transform="translate(${offsetX}, 432)">
    <text x="0" y="-8" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="12">${label} · ${analysis.perimeterKinds.join("→")}</text>
    <path d="${analysis.d}" fill="#64748b" fill-opacity="0.35"/>
    <path d="${analysis.d}" fill="none" stroke="red" stroke-width="8" stroke-linejoin="round"/>
  </g>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="980" height="920" viewBox="0 0 980 920" fill="none">
  <rect width="980" height="560" fill="#111827"/>
  <text x="24" y="28" fill="#f8fafc" font-family="Inter, system-ui, sans-serif" font-size="14">Rounded rectangle stroke visual fixture</text>

  <g transform="translate(24,48)">
    <text x="0" y="-8" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="12">Standard SVG rx/ry</text>
    ${standardRect}
  </g>

  <g transform="translate(204,48)">
    <text x="0" y="-8" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="12">Figma-like smoothed</text>
    ${pathShape(smoothed)}
  </g>

  <g transform="translate(384,48)">
    <text x="0" y="-8" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="12">Center stroke</text>
    ${pathShape(centerFillStroke.fillPath, { fill: "#9e9e9e", stroke: "#ffffff", strokeWidth: 8 })}
  </g>

  <g transform="translate(564,48)">
    <text x="0" y="-8" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="12">Inside stroke</text>
    ${pathShape(insideFill, { fill: "#9e9e9e" })}
    ${pathShape(insideStroke, { fill: "none" })}
  </g>

  <g transform="translate(744,48)">
    <text x="0" y="-8" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="12">Outside stroke</text>
    ${pathShape(outsideFill, { fill: "#9e9e9e" })}
    ${pathShape(outsideStroke, { fill: "none" })}
  </g>

  <g transform="translate(24,220)">
    <text x="0" y="-8" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="12">Mixed corner radii</text>
    ${pathShape(mixed)}
  </g>

  <g transform="translate(220,220)">
    <text x="0" y="-8" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="12">Large radius</text>
    ${pathShape(largeRadius, { fill: "#e53935" })}
  </g>

  <g transform="translate(420,220)">
    <text x="0" y="-8" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="12">Regression: gray fill + white 20px center stroke, r=80</text>
    <path d="${regressionFill}" fill="#9e9e9e"/>
    <path d="${regressionRing!.pathD}" fill="#ffffff" fill-rule="${regressionRing!.fillRule}"/>
  </g>

  <text x="24" y="416" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="12">Path debug — fill + red stroke-width=8 + controls + segment flow</text>
  ${debugCell(debug0Analysis, "smoothing=0", 24)}
  ${debugCell(debug06Analysis, "smoothing=0.6", 260)}
</svg>
`;
}
