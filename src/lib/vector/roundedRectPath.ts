/** Figma-like rounded rectangle paths using cubic Bézier curves. */

export const KAPPA = 0.5522847498;

export type RoundedRectRadii = {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
};

export type RoundedRectPathParams = {
  width: number;
  height: number;
  radius: number | RoundedRectRadii;
  /** 0 = circular corners, 1 = maximum Figma-style smoothing. Default 0. */
  smoothing?: number;
  origin?: { x: number; y: number };
};

export type StrokeAlign = "center" | "inside" | "outside";

export type RoundedRectStrokePathParams = RoundedRectPathParams & {
  strokeAlign: StrokeAlign;
  strokeWidth: number;
};

export type RoundedRectFillStrokePaths = {
  fillPath: string;
  strokePath: string;
};

const EPS = 1e-9;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function fmt(n: number): string {
  const v = Math.abs(n) < 1e-6 ? 0 : n;
  return Number(v.toFixed(4)).toString();
}

export function normalizeRoundedRectRadii(radius: number | RoundedRectRadii): RoundedRectRadii {
  if (typeof radius === "number") {
    const r = Math.max(0, radius);
    return { topLeft: r, topRight: r, bottomRight: r, bottomLeft: r };
  }
  return {
    topLeft: Math.max(0, radius.topLeft),
    topRight: Math.max(0, radius.topRight),
    bottomRight: Math.max(0, radius.bottomRight),
    bottomLeft: Math.max(0, radius.bottomLeft),
  };
}

