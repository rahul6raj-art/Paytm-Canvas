import type { RoundedRectPathParams } from "@/lib/vector/roundedRectPath";
import { buildRoundedRectPath } from "@/lib/vector/roundedRectPath";

export type PathSegmentKind = "M" | "L" | "H" | "V" | "C" | "A" | "Z";

export type ParsedPathSegment = {
  kind: PathSegmentKind;
  raw: string;
  relative: boolean;
  points: Array<{ x: number; y: number; role?: "anchor" | "control" }>;
};

export type RoundedRectPathAnalysis = {
  d: string;
  smoothing: number;
  closed: boolean;
  segments: ParsedPathSegment[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  touchesTop: boolean;
  touchesRight: boolean;
  touchesBottom: boolean;
  touchesLeft: boolean;
  hasHorizontalStraights: boolean;
  hasVerticalStraights: boolean;
  /** Ordered segment kinds for perimeter walk verification. */
  perimeterKinds: PathSegmentKind[];
};

function parseNumbers(raw: string): number[] {
  return raw
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
}

/** Parse SVG path `d` into segment records for debugging (absolute + relative). */
export function parsePathSegments(d: string): ParsedPathSegment[] {
  const tokens = d.match(/[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/g) ?? [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const segments: ParsedPathSegment[] = [];

  for (const token of tokens) {
    const cmd = token[0]!;
    const kind = cmd.toUpperCase() as PathSegmentKind;
    const relative = cmd === cmd.toLowerCase() && kind !== "Z";
    const nums = parseNumbers(token.slice(1));
    const points: ParsedPathSegment["points"] = [];

    if (kind === "M" || kind === "L") {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        cx = relative ? cx + nums[i]! : nums[i]!;
        cy = relative ? cy + nums[i + 1]! : nums[i + 1]!;
        if (kind === "M" && i === 0) {
          sx = cx;
          sy = cy;
        }
        points.push({ x: cx, y: cy, role: "anchor" });
      }
    } else if (kind === "H") {
      for (const x of nums) {
        cx = relative ? cx + x : x;
        points.push({ x: cx, y: cy, role: "anchor" });
      }
    } else if (kind === "V") {
      for (const y of nums) {
        cy = relative ? cy + y : y;
        points.push({ x: cx, y: cy, role: "anchor" });
      }
    } else if (kind === "C") {
      for (let i = 0; i + 5 < nums.length; i += 6) {
        const x1 = relative ? cx + nums[i]! : nums[i]!;
        const y1 = relative ? cy + nums[i + 1]! : nums[i + 1]!;
        const x2 = relative ? cx + nums[i + 2]! : nums[i + 2]!;
        const y2 = relative ? cy + nums[i + 3]! : nums[i + 3]!;
        cx = relative ? cx + nums[i + 4]! : nums[i + 4]!;
        cy = relative ? cy + nums[i + 5]! : nums[i + 5]!;
        points.push(
          { x: x1, y: y1, role: "control" },
          { x: x2, y: y2, role: "control" },
          { x: cx, y: cy, role: "anchor" },
        );
      }
    } else if (kind === "A") {
      for (let i = 0; i + 6 < nums.length; i += 7) {
        cx = relative ? cx + nums[i + 5]! : nums[i + 5]!;
        cy = relative ? cy + nums[i + 6]! : nums[i + 6]!;
        points.push({ x: cx, y: cy, role: "anchor" });
      }
    } else if (kind === "Z") {
      cx = sx;
      cy = sy;
    }

    segments.push({ kind, raw: token.trim(), relative, points });
  }

  return segments;
}

function collectAnchors(segments: ParsedPathSegment[]): Array<{ x: number; y: number }> {
  const anchors: Array<{ x: number; y: number }> = [];
  for (const seg of segments) {
    for (const p of seg.points) {
      if (p.role !== "control") anchors.push({ x: p.x, y: p.y });
    }
  }
  return anchors;
}

function walkAnchors(segments: ParsedPathSegment[]): Array<{ x: number; y: number }> {
  const anchors: Array<{ x: number; y: number }> = [];
  for (const seg of segments) {
    if (seg.kind === "Z") continue;
    for (const p of seg.points) {
      if (p.role === "anchor") anchors.push({ x: p.x, y: p.y });
    }
  }
  return anchors;
}

export function analyzeRoundedRectPath(
  params: RoundedRectPathParams,
  tolerance = 0.5,
): RoundedRectPathAnalysis {
  const d = buildRoundedRectPath(params);
  const segments = parsePathSegments(d);
  const anchors = collectAnchors(segments);
  const xs = anchors.map((p) => p.x);
  const ys = anchors.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const ox = params.origin?.x ?? 0;
  const oy = params.origin?.y ?? 0;
  const w = params.width;
  const h = params.height;

  const near = (value: number, target: number) => Math.abs(value - target) <= tolerance;

  return {
    d,
    smoothing: params.smoothing ?? 0,
    closed: d.trim().endsWith("Z"),
    segments,
    bounds: { minX, minY, maxX, maxY },
    touchesTop: anchors.some((p) => near(p.y, oy)),
    touchesRight: anchors.some((p) => near(p.x, ox + w)),
    touchesBottom: anchors.some((p) => near(p.y, oy + h)),
    touchesLeft: anchors.some((p) => near(p.x, ox)),
    hasHorizontalStraights: segments.some((s) => s.kind === "H"),
    hasVerticalStraights: segments.some((s) => s.kind === "V"),
    perimeterKinds: segments.map((s) => s.kind),
  };
}

/** Console log path geometry for side-by-side comparison (smoothing 0 vs smoothed). */
export function logRoundedRectPathComparison(
  params: Omit<RoundedRectPathParams, "smoothing">,
): { smoothing0: RoundedRectPathAnalysis; smoothing06: RoundedRectPathAnalysis } {
  const smoothing0 = analyzeRoundedRectPath({ ...params, smoothing: 0 });
  const smoothing06 = analyzeRoundedRectPath({ ...params, smoothing: 0.6 });

  for (const label of ["smoothing=0", "smoothing=0.6"] as const) {
    const analysis = label === "smoothing=0" ? smoothing0 : smoothing06;
    console.log(`\n── ${label} ──`);
    console.log("d:", analysis.d);
    console.log(
      "segments:",
      analysis.segments.map((s) => (s.relative ? s.kind.toLowerCase() : s.kind)).join(" → "),
    );
    console.log("bounds:", analysis.bounds);
    console.log("perimeter touch:", {
      top: analysis.touchesTop,
      right: analysis.touchesRight,
      bottom: analysis.touchesBottom,
      left: analysis.touchesLeft,
    });
  }

  return { smoothing0, smoothing06 };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function segmentDirectionMarkers(
  segments: ParsedPathSegment[],
  tx: number,
  ty: number,
): string[] {
  const markers: string[] = [];
  const walked = walkAnchors(segments);
  let prev = walked[0];
  if (!prev) return markers;

  for (let i = 1; i < walked.length; i++) {
    const cur = walked[i]!;
    const mx = (prev.x + cur.x) / 2 + tx;
    const my = (prev.y + cur.y) / 2 + ty;
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const ux = dx / len;
    const uy = dy / len;
    const ax = mx - ux * 6;
    const ay = my - uy * 6;
    markers.push(
      `<line x1="${ax}" y1="${ay}" x2="${mx}" y2="${my}" stroke="#22c55e" stroke-width="1.5" marker-end="url(#arrow)"/>`,
    );
    prev = cur;
  }
  return markers;
}

function controlPointGuides(
  segments: ParsedPathSegment[],
  tx: number,
  ty: number,
): { lines: string[]; controls: string[]; anchors: string[]; labels: string[] } {
  const lines: string[] = [];
  const controls: string[] = [];
  const anchors: string[] = [];
  const labels: string[] = [];
  const walked = walkAnchors(segments);
  let anchorIdx = 0;
  let prevAnchor = walked[0];

  for (const seg of segments) {
    if (seg.kind === "Z") continue;

    const label =
      seg.relative && seg.kind !== "M"
        ? seg.kind.toLowerCase()
        : seg.kind === "M"
          ? "M"
          : seg.kind;

    if (seg.kind === "H" || seg.kind === "V" || seg.kind === "L") {
      const p = seg.points[seg.points.length - 1];
      if (p) {
        labels.push(
          `<text x="${p.x + tx + 4}" y="${p.y + ty - 4}" fill="#94a3b8" font-size="10" font-family="monospace">${label}</text>`,
        );
      }
    } else {
      labels.push(
        `<text x="${seg.points[0]?.x ?? 0 + tx}" y="${(seg.points[0]?.y ?? 0) + ty - 6}" fill="#94a3b8" font-size="10" font-family="monospace">${label}</text>`,
      );
    }

    for (const p of seg.points) {
      const x = p.x + tx;
      const y = p.y + ty;
      if (p.role === "control") {
        controls.push(`<circle cx="${x}" cy="${y}" r="3" fill="#38bdf8"/>`);
        if (prevAnchor) {
          lines.push(
            `<line x1="${prevAnchor.x + tx}" y1="${prevAnchor.y + ty}" x2="${x}" y2="${y}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="3 2" opacity="0.7"/>`,
          );
        }
      } else {
        anchors.push(
          `<circle cx="${x}" cy="${y}" r="4" fill="#fbbf24" stroke="#0f172a" stroke-width="1"/>`,
        );
        prevAnchor = p;
        anchorIdx++;
      }
    }
  }

  return { lines, controls, anchors, labels };
}

/**
 * Debug SVG: gray fill, red 8px stroke on the **same** path `d`, plus anchor/control markers.
 */
export function buildRoundedRectDebugSvg(
  params: RoundedRectPathParams,
  opts?: { width?: number; height?: number; padding?: number },
): string {
  const analysis = analyzeRoundedRectPath(params);
  const pad = opts?.padding ?? 40;
  const viewW = (opts?.width ?? params.width) + pad * 2;
  const viewH = (opts?.height ?? params.height) + pad * 2 + 48;
  const ox = params.origin?.x ?? 0;
  const oy = params.origin?.y ?? 0;
  const tx = pad - ox;
  const ty = pad - oy;

  const guides = controlPointGuides(analysis.segments, tx, ty);
  const directions = segmentDirectionMarkers(analysis.segments, tx, ty);
  const dEscaped = escapeXml(analysis.d);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${viewW}" height="${viewH}" viewBox="0 0 ${viewW} ${viewH}">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L6,3 z" fill="#22c55e"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#0f172a"/>
  <g transform="translate(${tx}, ${ty})">
    <path d="${analysis.d}" fill="#64748b" fill-opacity="0.35"/>
    <path d="${analysis.d}" fill="none" stroke="red" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
    ${guides.lines.join("\n    ")}
    ${guides.controls.join("\n    ")}
    ${guides.anchors.join("\n    ")}
    ${guides.labels.join("\n    ")}
    ${directions.join("\n    ")}
  </g>
  <text x="12" y="20" fill="#e2e8f0" font-family="monospace" font-size="12">smoothing=${params.smoothing ?? 0} · closed=${analysis.closed} · perimeter=${analysis.perimeterKinds.join("→")}</text>
  <text x="12" y="36" fill="#94a3b8" font-family="monospace" font-size="10">yellow=anchors · blue=controls · green=segment direction · red=stroke perimeter</text>
  <foreignObject x="12" y="${viewH - 44}" width="${viewW - 24}" height="36">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#64748b;font:10px/1.3 monospace;word-break:break-all">${dEscaped}</div>
  </foreignObject>
</svg>`;
}

/** Side-by-side debug SVG comparing smoothing=0 and smoothing=0.6. */
export function buildRoundedRectComparisonDebugSvg(
  params: Omit<RoundedRectPathParams, "smoothing">,
): string {
  const left = analyzeRoundedRectPath({ ...params, smoothing: 0 });
  const right = analyzeRoundedRectPath({ ...params, smoothing: 0.6 });
  const pad = 32;
  const gap = 48;
  const cellW = params.width + pad * 2;
  const cellH = params.height + pad * 2 + 56;
  const totalW = cellW * 2 + gap;

  const cell = (analysis: RoundedRectPathAnalysis, label: string, offsetX: number) => {
    const tx = offsetX + pad;
    const ty = pad + 24;
    const guides = controlPointGuides(analysis.segments, tx, ty);
    const directions = segmentDirectionMarkers(analysis.segments, tx, ty);
    return `
  <g transform="translate(0, 0)">
    <text x="${tx}" y="16" fill="#e2e8f0" font-family="monospace" font-size="12">${label} · ${analysis.perimeterKinds.join("→")}</text>
    <g transform="translate(${tx}, ${ty})">
      <path d="${analysis.d}" fill="#64748b" fill-opacity="0.35"/>
      <path d="${analysis.d}" fill="none" stroke="red" stroke-width="8" stroke-linejoin="round"/>
      ${guides.lines.join("\n      ")}
      ${guides.controls.join("\n      ")}
      ${guides.anchors.join("\n      ")}
      ${directions.join("\n      ")}
    </g>
  </g>`;
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${cellH}" viewBox="0 0 ${totalW} ${cellH}">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L6,3 z" fill="#22c55e"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#0f172a"/>
  ${cell(left, "smoothing=0", 0)}
  ${cell(right, "smoothing=0.6", cellW + gap)}
</svg>`;
}

/** Write-ready debug export with fill path, stroke path, controls, and segment flow. */
export function buildRoundedRectFullDebugExport(
  params: RoundedRectPathParams,
): { analysis: RoundedRectPathAnalysis; svg: string } {
  const analysis = analyzeRoundedRectPath(params);
  return { analysis, svg: buildRoundedRectDebugSvg(params) };
}
