import { clamp01, hexToRgb, normalizeHex } from "@/lib/color";
import type { FillGradient, GradientKind, GradientStop, LegacyLinearFillGradient, PersistedFillGradient } from "./types";
import { defaultHandlesForKind, linearGradientAngleDeg, setLinearGradientAngle, setAngularGradientRefAngle, cssConicStartDeg, cssLinearAngleDeg } from "./handles";

export const DEFAULT_GRADIENT_TRANSFORM = {
  cx: 0.5,
  cy: 0.5,
  width: 1,
  height: 1,
  rotation: 180,
};

export function newGradientStopId(): string {
  return `gs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function sortStops(stops: GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.position - b.position);
}

export function gradientStopEffectiveOpacity(stop: GradientStop, globalOpacity = 1): number {
  return clamp01((stop.opacity ?? 1) * clamp01(globalOpacity));
}

export function defaultFillGradient(fromFill?: string, kind: GradientKind = "linear"): FillGradient {
  const base = fromFill ?? "#888888";
  const alt = "#000000";
  return {
    kind,
    transform: { ...DEFAULT_GRADIENT_TRANSFORM },
    handles: defaultHandlesForKind(kind),
    stops: [
      { id: newGradientStopId(), color: base, opacity: 1, position: 0 },
      { id: newGradientStopId(), color: alt, opacity: 1, position: 100 },
    ],
  };
}

export function normalizeFillGradient(
  g: FillGradient | LegacyLinearFillGradient | PersistedFillGradient | undefined,
  fallbackFill?: string,
): FillGradient {
  if (!g) return defaultFillGradient(fallbackFill);
  if ("type" in g && g.type === "linear" && !("kind" in g)) {
    const angle = g.angle ?? 180;
    const rad = (angle * Math.PI) / 180;
    const handles = defaultHandlesForKind("linear");
    handles[0] = { x: 0.5 - Math.cos(rad) * 0.5, y: 0.5 - Math.sin(rad) * 0.5 };
    handles[1] = { x: 0.5 + Math.cos(rad) * 0.5, y: 0.5 + Math.sin(rad) * 0.5 };
    return {
      kind: "linear",
      transform: { ...DEFAULT_GRADIENT_TRANSFORM, rotation: angle },
      handles,
      stops: g.stops.map((s) => ({
        id: s.id ?? newGradientStopId(),
        color: s.color,
        opacity: s.opacity ?? 1,
        position: s.position,
      })),
    };
  }
  const fg = g as FillGradient;
  const kind = fg.kind ?? "linear";
  return {
    kind,
    transform: fg.transform ?? { ...DEFAULT_GRADIENT_TRANSFORM },
    handles: fg.handles?.length === 3 ? fg.handles : defaultHandlesForKind(kind),
    stops: (fg.stops ?? []).map((s) => ({
      id: s.id ?? newGradientStopId(),
      color: s.color,
      opacity: s.opacity ?? 1,
      position: Math.max(0, Math.min(100, s.position)),
    })),
  };
}

export function cloneFillGradient(g: FillGradient): FillGradient {
  return {
    ...g,
    transform: { ...g.transform },
    handles: g.handles.map((h) => ({ ...h })) as FillGradient["handles"],
    stops: g.stops.map((s) => ({ ...s })),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function sampleStopColor(stops: GradientStop[], position: number): string {
  const sorted = sortStops(stops);
  if (sorted.length === 0) return "#888888";
  if (position <= sorted[0]!.position) return sorted[0]!.color;
  if (position >= sorted[sorted.length - 1]!.position) return sorted[sorted.length - 1]!.color;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (position >= a.position && position <= b.position) {
      const span = b.position - a.position || 1;
      const u = (position - a.position) / span;
      const ca = hexToRgb(a.color);
      const cb = hexToRgb(b.color);
      if (!ca || !cb) return a.color;
      const r = Math.round(lerp(ca.r, cb.r, u));
      const g = Math.round(lerp(ca.g, cb.g, u));
      const bl = Math.round(lerp(ca.b, cb.b, u));
      return normalizeHex(`#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`) ?? a.color;
    }
  }
  return sorted[0]!.color;
}

