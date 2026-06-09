import type { StrokePosition } from "@/stores/useEditorStore";

export type TaperProfile = "uniform" | "symmetric" | "start" | "end";

export type TaperedStrokeOptions = {
  /** Peak stroke width in px (center of path). */
  maxWidth: number;
  flipped?: boolean;
  position?: StrokePosition;
  /** Shape bounds for picking the inward side (inside/outside). */
  bounds?: { width: number; height: number };
  samples?: number;
  taperProfile?: TaperProfile;
};

/** Weight along path parameter t ∈ [0, 1]. */
export function taperWeightAlongPath(
  t: number,
  profile: TaperProfile = "symmetric",
  flipped?: boolean,
): number {
  const u = flipped ? 1 - t : t;
  if (profile === "uniform") return 1;
  if (profile === "symmetric") return Math.sin(Math.PI * u);
  if (profile === "start") return Math.cos((Math.PI * u) / 2);
  if (profile === "end") return Math.sin((Math.PI * u) / 2);
  return 1;
}

function perp(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 1 };
  return { x: -dy / len, y: dx / len };
}

function pickInwardNormal(
  nx: number,
  ny: number,
  px: number,
  py: number,
  bounds: { width: number; height: number },
): { x: number; y: number } {
  const cx = bounds.width / 2;
  const cy = bounds.height / 2;
  const toCenterX = cx - px;
  const toCenterY = cy - py;
  if (nx * toCenterX + ny * toCenterY < 0) return { x: -nx, y: -ny };
  return { x: nx, y: ny };
}

function pickOutwardNormal(
  nx: number,
  ny: number,
  px: number,
  py: number,
  bounds: { width: number; height: number },
): { x: number; y: number } {
  const inward = pickInwardNormal(nx, ny, px, py, bounds);
  return { x: -inward.x, y: -inward.y };
}

type SamplePoint = { x: number; y: number; t: number };

function samplePathElement(pathEl: SVGPathElement, count: number): SamplePoint[] | null {
  const len = pathEl.getTotalLength();
  if (!Number.isFinite(len) || len <= 0) return null;
  const n = Math.max(8, count);
  const out: SamplePoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = pathEl.getPointAtLength(t * len);
    out.push({ x: p.x, y: p.y, t });
  }
  return out;
}

function buildPolygonFromSamples(
  samples: SamplePoint[],
  maxWidth: number,
  opts: TaperedStrokeOptions,
): string | null {
  const n = samples.length;
  if (n < 2 || maxWidth <= 0) return null;

  const position = opts.position ?? "center";
  const bounds = opts.bounds;
  const left: string[] = [];
  const right: string[] = [];

  for (let i = 0; i < n; i++) {
    const p = samples[i]!;
    const tPrev = samples[Math.max(0, i - 1)]!;
    const tNext = samples[Math.min(n - 1, i + 1)]!;
    const dx = tNext.x - tPrev.x;
    const dy = tNext.y - tPrev.y;
    let { x: nx, y: ny } = perp(dx, dy);

    if (bounds && position === "inside") {
      const inward = pickInwardNormal(nx, ny, p.x, p.y, bounds);
      nx = inward.x;
      ny = inward.y;
    } else if (bounds && position === "outside") {
      const outward = pickOutwardNormal(nx, ny, p.x, p.y, bounds);
      nx = outward.x;
      ny = outward.y;
    }

    const w =
      maxWidth * taperWeightAlongPath(p.t, opts.taperProfile ?? "symmetric", opts.flipped);

    if (position === "inside" || position === "outside") {
      left.push(`${p.x},${p.y}`);
      right.push(`${p.x + nx * w},${p.y + ny * w}`);
    } else {
      left.push(`${p.x + nx * (w / 2)},${p.y + ny * (w / 2)}`);
      right.push(`${p.x - nx * (w / 2)},${p.y - ny * (w / 2)}`);
    }
  }

  if (position === "inside" || position === "outside") {
    return `M ${left[0]} L ${left.slice(1).join(" L ")} L ${right.reverse().join(" L ")} Z`;
  }
  return `M ${left[0]} L ${left.slice(1).join(" L ")} L ${right.reverse().join(" L ")} Z`;
}

/**
 * Build a filled SVG path that tapers stroke width toward both ends of an open path.
 * Requires DOM (browser); returns null when unavailable or path is invalid.
 */
export function buildTaperedStrokeFillD(
  pathD: string,
  options: TaperedStrokeOptions,
): string | null {
  if (typeof document === "undefined") return null;
  const maxWidth = Math.max(0, options.maxWidth);
  if (maxWidth <= 0) return null;

  const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathEl.setAttribute("d", pathD);
  const len = pathEl.getTotalLength();
  const sampleCount = options.samples ?? Math.min(96, Math.max(24, Math.ceil(len / 3)));
  const samples = samplePathElement(pathEl, sampleCount);
  if (!samples) return null;

  return buildPolygonFromSamples(samples, maxWidth, options);
}

export function shouldTaperPartialSideStroke(
  profile: "uniform" | "taper" | undefined,
): boolean {
  return profile !== "uniform";
}
