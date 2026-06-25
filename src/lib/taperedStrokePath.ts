import {
  createJoinGeometry,
  mergeStrokePolygons,
  tessellateSvgPathD,
  type Point2,
} from "@/lib/outlineStroke";
import type { StrokeLinejoin } from "@/lib/stroke";
import { resolveStrokeLinejoin, resolveStrokeLinecap, resolveStrokeWidthProfile } from "@/lib/stroke";
import type { StrokePosition, EditorNode } from "@/stores/useEditorStore";

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
  taperStart?: number;
  taperEnd?: number;
  taperLengthStart?: number;
  taperLengthEnd?: number;
  join?: StrokeLinejoin;
};

export type ArcLengthSample = Point2 & {
  t: number;
  distanceFromStart: number;
  distanceFromEnd: number;
  totalLength: number;
};

export type ResolvedTaperConfig = {
  maxWidth: number;
  position: StrokePosition;
  bounds?: { width: number; height: number };
  join: StrokeLinejoin;
  taperStart: number;
  taperEnd: number;
  taperLengthStart: number;
  taperLengthEnd: number;
  useLegacyProfile: boolean;
  taperProfile: TaperProfile;
  flipped?: boolean;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (Math.abs(edge1 - edge0) < 1e-9) return x >= edge1 ? 1 : 0;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Weight along path parameter t ∈ [0, 1] (legacy width-profile curves). */
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

function leftNormal(dir: Point2): Point2 {
  return { x: dir.y, y: -dir.x };
}

function normalize(dir: Point2): Point2 {
  const len = Math.hypot(dir.x, dir.y);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: dir.x / len, y: dir.y / len };
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

function polylineBounds(points: readonly Point2[]): { width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function polylineArcLengthSamples(points: readonly Point2[]): ArcLengthSample[] {
  if (points.length < 2) return [];
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y),
    );
  }
  const totalLength = cumulative[cumulative.length - 1] ?? 0;
  return points.map((p, i) => ({
    x: p.x,
    y: p.y,
    t: totalLength > 1e-9 ? cumulative[i]! / totalLength : i / Math.max(1, points.length - 1),
    distanceFromStart: cumulative[i] ?? 0,
    distanceFromEnd: totalLength - (cumulative[i] ?? 0),
    totalLength,
  }));
}

export function resamplePolylineUniform(points: readonly Point2[], count: number): ArcLengthSample[] {
  const base = polylineArcLengthSamples(points);
  if (base.length < 2) return base;
  const totalLength = base[base.length - 1]!.totalLength;
  if (totalLength <= 1e-9) return base;

  const target = Math.max(8, count);
  const out: ArcLengthSample[] = [];
  let segment = 0;

  for (let i = 0; i < target; i++) {
    const distance = (i / (target - 1)) * totalLength;
    while (segment < base.length - 2 && base[segment + 1]!.distanceFromStart < distance) {
      segment++;
    }
    const a = base[segment]!;
    const b = base[segment + 1]!;
    const span = Math.max(1e-9, b.distanceFromStart - a.distanceFromStart);
    const u = clamp01((distance - a.distanceFromStart) / span);
    out.push({
      x: a.x + (b.x - a.x) * u,
      y: a.y + (b.y - a.y) * u,
      t: totalLength > 1e-9 ? distance / totalLength : i / (target - 1),
      distanceFromStart: distance,
      distanceFromEnd: totalLength - distance,
      totalLength,
    });
  }
  return out;
}

export function resolveStrokeTaperActive(
  node: Pick<
    EditorNode,
    | "strokeLinecap"
    | "strokeTaperStart"
    | "strokeTaperEnd"
    | "strokeWidthProfile"
  >,
): boolean {
  if (resolveStrokeLinecap(node) === "taper") return true;
  if ((node.strokeTaperStart ?? 0) > 0) return true;
  if ((node.strokeTaperEnd ?? 0) > 0) return true;
  if (resolveStrokeWidthProfile(node) === "taper") return true;
  return false;
}