/** Clamp per-corner radii so adjacent corners never overlap (CSS corner overlap). */
export function clampRoundedRectRadii(
  radii: RoundedRectRadii,
  width: number,
  height: number,
): RoundedRectRadii {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  if (w <= 0 || h <= 0) {
    return { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
  }

  let { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl } = radii;
  const top = tl + tr;
  const bottom = bl + br;
  const left = tl + bl;
  const right = tr + br;
  let f = 1;
  if (top > w) f = Math.min(f, w / top);
  if (bottom > w) f = Math.min(f, w / bottom);
  if (left > h) f = Math.min(f, h / left);
  if (right > h) f = Math.min(f, h / right);
  if (f < 1) {
    tl *= f;
    tr *= f;
    br *= f;
    bl *= f;
  }
  return { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl };
}

function radiiTuple(radii: RoundedRectRadii): [number, number, number, number] {
  return [radii.topLeft, radii.topRight, radii.bottomRight, radii.bottomLeft];
}

type CornerKey = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

type NormalizedCorner = { radius: number; budget: number };

/** Figma squircle edge budget distribution (figma-squircle/distribute.ts). */
export function distributeRoundedRectCornerBudgets(
  width: number,
  height: number,
  radii: RoundedRectRadii,
): Record<CornerKey, NormalizedCorner> {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const radiusMap: Record<CornerKey, number> = {
    topLeft: radii.topLeft,
    topRight: radii.topRight,
    bottomRight: radii.bottomRight,
    bottomLeft: radii.bottomLeft,
  };
  const budgetMap: Record<CornerKey, number> = {
    topLeft: -1,
    topRight: -1,
    bottomRight: -1,
    bottomLeft: -1,
  };

  const adjacents: Record<CornerKey, Array<{ corner: CornerKey; side: "top" | "right" | "bottom" | "left" }>> = {
    topLeft: [
      { corner: "topRight", side: "top" },
      { corner: "bottomLeft", side: "left" },
    ],
    topRight: [
      { corner: "topLeft", side: "top" },
      { corner: "bottomRight", side: "right" },
    ],
    bottomRight: [
      { corner: "bottomLeft", side: "bottom" },
      { corner: "topRight", side: "right" },
    ],
    bottomLeft: [
      { corner: "bottomRight", side: "bottom" },
      { corner: "topLeft", side: "left" },
    ],
  };

  const corners = (Object.keys(radiusMap) as CornerKey[]).sort(
    (a, b) => radiusMap[b]! - radiusMap[a]!,
  );

  for (const corner of corners) {
    const radius = radiusMap[corner]!;
    const budget = Math.min(
      ...adjacents[corner].map(({ corner: adjacent, side }) => {
        const adjacentRadius = radiusMap[adjacent]!;
        if (radius === 0 && adjacentRadius === 0) return 0;
        const sideLength = side === "top" || side === "bottom" ? w : h;
        const adjacentBudget = budgetMap[adjacent];
        if (adjacentBudget >= 0) {
          return sideLength - adjacentBudget;
        }
        return (radius / (radius + adjacentRadius)) * sideLength;
      }),
    );
    budgetMap[corner] = budget;
    radiusMap[corner] = Math.min(radius, budget);
  }

  return {
    topLeft: { radius: radiusMap.topLeft, budget: budgetMap.topLeft },
    topRight: { radius: radiusMap.topRight, budget: budgetMap.topRight },
    bottomRight: { radius: radiusMap.bottomRight, budget: budgetMap.bottomRight },
    bottomLeft: { radius: radiusMap.bottomLeft, budget: budgetMap.bottomLeft },
  };
}

type CornerPathParams = {
  a: number;
  b: number;
  c: number;
  d: number;
  p: number;
  arcSectionLength: number;
  cornerRadius: number;
};

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Figma squircle params (figma-squircle / Figma blog fig. 11–12). */
function cornerPathParams(
  cornerRadius: number,
  cornerSmoothing: number,
  roundingBudget: number,
  width: number,
  height: number,
): CornerPathParams {
  const r = Math.max(0, cornerRadius);
  let s = clamp(cornerSmoothing, 0, 1);
  let p = (1 + s) * r;
  if (p > roundingBudget + EPS) {
    s = Math.max(0, roundingBudget / Math.max(r, EPS) - 1);
    p = Math.min(p, roundingBudget);
  }

  const shortest = Math.min(Math.max(0, width), Math.max(0, height));
  let arcMeasureDeg = 90 * (1 - s);
  let angleBetaDeg = 45 * s;
  if (r > shortest / 4 + EPS) {
    const change = (r - shortest / 4) / Math.max(shortest / 4, EPS);
    arcMeasureDeg = 90 * (1 - s * (1 - change));
    angleBetaDeg = 45 * s * (1 - change);
  }

  const arcSectionLength =
    Math.sin(toRad(arcMeasureDeg / 2)) * r * Math.SQRT2;
  const angleAlpha = (90 - arcMeasureDeg) / 2;
  const p3ToP4Distance = r * Math.tan(toRad(angleAlpha / 2));
  const cLen = p3ToP4Distance * Math.cos(toRad(angleBetaDeg));
  const dLen = cLen * Math.tan(toRad(angleBetaDeg));

  let bLen = (p - arcSectionLength - cLen - dLen) / 3;
  let aLen = 2 * bLen;
  if (aLen < 0 || bLen < 0) {
    aLen = 0;
    bLen = 0;
  }

  return {
    a: aLen,
    b: bLen,
    c: cLen,
    d: dLen,
    p,
    arcSectionLength,
    cornerRadius: r,
  };
}

function drawSquircleTopRight(pp: CornerPathParams): string {
  if (pp.cornerRadius <= EPS) return `l ${fmt(pp.p)} 0`;
  return [
    `c ${fmt(pp.a)} 0 ${fmt(pp.a + pp.b)} 0 ${fmt(pp.a + pp.b + pp.c)} ${fmt(pp.d)}`,
    `a ${fmt(pp.cornerRadius)} ${fmt(pp.cornerRadius)} 0 0 1 ${fmt(pp.arcSectionLength)} ${fmt(pp.arcSectionLength)}`,
    `c ${fmt(pp.d)} ${fmt(pp.c)} ${fmt(pp.d)} ${fmt(pp.b + pp.c)} ${fmt(pp.d)} ${fmt(pp.a + pp.b + pp.c)}`,
  ].join(" ");
}

function drawSquircleBottomRight(pp: CornerPathParams): string {
  if (pp.cornerRadius <= EPS) return `l 0 ${fmt(pp.p)}`;
  return [
    `c 0 ${fmt(pp.a)} 0 ${fmt(pp.a + pp.b)} ${fmt(-pp.d)} ${fmt(pp.a + pp.b + pp.c)}`,
    `a ${fmt(pp.cornerRadius)} ${fmt(pp.cornerRadius)} 0 0 1 ${fmt(-pp.arcSectionLength)} ${fmt(pp.arcSectionLength)}`,
    `c ${fmt(-pp.c)} ${fmt(pp.d)} ${fmt(-(pp.b + pp.c))} ${fmt(pp.d)} ${fmt(-(pp.a + pp.b + pp.c))} ${fmt(pp.d)}`,
  ].join(" ");
}

function drawSquircleBottomLeft(pp: CornerPathParams): string {
  if (pp.cornerRadius <= EPS) return `l ${fmt(-pp.p)} 0`;
  return [
    `c ${fmt(-pp.a)} 0 ${fmt(-(pp.a + pp.b))} 0 ${fmt(-(pp.a + pp.b + pp.c))} ${fmt(-pp.d)}`,
    `a ${fmt(pp.cornerRadius)} ${fmt(pp.cornerRadius)} 0 0 1 ${fmt(-pp.arcSectionLength)} ${fmt(-pp.arcSectionLength)}`,
    `c ${fmt(-pp.d)} ${fmt(-pp.c)} ${fmt(-pp.d)} ${fmt(-(pp.b + pp.c))} ${fmt(-pp.d)} ${fmt(-(pp.a + pp.b + pp.c))}`,
  ].join(" ");
}

function drawSquircleTopLeft(pp: CornerPathParams): string {
  if (pp.cornerRadius <= EPS) return `l 0 ${fmt(-pp.p)}`;
  return [
    `c 0 ${fmt(-pp.a)} 0 ${fmt(-(pp.a + pp.b))} ${fmt(pp.d)} ${fmt(-(pp.a + pp.b + pp.c))}`,
    `a ${fmt(pp.cornerRadius)} ${fmt(pp.cornerRadius)} 0 0 1 ${fmt(pp.arcSectionLength)} ${fmt(-pp.arcSectionLength)}`,
    `c ${fmt(pp.c)} ${fmt(-pp.d)} ${fmt(pp.b + pp.c)} ${fmt(-pp.d)} ${fmt(pp.a + pp.b + pp.c)} ${fmt(-pp.d)}`,
  ].join(" ");
}

function sideJoin(length: number, extent: number): number {
  const half = length / 2;
  if (extent <= half + EPS) return extent;
  return half;
}

export { sideJoin };

/** Lamé exponent for superellipse corners: n=2 circle, higher n = more Figma-like taper. */
export function superellipseExponentFromSmoothing(smoothing: number): number {
  const s = clamp(smoothing, 0, 1);
  if (s <= EPS) return 2;
  return 2 + 2 * s;
}

type Point2 = { x: number; y: number };

function superellipseCornerPoints(extent: number, exponent: number, segments: number): Point2[] {
  const p = Math.max(0, extent);
  const n = Math.max(2, exponent);
  const count = Math.max(4, segments);
  const pts: Point2[] = [];
  for (let i = 0; i <= count; i++) {
    const theta = (i / count) * (Math.PI / 2);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    pts.push({
      x: p * (1 - Math.pow(Math.abs(c), 2 / n)),
      y: p * Math.pow(Math.abs(s), 2 / n),
    });
  }
  return pts;
}

function catmullRomOpenPathD(points: Point2[]): string {
  if (points.length < 2) return "";
  const parts: string[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6,
    };
    const c2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6,
    };
    parts.push(
      `C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(p2.x)} ${fmt(p2.y)}`,
    );
  }
  return parts.join(" ");
}

