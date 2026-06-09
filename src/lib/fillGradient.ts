import { clamp01, fillCss, hexToRgb, normalizeHex } from "@/lib/color";
import type { EditorNode } from "@/stores/useEditorStore";

export type FillType = "solid" | "gradient";

export type GradientKind = "linear" | "radial" | "angular" | "diamond";

/** @deprecated v1 field — migrated to `kind` + `transform.rotation`. */
export type LegacyLinearFillGradient = {
  type: "linear";
  angle: number;
  stops: GradientStop[];
};

export interface GradientStop {
  id: string;
  color: string;
  /** 0–100 along the gradient axis / perimeter */
  position: number;
}

export interface GradientTransform {
  /** Normalized center within the shape (0–1). */
  cx: number;
  cy: number;
  /** Gradient extent relative to shape size (0–1). */
  width: number;
  height: number;
  /** Degrees — for linear: gradient direction; angular: start angle. */
  rotation: number;
}

export interface FillGradient {
  kind: GradientKind;
  transform: GradientTransform;
  stops: GradientStop[];
}

export const DEFAULT_GRADIENT_TRANSFORM: GradientTransform = {
  cx: 0.5,
  cy: 0.5,
  width: 1,
  height: 1,
  rotation: 180,
};

export function newGradientStopId(): string {
  return `gs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultFillGradient(fromFill?: string, kind: GradientKind = "linear"): FillGradient {
  const base = normalizeHex(fromFill ?? "#0d99ff") ?? "#0d99ff";
  const rotation = kind === "linear" ? 180 : kind === "angular" ? 0 : 0;
  return {
    kind,
    transform: { ...DEFAULT_GRADIENT_TRANSFORM, rotation },
    stops: [
      { id: newGradientStopId(), color: base, position: 0 },
      { id: newGradientStopId(), color: "#ffffff", position: 100 },
    ],
  };
}

function normalizeStop(s: GradientStop, fallbackColor: string): GradientStop {
  return {
    id: s.id || newGradientStopId(),
    color: normalizeHex(s.color) ?? fallbackColor,
    position: Math.min(100, Math.max(0, s.position)),
  };
}

function normalizeTransform(t: Partial<GradientTransform> | undefined, fallbackRotation: number): GradientTransform {
  return {
    cx: clamp01(t?.cx ?? 0.5),
    cy: clamp01(t?.cy ?? 0.5),
    width: Math.max(0.05, Math.min(2, t?.width ?? 1)),
    height: Math.max(0.05, Math.min(2, t?.height ?? 1)),
    rotation: Number.isFinite(t?.rotation) ? ((t!.rotation! % 360) + 360) % 360 : fallbackRotation,
  };
}

/** Migrate v1 `{ type:'linear', angle }` and normalize stops/transform. */
export function normalizeFillGradient(g: FillGradient | LegacyLinearFillGradient | undefined, fallbackFill?: string): FillGradient {
  const base = defaultFillGradient(fallbackFill);
  if (!g) return base;

  if ("type" in g && g.type === "linear" && !("kind" in g)) {
    const legacy = g as LegacyLinearFillGradient;
    const stops = (legacy.stops ?? [])
      .map((s) => normalizeStop({ ...s, id: (s as GradientStop).id ?? newGradientStopId() }, base.stops[0]!.color))
      .sort((a, b) => a.position - b.position);
    return {
      kind: "linear",
      transform: normalizeTransform({ rotation: legacy.angle ?? 180 }, legacy.angle ?? 180),
      stops: stops.length >= 2 ? stops : base.stops,
    };
  }

  const fg = g as FillGradient;
  const kind: GradientKind =
    fg.kind === "radial" || fg.kind === "angular" || fg.kind === "diamond" ? fg.kind : "linear";
  const stops = (fg.stops ?? [])
    .map((s) => normalizeStop(s, base.stops[0]!.color))
    .sort((a, b) => a.position - b.position);
  return {
    kind,
    transform: normalizeTransform(fg.transform, base.transform.rotation),
    stops: stops.length >= 2 ? stops : base.stops,
  };
}

export function effectiveFillType(node: Pick<EditorNode, "fillType" | "fillGradient">): FillType {
  if (node.fillType === "gradient") return "gradient";
  if (node.fillType === "solid") return "solid";
  return node.fillGradient ? "gradient" : "solid";
}

export type FillPaintNode = Pick<
  EditorNode,
  "fill" | "fillOpacity" | "fillEnabled" | "fillType" | "fillGradient"
>;

function stopCss(color: string, opacity: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  if (opacity >= 1 - 1e-6) return normalizeHex(color) ?? color;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`;
}