export function resolveStrokeTaperConfig(
  node: Pick<
    EditorNode,
    | "strokeLinecap"
    | "strokeTaperStart"
    | "strokeTaperEnd"
    | "strokeTaperLengthStart"
    | "strokeTaperLengthEnd"
    | "strokeWidthProfile"
    | "strokeWidthProfileFlipped"
    | "strokePosition"
    | "strokeLinejoin"
  >,
  opts: { maxWidth: number; totalLength: number; bounds?: { width: number; height: number } },
): ResolvedTaperConfig {
  const maxWidth = Math.max(0, opts.maxWidth);
  const capTaper = resolveStrokeLinecap(node) === "taper";
  const profileTaper = resolveStrokeWidthProfile(node) === "taper";
  const explicitStart = node.strokeTaperStart;
  const explicitEnd = node.strokeTaperEnd;
  const taperStart = clamp01(explicitStart ?? (capTaper || profileTaper ? 1 : 0));
  const taperEnd = clamp01(explicitEnd ?? (capTaper || profileTaper ? 1 : 0));
  const defaultLength = Math.max(maxWidth * 2, opts.totalLength * 0.25);
  const useLegacyProfile =
    profileTaper &&
    explicitStart == null &&
    explicitEnd == null &&
    !capTaper;

  let taperProfile: TaperProfile = "symmetric";
  if (profileTaper && node.strokeWidthProfileFlipped) {
    taperProfile = "start";
  } else if (profileTaper) {
    taperProfile = "symmetric";
  }

  return {
    maxWidth,
    position: node.strokePosition ?? "center",
    bounds: opts.bounds,
    join: resolveStrokeLinejoin(node),
    taperStart,
    taperEnd,
    taperLengthStart: node.strokeTaperLengthStart ?? defaultLength,
    taperLengthEnd: node.strokeTaperLengthEnd ?? defaultLength,
    useLegacyProfile,
    taperProfile,
    flipped: node.strokeWidthProfileFlipped,
  };
}

export function taperWidthAtSample(sample: ArcLengthSample, config: ResolvedTaperConfig): number {
  if (config.maxWidth <= 0) return 0;

  if (config.useLegacyProfile) {
    return config.maxWidth * taperWeightAlongPath(sample.t, config.taperProfile, config.flipped);
  }

  let factor = 1;
  if (config.taperStart > 0) {
    const ramp = smoothstep(0, config.taperLengthStart, sample.distanceFromStart);
    factor *= (1 - config.taperStart) + config.taperStart * ramp;
  }
  if (config.taperEnd > 0) {
    const ramp = smoothstep(0, config.taperLengthEnd, sample.distanceFromEnd);
    factor *= (1 - config.taperEnd) + config.taperEnd * ramp;
  }
  return config.maxWidth * factor;
}

function offsetSideAtVariableVertex(
  points: readonly Point2[],
  index: number,
  delta: number,
  join: StrokeLinejoin,
): Point2 {
  const n = points.length;
  const curr = points[index]!;
  const prev = points[Math.max(0, index - 1)]!;
  const next = points[Math.min(n - 1, index + 1)]!;

  if (index === 0) {
    const e = normalize({ x: next.x - curr.x, y: next.y - curr.y });
    const normal = leftNormal(e);
    return { x: curr.x + normal.x * delta, y: curr.y + normal.y * delta };
  }
  if (index === n - 1) {
    const e = normalize({ x: curr.x - prev.x, y: curr.y - prev.y });
    const normal = leftNormal(e);
    return { x: curr.x + normal.x * delta, y: curr.y + normal.y * delta };
  }
  return createJoinGeometry(prev, curr, next, delta, join);
}

export function expandOpenPolylineTaperedStroke(
  samples: readonly ArcLengthSample[],
  config: ResolvedTaperConfig,
): Point2[] {
  const n = samples.length;
  if (n < 2 || config.maxWidth <= 0) return [];

  const points = samples.map((s) => ({ x: s.x, y: s.y }));
  const position = config.position;
  const bounds = config.bounds ?? polylineBounds(points);

  if (position === "inside" || position === "outside") {
    const centerline: Point2[] = [];
    const offset: Point2[] = [];
    for (let i = 0; i < n; i++) {
      const sample = samples[i]!;
      const width = taperWidthAtSample(sample, config);
      const prev = samples[Math.max(0, i - 1)]!;
      const next = samples[Math.min(n - 1, i + 1)]!;
      const dir = normalize({ x: next.x - prev.x, y: next.y - prev.y });
      const normal = leftNormal(dir);
      const inward = pickInwardNormal(normal.x, normal.y, sample.x, sample.y, bounds);
      const sideNormal = position === "inside" ? inward : { x: -inward.x, y: -inward.y };
      centerline.push({ x: sample.x, y: sample.y });
      offset.push({
        x: sample.x + sideNormal.x * width,
        y: sample.y + sideNormal.y * width,
      });
    }
    return mergeStrokePolygons([centerline, offset.slice().reverse()]);
  }

  const left: Point2[] = [];
  const right: Point2[] = [];
  for (let i = 0; i < n; i++) {
    const sample = samples[i]!;
    const width = taperWidthAtSample(sample, config);
    const half = width / 2;
    if (half < 1e-6) {
      left.push({ x: sample.x, y: sample.y });
      right.push({ x: sample.x, y: sample.y });
      continue;
    }
    left.push(offsetSideAtVariableVertex(points, i, half, config.join));
    right.push(offsetSideAtVariableVertex(points, i, -half, config.join));
  }

  return mergeStrokePolygons([left, right.slice().reverse()]);
}