/** Open path with cubic segments through sampled contour points (same smoothing as fill path). */
export function openPathFromPoints(points: Point2[]): string {
  if (points.length === 0) return "";
  const start = points[0]!;
  if (points.length === 1) return `M ${fmt(start.x)} ${fmt(start.y)}`;
  if (points.length === 2) {
    const end = points[1]!;
    return `M ${fmt(start.x)} ${fmt(start.y)} L ${fmt(end.x)} ${fmt(end.y)}`;
  }
  return `M ${fmt(start.x)} ${fmt(start.y)} ${catmullRomOpenPathD(points)}`;
}

function mapTopRightCorner(points: Point2[], ox: number, oy: number, width: number, extent: number): Point2[] {
  return points.map((p) => ({ x: ox + width - extent + p.x, y: oy + p.y }));
}

function mapBottomRightCorner(points: Point2[], ox: number, oy: number, width: number, height: number, extent: number): Point2[] {
  return points.map((p) => ({ x: ox + width - p.y, y: oy + height - extent + p.x }));
}

function mapBottomLeftCorner(points: Point2[], ox: number, oy: number, height: number, extent: number): Point2[] {
  return points.map((p) => ({ x: ox + extent - p.x, y: oy + height - p.y }));
}

function mapTopLeftCorner(points: Point2[], ox: number, oy: number, extent: number): Point2[] {
  return points.map((p) => ({ x: ox + p.y, y: oy + extent - p.x }));
}