function stopsCssList(stops: GradientStop[], opacity: number): string {
  return stops.map((s) => `${stopCss(s.color, opacity)} ${s.position}%`).join(", ");
}

/** Linear endpoints in local shape coordinates. */
export function linearEndpoints(
  transform: GradientTransform,
  width: number,
  height: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const cx = transform.cx * w;
  const cy = transform.cy * h;
  const rad = ((transform.rotation - 90) * Math.PI) / 180;
  const len = Math.hypot(transform.width * w, transform.height * h) / 2;
  return {
    x1: cx - Math.cos(rad) * len,
    y1: cy - Math.sin(rad) * len,
    x2: cx + Math.cos(rad) * len,
    y2: cy + Math.sin(rad) * len,
  };
}

/** @deprecated use linearEndpoints */
export function gradientEndpoints(angleDeg: number, width: number, height: number) {
  return linearEndpoints(
    { ...DEFAULT_GRADIENT_TRANSFORM, rotation: angleDeg },
    width,
    height,
  );
}

/**
 * Horizontal inspector stop-bar preview — angle/transform do not rotate the bar
 * (Figma-style: stops left→right by position %; angle is edited separately).
 */
export function gradientInspectorBarPaintCss(g: FillGradient, opacity: number): string {
  const grad = normalizeFillGradient(g);
  const stops = stopsCssList(grad.stops, clamp01(opacity));
  switch (grad.kind) {
    case "radial":
      return `radial-gradient(ellipse 100% 100% at 50% 50%, ${stops})`;
    case "angular":
    case "diamond":
    case "linear":
    default:
      return `linear-gradient(to right, ${stops})`;
  }
}

export function fillPaintCss(node: FillPaintNode): string {
  if (node.fillEnabled === false) return "transparent";
  const opacity = clamp01(node.fillOpacity ?? 1);
  if (effectiveFillType(node) !== "gradient") {
    return fillCss(node.fill, opacity, true);
  }
  const g = normalizeFillGradient(node.fillGradient, node.fill);
  const stops = stopsCssList(g.stops, opacity);
  const t = g.transform;
  const at = `${t.cx * 100}% ${t.cy * 100}%`;

  switch (g.kind) {
    case "radial":
      return `radial-gradient(ellipse ${t.width * 100}% ${t.height * 100}% at ${at}, ${stops})`;
    case "angular":
      return `conic-gradient(from ${t.rotation}deg at ${at}, ${stops})`;
    case "diamond":
      return diamondCssBackground(g, opacity);
    case "linear":
    default:
      return `linear-gradient(${t.rotation}deg, ${stops})`;
  }
}

/** Bilinear diamond via layered CSS (canvas preview + export fallback). */
function diamondCssBackground(g: FillGradient, opacity: number): string {
  const s = g.stops;
  const c0 = stopCss(s[0]?.color ?? "#000", opacity);
  const c1 = stopCss(s[Math.floor(s.length / 2)]?.color ?? s[0]?.color ?? "#888", opacity);
  const c2 = stopCss(s[s.length - 1]?.color ?? "#fff", opacity);
  const t = g.transform;
  const cx = t.cx * 100;
  const cy = t.cy * 100;
  return [
    `radial-gradient(ellipse ${t.width * 70}% ${t.height * 70}% at ${cx}% ${cy}%, ${c0}, transparent 70%)`,
    `linear-gradient(${t.rotation + 45}deg, transparent, ${c1} 50%, transparent)`,
    `linear-gradient(${t.rotation - 45}deg, transparent, ${c2} 50%, transparent)`,
  ].join(", ");
}

function svgStopMarkup(stops: GradientStop[], opacity: number): string {
  return stops
    .map((s) => {
      const hex = normalizeHex(s.color) ?? s.color;
      return `<stop offset="${s.position}%" stop-color="${hex}" stop-opacity="${opacity}" />`;
    })
    .join("");
}

function svgTransformMatrix(t: GradientTransform, w: number, h: number): string {
  const cx = t.cx * w;
  const cy = t.cy * h;
  const rot = t.rotation;
  const sx = t.width;
  const sy = t.height;
  return `translate(${cx} ${cy}) rotate(${rot}) scale(${sx * w} ${sy * h}) translate(-0.5 -0.5)`;
}