function buildPolygonFromSamples(
  samples: ArcLengthSample[],
  config: ResolvedTaperConfig,
): string | null {
  const outline = expandOpenPolylineTaperedStroke(samples, config);
  if (outline.length < 3) return null;
  const [first, ...rest] = outline;
  return `M ${first!.x} ${first!.y} L ${rest.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`;
}

/**
 * Build a filled SVG path that tapers stroke width toward open-path endpoints.
 * Works without DOM by tessellating the source path locally.
 */
export function buildTaperedStrokeFillD(
  pathD: string,
  options: TaperedStrokeOptions,
): string | null {
  const maxWidth = Math.max(0, options.maxWidth);
  if (maxWidth <= 0) return null;

  const points = tessellateSvgPathD(pathD.trim(), 1.5);
  if (points.length < 2) return null;

  const arcSamples = polylineArcLengthSamples(points);
  const totalLength = arcSamples[arcSamples.length - 1]?.totalLength ?? 0;
  const sampleCount =
    options.samples ??
    Math.min(128, Math.max(16, Math.ceil(totalLength / Math.max(2, maxWidth / 2))));
  const samples = resamplePolylineUniform(points, sampleCount);

  const config: ResolvedTaperConfig = {
    maxWidth,
    position: options.position ?? "center",
    bounds: options.bounds,
    join: options.join ?? "round",
    taperStart: clamp01(options.taperStart ?? 0),
    taperEnd: clamp01(options.taperEnd ?? 0),
    taperLengthStart:
      options.taperLengthStart ?? Math.max(maxWidth * 2, totalLength * 0.25),
    taperLengthEnd:
      options.taperLengthEnd ?? Math.max(maxWidth * 2, totalLength * 0.25),
    useLegacyProfile: options.taperProfile != null && options.taperProfile !== "uniform",
    taperProfile: options.taperProfile ?? "symmetric",
    flipped: options.flipped,
  };

  if (!config.useLegacyProfile && config.taperStart <= 0 && config.taperEnd <= 0) {
    return null;
  }

  return buildPolygonFromSamples(samples, config);
}

export function buildTaperedOpenStrokeFromNode(
  node: Pick<
    EditorNode,
    | "width"
    | "height"
    | "strokeLinecap"
    | "strokeTaperStart"
    | "strokeTaperEnd"
    | "strokeTaperLengthStart"
    | "strokeTaperLengthEnd"
    | "strokeWidthProfile"
    | "strokeWidthProfileFlipped"
    | "strokePosition"
    | "strokeLinejoin"
    | "strokeWidth"
  >,
  pathD: string,
  closed = false,
): string | null {
  if (closed || !resolveStrokeTaperActive(node)) return null;
  const maxWidth = Math.max(0, node.strokeWidth ?? 0);
  if (maxWidth <= 0) return null;

  const points = tessellateSvgPathD(pathD.trim(), 1.5);
  if (points.length < 2) return null;

  const arcSamples = polylineArcLengthSamples(points);
  const totalLength = arcSamples[arcSamples.length - 1]?.totalLength ?? 0;
  const sampleCount = Math.min(128, Math.max(16, Math.ceil(totalLength / Math.max(2, maxWidth / 2))));
  const samples = resamplePolylineUniform(points, sampleCount);
  const config = resolveStrokeTaperConfig(node, {
    maxWidth,
    totalLength,
    bounds: { width: Math.max(1, node.width), height: Math.max(1, node.height) },
  });

  return buildPolygonFromSamples(samples, config);
}

export function shouldTaperPartialSideStroke(
  profile: "uniform" | "taper" | undefined,
): boolean {
  return profile !== "uniform";
}