export function insertStopAtPosition(g: FillGradient, position: number): FillGradient {
  const pos = Math.round(Math.max(0, Math.min(100, position)) * 10) / 10;
  const color = sampleStopColor(g.stops, pos);
  const stops = sortStops([
    ...g.stops,
    { id: newGradientStopId(), color, opacity: 1, position: pos },
  ]);
  return { ...g, stops };
}

export function removeStop(g: FillGradient, stopId: string): FillGradient | null {
  if (g.stops.length <= 2) return null;
  return { ...g, stops: g.stops.filter((s) => s.id !== stopId) };
}

export function updateStop(
  g: FillGradient,
  stopId: string,
  patch: Partial<Pick<GradientStop, "color" | "opacity" | "position">>,
): FillGradient {
  const stops = g.stops.map((s) => (s.id === stopId ? { ...s, ...patch } : s));
  return { ...g, stops: sortStops(stops) };
}

/** Live drag — keep array order stable so ramp handles keep pointer capture. */
export function updateStopPreserveOrder(
  g: FillGradient,
  stopId: string,
  patch: Partial<Pick<GradientStop, "color" | "opacity" | "position">>,
): FillGradient {
  return { ...g, stops: g.stops.map((s) => (s.id === stopId ? { ...s, ...patch } : s)) };
}

export function changeGradientKind(g: FillGradient, kind: GradientKind): FillGradient {
  if (g.kind === kind) return g;
  return {
    ...g,
    kind,
    handles: defaultHandlesForKind(kind),
  };
}

export function setGradientAngle(g: FillGradient, angleDeg: number): FillGradient {
  const angle = ((angleDeg % 360) + 360) % 360;
  if (g.kind === "linear") {
    const handles = setLinearGradientAngle(g.handles, angle);
    return {
      ...g,
      handles,
      transform: { ...g.transform, rotation: angle },
    };
  }
  if (g.kind === "angular") {
    const handles = setAngularGradientRefAngle(g.handles, angle);
    return {
      ...g,
      handles,
      transform: { ...g.transform, rotation: angle },
    };
  }
  return g;
}

export function gradientAngleDeg(g: FillGradient): number {
  if (g.kind === "linear") return linearGradientAngleDeg(g.handles);
  if (g.kind === "angular") return Math.round(cssConicStartDeg(g.handles));
  return g.transform.rotation ?? 180;
}

/** Stable string for comparing gradient document state (inspector sync). */
export function gradientFingerprint(g: FillGradient | undefined): string {
  if (!g) return "";
  const n = normalizeFillGradient(g);
  return JSON.stringify({
    kind: n.kind,
    transform: n.transform,
    handles: n.handles,
    stops: sortStops(n.stops).map((s) => ({
      id: s.id,
      color: normalizeHex(s.color) ?? s.color,
      opacity: s.opacity ?? 1,
      position: s.position,
    })),
  });
}

export function reverseGradientStops(g: FillGradient): FillGradient {
  const stops = g.stops.map((s) => ({ ...s, position: 100 - s.position }));
  return { ...g, stops: sortStops(stops) };
}

export function effectiveFillType(node: {
  fillType?: string;
  fillGradient?: FillGradient;
  fillImageAssetId?: string;
  fillVideoAssetId?: string;
  fillPatternAssetId?: string;
}): FillType {
  if (node.fillType === "image") return "image";
  if (node.fillType === "video") return "video";
  if (node.fillType === "pattern" || node.fillPatternAssetId) return "pattern";
  if (node.fillType !== "gradient") return "solid";
  const stops = node.fillGradient?.stops;
  return stops && stops.length >= 2 ? "gradient" : "solid";
}

export function effectiveStrokeType(node: {
  strokeType?: string;
  strokeGradient?: FillGradient;
  strokeImageAssetId?: string;
  strokeVideoAssetId?: string;
}): FillType {
  if (node.strokeType === "image") return "image";
  if (node.strokeType === "video") return "video";
  if (node.strokeType !== "gradient") return "solid";
  const stops = node.strokeGradient?.stops;
  return stops && stops.length >= 2 ? "gradient" : "solid";
}

export function gradientKindUsesCssPaint(kind: GradientKind): boolean {
  return kind === "angular" || kind === "diamond";
}
