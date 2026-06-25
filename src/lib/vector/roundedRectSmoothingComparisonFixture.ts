import { buildRoundedRectSmoothingComparison } from "@/lib/vector/roundedRectSmoothingAnalysis";

/** Visual fixture: piecewise cubic+arc vs superellipse canvas path, same radius + stroke. */
export function buildRoundedRectSmoothingComparisonFixtureSvg(
  opts?: {
    width?: number;
    height?: number;
    radius?: number;
    smoothing?: number;
    strokeWidth?: number;
  },
): string {
  const width = opts?.width ?? 300;
  const height = opts?.height ?? 300;
  const radius = opts?.radius ?? 80;
  const smoothing = opts?.smoothing ?? 0.6;
  const strokeWidth = opts?.strokeWidth ?? 20;
  const comparison = buildRoundedRectSmoothingComparison({
    width,
    height,
    radius,
    smoothing,
  });

  const cell = (
    label: string,
    pathD: string,
    metrics: { verticalTangentY: number; transitionArcLength: number; peakCurvature: number },
    offsetX: number,
  ) => `
  <g transform="translate(${offsetX}, 72)">
    <text x="0" y="-12" fill="#e2e8f0" font-family="monospace" font-size="12">${label}</text>
    <text x="0" y="4" fill="#94a3b8" font-family="monospace" font-size="10">tangentY=${metrics.verticalTangentY.toFixed(1)} · transition=${metrics.transitionArcLength.toFixed(1)} · peak κ=${metrics.peakCurvature.toFixed(4)}</text>
    <path d="${pathD}" fill="#9e9e9e"/>
    <path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
    <path d="${pathD}" fill="none" stroke="#ef4444" stroke-width="2"/>
  </g>`;

  const totalW = width * 2 + 96;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height + 120}" viewBox="0 0 ${totalW} ${height + 120}">
  <rect width="100%" height="100%" fill="#111827"/>
  <text x="16" y="28" fill="#f8fafc" font-family="Inter, system-ui, sans-serif" font-size="14">Corner smoothing geometry — ${width}×${height}, r=${radius}, smoothing=${smoothing}, white stroke ${strokeWidth}px on same path</text>
  <text x="16" y="48" fill="#94a3b8" font-family="monospace" font-size="11">Left: legacy cubic+arc (flat tabletop controls) · Right: superellipse canvas path (gradual tangent taper)</text>
  ${cell("Piecewise cubic + arc", comparison.piecewisePath, comparison.piecewise, 16)}
  ${cell("Superellipse (canvas)", comparison.canvasPath, comparison.canvas, width + 48)}
</svg>`;
}

export function buildRoundedRectSmoothingMetricsReport(params: {
  width: number;
  height: number;
  radius: number;
  smoothing: number;
}): string {
  const comparison = buildRoundedRectSmoothingComparison(params);
  return JSON.stringify(
    {
      params: comparison.params,
      canvas: comparison.canvas,
      piecewise: comparison.piecewise,
      superellipse: comparison.superellipse,
      paths: {
        canvas: comparison.canvasPath,
        piecewise: comparison.piecewisePath,
        superellipse: comparison.superellipsePath,
        figmaReference: comparison.figmaReferencePath,
      },
    },
    null,
    2,
  );
}