/** Register SVG gradient in defs; returns fill attribute value (`url(#id)` or solid). */
export function svgFillPaint(
  node: FillPaintNode,
  opts: {
    gradientId: string;
    width: number;
    height: number;
    registerGradient: (id: string, markup: string) => void;
  },
): string {
  if (node.fillEnabled === false) return "none";
  if (effectiveFillType(node) !== "gradient") {
    return fillCss(node.fill, node.fillOpacity, true);
  }
  const g = normalizeFillGradient(node.fillGradient, node.fill);
  const w = Math.max(1, opts.width);
  const h = Math.max(1, opts.height);
  const opacity = clamp01(node.fillOpacity ?? 1);
  const stops = svgStopMarkup(g.stops, opacity);
  const id = opts.gradientId;

  switch (g.kind) {
    case "radial": {
      const t = g.transform;
      const markup = `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${t.cx * w}" cy="${t.cy * h}" rx="${(t.width * w) / 2}" ry="${(t.height * h) / 2}">${stops}</radialGradient>`;
      opts.registerGradient(id, markup);
      return `url(#${id})`;
    }
    case "angular": {
      const t = g.transform;
      const css = `conic-gradient(from ${t.rotation}deg at ${t.cx * 100}% ${t.cy * 100}%, ${stopsCssList(g.stops, opacity)})`;
      const foId = `${id}-fo`;
      opts.registerGradient(
        foId,
        `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"><foreignObject width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;background:${css};"></div></foreignObject></pattern>`,
      );
      return `url(#${id})`;
    }
    case "diamond": {
      const markup = buildDiamondSvgGradient(id, g, w, h, opacity);
      opts.registerGradient(id, markup);
      return `url(#${id})`;
    }
    case "linear":
    default: {
      const { x1, y1, x2, y2 } = linearEndpoints(g.transform, w, h);
      opts.registerGradient(
        id,
        `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`,
      );
      return `url(#${id})`;
    }
  }
}

/** Diamond gradient mesh (4-corner bilinear) as SVG pattern. */
function buildDiamondSvgGradient(id: string, g: FillGradient, w: number, h: number, opacity: number): string {
  const t = g.transform;
  const cx = t.cx * w;
  const cy = t.cy * h;
  const hw = (t.width * w) / 2;
  const hh = (t.height * h) / 2;
  const rad = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corner = (dx: number, dy: number) => ({
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  });
  const top = corner(0, -hh);
  const right = corner(hw, 0);
  const bottom = corner(0, hh);
  const left = corner(-hw, 0);
  const colors = g.stops.map((s) => normalizeHex(s.color) ?? s.color);
  const cTop = colors[0] ?? "#000";
  const cRight = colors[Math.floor(colors.length / 3)] ?? colors[0] ?? "#888";
  const cBottom = colors[Math.floor((2 * colors.length) / 3)] ?? colors[colors.length - 1] ?? "#ccc";
  const cLeft = colors[colors.length - 1] ?? "#fff";
  const meshId = `${id}-mesh`;
  return `<filter id="${meshId}" x="0" y="0" width="100%" height="100%"><feFlood flood-color="${cTop}" flood-opacity="${opacity}" result="t"/><feFlood flood-color="${cRight}" flood-opacity="${opacity}" result="r"/><feFlood flood-color="${cBottom}" flood-opacity="${opacity}" result="b"/><feFlood flood-color="${cLeft}" flood-opacity="${opacity}" result="l"/></filter><linearGradient id="${id}-g" x1="${left.x}" y1="${left.y}" x2="${right.x}" y2="${right.y}" gradientUnits="userSpaceOnUse">${svgStopMarkup(g.stops, opacity)}</linearGradient><pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"><polygon points="${top.x},${top.y} ${right.x},${right.y} ${bottom.x},${bottom.y} ${left.x},${left.y}" fill="url(#${id}-g)" /></pattern>`;
}

/** World/local helpers for on-canvas gradient editor. */
export function gradientStopLocalPoint(
  g: FillGradient,
  stop: GradientStop,
  width: number,
  height: number,
): { x: number; y: number } {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const t = g.transform;
  const cx = t.cx * w;
  const cy = t.cy * h;
  const p = stop.position / 100;

  switch (g.kind) {
    case "linear": {
      const { x1, y1, x2, y2 } = linearEndpoints(t, w, h);
      return { x: x1 + (x2 - x1) * p, y: y1 + (y2 - y1) * p };
    }
    case "radial": {
      const angle = p * Math.PI * 2;
      const rx = (t.width * w) / 2;
      return { x: cx + Math.cos(angle) * rx * p, y: cy + Math.sin(angle) * rx * p };
    }
    case "angular": {
      const angle = ((t.rotation + p * 360) * Math.PI) / 180;
      const r = Math.min(t.width * w, t.height * h) / 2;
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    }
    case "diamond": {
      const hw = (t.width * w) / 2;
      const hh = (t.height * h) / 2;
      const rad = (t.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const perimeter = p * 4;
      const seg = perimeter % 1;
      const edge = Math.floor(perimeter) % 4;
      const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
      const corners = [
        { x: 0, y: -hh },
        { x: hw, y: 0 },
        { x: 0, y: hh },
        { x: -hw, y: 0 },
      ];
      const a = corners[edge]!;
      const b = corners[(edge + 1) % 4]!;
      const lx = lerp(a.x, b.x, seg);
      const ly = lerp(a.y, b.y, seg);
      return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos };
    }
    default:
      return { x: cx, y: cy };
  }
}