export type RoundedRectCorner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

export type CornerPolylinePortion = "full" | "first" | "second";

function sliceCornerPortion(points: Point2[], portion: CornerPolylinePortion): Point2[] {
  if (portion === "full" || points.length < 3) return points;
  const mid = Math.ceil((points.length - 1) / 2);
  if (portion === "first") return points.slice(0, mid + 1);
  return points.slice(mid);
}

function circularCornerPolyline(
  corner: RoundedRectCorner,
  radius: number,
  width: number,
  height: number,
  portion: CornerPolylinePortion,
  ox: number,
  oy: number,
): Point2[] {
  const r = Math.max(0, radius);
  if (r <= EPS) return [];
  const segments = Math.max(8, Math.ceil(r / 2));
  let cx = ox;
  let cy = oy;
  let startAngle = 0;
  let endAngle = 0;
  switch (corner) {
    case "topLeft":
      cx = ox + r;
      cy = oy + r;
      startAngle = Math.PI;
      endAngle = (3 * Math.PI) / 2;
      break;
    case "topRight":
      cx = ox + width - r;
      cy = oy + r;
      startAngle = (3 * Math.PI) / 2;
      endAngle = 2 * Math.PI;
      break;
    case "bottomRight":
      cx = ox + width - r;
      cy = oy + height - r;
      startAngle = 0;
      endAngle = Math.PI / 2;
      break;
    case "bottomLeft":
      cx = ox + r;
      cy = oy + height - r;
      startAngle = Math.PI / 2;
      endAngle = Math.PI;
      break;
  }
  if (portion === "first") endAngle = startAngle + (endAngle - startAngle) / 2;
  if (portion === "second") startAngle = startAngle + (endAngle - startAngle) / 2;

  const pts: Point2[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + (endAngle - startAngle) * t;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Sample points along one rounded-rect corner (supports smoothing + arc split). */
export function roundedRectCornerPolyline(
  corner: RoundedRectCorner,
  width: number,
  height: number,
  radii: RoundedRectRadii,
  smoothing: number,
  portion: CornerPolylinePortion,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): Point2[] {
  const clamped = clampRoundedRectRadii(normalizeRoundedRectRadii(radii), width, height);
  const normalized = distributeRoundedRectCornerBudgets(width, height, clamped);
  const ox = origin.x;
  const oy = origin.y;

  const meta = {
    topLeft: normalized.topLeft,
    topRight: normalized.topRight,
    bottomRight: normalized.bottomRight,
    bottomLeft: normalized.bottomLeft,
  }[corner];

  if (smoothing <= EPS) {
    const r = meta.radius;
    if (r <= EPS) return [];
    return circularCornerPolyline(corner, r, width, height, portion, ox, oy);
  }

  const pp = cornerPathParams(meta.radius, smoothing, meta.budget, width, height);
  const n = superellipseExponentFromSmoothing(smoothing);
  const local = superellipseCornerPoints(pp.p, n, 16);
  let global: Point2[];
  switch (corner) {
    case "topRight":
      global = mapTopRightCorner(local, ox, oy, width, pp.p);
      break;
    case "bottomRight":
      global = mapBottomRightCorner(local, ox, oy, width, height, pp.p);
      break;
    case "bottomLeft":
      global = mapBottomLeftCorner(local, ox, oy, height, pp.p);
      break;
    case "topLeft":
      global = mapTopLeftCorner(local, ox, oy, pp.p);
      break;
  }
  return sliceCornerPortion(global, portion);
}

export function cornerExtentAlongSide(
  corner: RoundedRectCorner,
  width: number,
  height: number,
  radii: RoundedRectRadii,
  smoothing: number,
): number {
  const clamped = clampRoundedRectRadii(normalizeRoundedRectRadii(radii), width, height);
  const normalized = distributeRoundedRectCornerBudgets(width, height, clamped);
  const meta = {
    topLeft: normalized.topLeft,
    topRight: normalized.topRight,
    bottomRight: normalized.bottomRight,
    bottomLeft: normalized.bottomLeft,
  }[corner];
  if (smoothing <= EPS) return meta.radius;
  return cornerPathParams(meta.radius, smoothing, meta.budget, width, height).p;
}

/** True superellipse corner contour (continuous curvature, no flat cubic tabletop). */
export function buildSuperellipseRoundedRectPath(
  ox: number,
  oy: number,
  width: number,
  height: number,
  radii: RoundedRectRadii,
  smoothing: number,
): string {
  const normalized = distributeRoundedRectCornerBudgets(width, height, radii);
  const n = superellipseExponentFromSmoothing(smoothing);
  const sampleSegments = 12;

  const ppTR = cornerPathParams(
    normalized.topRight.radius,
    smoothing,
    normalized.topRight.budget,
    width,
    height,
  );
  const ppBR = cornerPathParams(
    normalized.bottomRight.radius,
    smoothing,
    normalized.bottomRight.budget,
    width,
    height,
  );
  const ppBL = cornerPathParams(
    normalized.bottomLeft.radius,
    smoothing,
    normalized.bottomLeft.budget,
    width,
    height,
  );
  const ppTL = cornerPathParams(
    normalized.topLeft.radius,
    smoothing,
    normalized.topLeft.budget,
    width,
    height,
  );

  const tr = mapTopRightCorner(superellipseCornerPoints(ppTR.p, n, sampleSegments), ox, oy, width, ppTR.p);
  const br = mapBottomRightCorner(superellipseCornerPoints(ppBR.p, n, sampleSegments), ox, oy, width, height, ppBR.p);
  const bl = mapBottomLeftCorner(superellipseCornerPoints(ppBL.p, n, sampleSegments), ox, oy, height, ppBL.p);
  const tl = mapTopLeftCorner(superellipseCornerPoints(ppTL.p, n, sampleSegments), ox, oy, ppTL.p);

  const trStart = tr[0]!;
  const brJoinY = oy + height - sideJoin(height, ppBR.p);
  const blJoinX = ox + sideJoin(width, ppBL.p);
  const tlJoinY = oy + sideJoin(height, ppTL.p);

  return [
    `M ${fmt(trStart.x)} ${fmt(trStart.y)}`,
    catmullRomOpenPathD(tr),
    `L ${fmt(ox + width)} ${fmt(brJoinY)}`,
    catmullRomOpenPathD(br),
    `L ${fmt(blJoinX)} ${fmt(oy + height)}`,
    catmullRomOpenPathD(bl),
    `L ${fmt(ox)} ${fmt(tlJoinY)}`,
    catmullRomOpenPathD(tl),
    "Z",
  ].join(" ");
}

/** Legacy figma-squircle cubic+arc approximation (flat horizontal cubic controls). */
export function buildPiecewiseSmoothedRoundedRectPath(
  ox: number,
  oy: number,
  width: number,
  height: number,
  radii: RoundedRectRadii,
  smoothing: number,
): string {
  const normalized = distributeRoundedRectCornerBudgets(width, height, radii);
  const ppTR = cornerPathParams(
    normalized.topRight.radius,
    smoothing,
    normalized.topRight.budget,
    width,
    height,
  );
  const ppBR = cornerPathParams(
    normalized.bottomRight.radius,
    smoothing,
    normalized.bottomRight.budget,
    width,
    height,
  );
  const ppBL = cornerPathParams(
    normalized.bottomLeft.radius,
    smoothing,
    normalized.bottomLeft.budget,
    width,
    height,
  );
  const ppTL = cornerPathParams(
    normalized.topLeft.radius,
    smoothing,
    normalized.topLeft.budget,
    width,
    height,
  );

  const brJoinY = oy + height - sideJoin(height, ppBR.p);
  const blJoinX = ox + sideJoin(width, ppBL.p);
  const tlJoinY = oy + sideJoin(height, ppTL.p);

  return [
    `M ${fmt(ox + width - ppTR.p)} ${fmt(oy)}`,
    drawSquircleTopRight(ppTR),
    `L ${fmt(ox + width)} ${fmt(brJoinY)}`,
    drawSquircleBottomRight(ppBR),
    `L ${fmt(blJoinX)} ${fmt(oy + height)}`,
    drawSquircleBottomLeft(ppBL),
    `L ${fmt(ox)} ${fmt(tlJoinY)}`,
    drawSquircleTopLeft(ppTL),
    "Z",
  ].join(" ");
}

function buildSmoothedRoundedRectPath(
  ox: number,
  oy: number,
  width: number,
  height: number,
  radii: RoundedRectRadii,
  smoothing: number,
): string {
  return buildSuperellipseRoundedRectPath(ox, oy, width, height, radii, smoothing);
}

type LocalPoint = { x: number; y: number };

function toGlobal(
  local: LocalPoint,
  corner: LocalPoint,
  axisX: LocalPoint,
  axisY: LocalPoint,
): LocalPoint {
  return {
    x: corner.x + axisX.x * local.x + axisY.x * local.y,
    y: corner.y + axisX.y * local.x + axisY.y * local.y,
  };
}

/**
 * Emit a rounded corner in a local frame:
 * - origin at the rectangle corner
 * - +x along the incoming edge toward the corner start
 * - +y along the outgoing edge away from the corner
 */
function cornerCurveD(
  corner: LocalPoint,
  axisX: LocalPoint,
  axisY: LocalPoint,
  radius: number,
): string {
  const r = Math.max(0, radius);
  if (r <= EPS) return "";

  const k = r * KAPPA;
  const c1 = toGlobal({ x: -r + k, y: 0 }, corner, axisX, axisY);
  const c2 = toGlobal({ x: 0, y: r - k }, corner, axisX, axisY);
  const end = toGlobal({ x: 0, y: r }, corner, axisX, axisY);
  return `C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(end.x)} ${fmt(end.y)}`;
}

function axisForCorner(index: 0 | 1 | 2 | 3): {
  cornerAt: (ox: number, oy: number, w: number, h: number) => LocalPoint;
  axisX: LocalPoint;
  axisY: LocalPoint;
} {
  switch (index) {
    case 0:
      return {
        cornerAt: (ox, oy) => ({ x: ox, y: oy }),
        axisX: { x: 0, y: -1 },
        axisY: { x: 1, y: 0 },
      };
    case 1:
      return {
        cornerAt: (ox, oy, w) => ({ x: ox + w, y: oy }),
        axisX: { x: 1, y: 0 },
        axisY: { x: 0, y: 1 },
      };
    case 2:
      return {
        cornerAt: (ox, oy, w, h) => ({ x: ox + w, y: oy + h }),
        axisX: { x: 0, y: 1 },
        axisY: { x: -1, y: 0 },
      };
    case 3:
      return {
        cornerAt: (ox, oy, _w, h) => ({ x: ox, y: oy + h }),
        axisX: { x: -1, y: 0 },
        axisY: { x: 0, y: -1 },
      };
  }
}

export function buildRoundedRectPath(params: RoundedRectPathParams): string {
  const width = Math.max(0, params.width);
  const height = Math.max(0, params.height);
  const ox = params.origin?.x ?? 0;
  const oy = params.origin?.y ?? 0;
  if (width <= 0 || height <= 0) return "";

  const smoothing = clamp(params.smoothing ?? 0, 0, 1);
  const radii = clampRoundedRectRadii(normalizeRoundedRectRadii(params.radius), width, height);
  const [tl, tr, br, bl] = radiiTuple(radii);

  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    return `M ${fmt(ox)} ${fmt(oy)} H ${fmt(ox + width)} V ${fmt(oy + height)} H ${fmt(ox)} Z`;
  }

  if (smoothing > EPS) {
    return buildSmoothedRoundedRectPath(ox, oy, width, height, radii, smoothing);
  }

  const edgeEps = 0.001;
  const parts: string[] = [];

  const tlStartX = ox + tl;
  parts.push(`M ${fmt(tlStartX)} ${fmt(oy)}`);

  if (width - tl - tr > edgeEps) {
    parts.push(`H ${fmt(ox + width - tr)}`);
  }

  if (tr > 0) {
    const frame = axisForCorner(1);
    parts.push(
      cornerCurveD(frame.cornerAt(ox, oy, width, height), frame.axisX, frame.axisY, tr),
    );
  }

  if (height - tr - br > edgeEps) {
    parts.push(`V ${fmt(oy + height - br)}`);
  }

  if (br > 0) {
    const frame = axisForCorner(2);
    parts.push(
      cornerCurveD(frame.cornerAt(ox, oy, width, height), frame.axisX, frame.axisY, br),
    );
  }

  if (width - br - bl > edgeEps) {
    parts.push(`H ${fmt(ox + bl)}`);
  }

  if (bl > 0) {
    const frame = axisForCorner(3);
    parts.push(
      cornerCurveD(frame.cornerAt(ox, oy, width, height), frame.axisX, frame.axisY, bl),
    );
  }

  if (height - bl - tl > edgeEps) {
    parts.push(`V ${fmt(oy + tl)}`);
  }

  if (tl > 0) {
    const frame = axisForCorner(0);
    parts.push(
      cornerCurveD(frame.cornerAt(ox, oy, width, height), frame.axisX, frame.axisY, tl),
    );
  }

  parts.push("Z");
  return parts.join(" ");
}

/** Offset a rounded-rect contour uniformly (positive delta = outward). */
export function offsetRoundedRectPath(
  width: number,
  height: number,
  radius: number | RoundedRectRadii,
  delta: number,
  smoothing = 0,
): string {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  if (w <= 0 || h <= 0) return "";
  const clamped = clampRoundedRectRadii(normalizeRoundedRectRadii(radius), w, h);
  if (Math.abs(delta) < 1e-9) {
    return buildRoundedRectPath({ width: w, height: h, radius: clamped, smoothing });
  }

  const d = -delta;
  const ow = w - 2 * d;
  const oh = h - 2 * d;
  if (ow < 1e-6 || oh < 1e-6) return "";

  const shifted: RoundedRectRadii = {
    topLeft: Math.max(0, clamped.topLeft - d),
    topRight: Math.max(0, clamped.topRight - d),
    bottomRight: Math.max(0, clamped.bottomRight - d),
    bottomLeft: Math.max(0, clamped.bottomLeft - d),
  };
  const outRadii = clampRoundedRectRadii(shifted, ow, oh);
  return buildRoundedRectPath({
    width: ow,
    height: oh,
    radius: outRadii,
    smoothing,
    origin: { x: d, y: d },
  });
}

export function buildRoundedRectStrokePath(params: RoundedRectStrokePathParams): string {
  const sw = Math.max(0, params.strokeWidth);
  if (sw <= EPS) return buildRoundedRectPath(params);

  const align = params.strokeAlign;
  if (align === "center") {
    return buildRoundedRectPath(params);
  }
  if (align === "inside") {
    return offsetRoundedRectPath(params.width, params.height, params.radius, -sw / 2, params.smoothing ?? 0);
  }
  return offsetRoundedRectPath(params.width, params.height, params.radius, sw / 2, params.smoothing ?? 0);
}

export function buildRoundedRectFillAndStrokePaths(
  params: RoundedRectStrokePathParams,
): RoundedRectFillStrokePaths {
  return {
    fillPath: buildRoundedRectPath(params),
    strokePath: buildRoundedRectStrokePath(params),
  };
}

/** Even-odd stroke ring for outline / aligned stroke rendering. */
export function outlineRoundedRectRingPath(
  width: number,
  height: number,
  radius: number | RoundedRectRadii,
  strokeWidth: number,
  align: StrokeAlign,
  smoothing = 0,
): { pathD: string; fillRule: "evenodd" | "nonzero" } | null {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  if (w <= 0 || h <= 0 || strokeWidth < 1e-9) return null;
  const clamped = clampRoundedRectRadii(normalizeRoundedRectRadii(radius), w, h);
  if (
    clamped.topLeft <= 0 &&
    clamped.topRight <= 0 &&
    clamped.bottomRight <= 0 &&
    clamped.bottomLeft <= 0
  ) {
    return null;
  }

  const half = strokeWidth / 2;
  let outerD: string;
  let innerD: string | null = null;

  if (align === "center") {
    outerD = offsetRoundedRectPath(w, h, clamped, half, smoothing);
    innerD = offsetRoundedRectPath(w, h, clamped, -half, smoothing);
  } else if (align === "inside") {
    outerD = buildRoundedRectPath({ width: w, height: h, radius: clamped, smoothing });
    innerD = offsetRoundedRectPath(w, h, clamped, -strokeWidth, smoothing);
  } else {
    outerD = offsetRoundedRectPath(w, h, clamped, strokeWidth, smoothing);
    innerD = buildRoundedRectPath({ width: w, height: h, radius: clamped, smoothing });
  }

  if (!outerD) return null;
  if (!innerD) return { pathD: outerD, fillRule: "nonzero" };
  return { pathD: `${outerD} ${innerD}`, fillRule: "evenodd" };
}