export function gradientTransformHandleLocalPoints(
  g: FillGradient,
  width: number,
  height: number,
): { center: { x: number; y: number }; width: { x: number; y: number }; rotate: { x: number; y: number } } {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const t = g.transform;
  const cx = t.cx * w;
  const cy = t.cy * h;
  const rad = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = (t.width * w) / 2;
  return {
    center: { x: cx, y: cy },
    width: { x: cx + hw * cos, y: cy + hw * sin },
    rotate: { x: cx, y: cy - (t.height * h) / 2 - 16 },
  };
}

export function positionFromLocalPoint(g: FillGradient, x: number, y: number, width: number, height: number): number {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  if (g.kind === "linear") {
    const { x1, y1, x2, y2 } = linearEndpoints(g.transform, w, h);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = ((x - x1) * dx + (y - y1) * dy) / len2;
    return Math.min(100, Math.max(0, t * 100));
  }
  const t = g.transform;
  const cx = t.cx * w;
  const cy = t.cy * h;
  const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
  const rel = ((angle - t.rotation + 360) % 360) / 360;
  return Math.min(100, Math.max(0, rel * 100));
}

/** Resolved gradient for editing (includes linked gradient styles). */
export function resolveEditableFillGradient(
  node: FillPaintNode & { fillTokenId?: string },
  designTokens: Record<string, { type?: string; value?: unknown }>,
): FillGradient | null {
  if (effectiveFillType(node) !== "gradient") return null;
  const tok = node.fillTokenId ? designTokens[node.fillTokenId] : undefined;
  if (tok?.type === "gradient" && tok.value && typeof tok.value === "object") {
    return normalizeFillGradient(tok.value as FillGradient, node.fill);
  }
  return normalizeFillGradient(node.fillGradient, node.fill);
}

export function cloneFillGradient(g: FillGradient): FillGradient {
  const n = normalizeFillGradient(g);
  return {
    kind: n.kind,
    transform: { ...n.transform },
    stops: n.stops.map((s) => ({ ...s, id: newGradientStopId() })),
  };
}

export type StrokePaintNode = Pick<
  EditorNode,
  "strokeColor" | "strokeOpacity" | "strokeEnabled" | "strokeType" | "strokeGradient"
>;

export function effectiveStrokeType(node: StrokePaintNode): FillType {
  if (node.strokeType === "gradient") return "gradient";
  if (node.strokeType === "solid") return "solid";
  return node.strokeGradient ? "gradient" : "solid";
}

function strokeAsFillNode(node: StrokePaintNode): FillPaintNode {
  return {
    fill: node.strokeColor,
    fillOpacity: node.strokeOpacity,
    fillEnabled: node.strokeEnabled,
    fillType: effectiveStrokeType(node) === "gradient" ? "gradient" : "solid",
    fillGradient: node.strokeGradient,
  };
}

/** CSS background for stroke gradient preview (inspector). */
export function strokePaintCss(node: StrokePaintNode): string {
  if (node.strokeEnabled === false) return "transparent";
  return fillPaintCss(strokeAsFillNode(node));
}

/** Register SVG gradient in defs; returns stroke paint (`url(#id)` or solid). */
export function svgStrokePaint(
  node: StrokePaintNode,
  opts: {
    gradientId: string;
    width: number;
    height: number;
    registerGradient: (id: string, markup: string) => void;
  },
): string {
  if (node.strokeEnabled === false) return "none";
  return svgFillPaint(strokeAsFillNode(node), opts);
}

export function defaultStrokeGradient(fromColor?: string, kind: GradientKind = "linear"): FillGradient {
  return defaultFillGradient(fromColor ?? "#000000", kind);
}

export function normalizeStrokeGradient(
  g: FillGradient | LegacyLinearFillGradient | undefined,
  fallbackColor?: string,
): FillGradient {
  return normalizeFillGradient(g, fallbackColor);
}
