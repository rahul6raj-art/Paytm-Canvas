/** Ellipse arc / sweep / inner ratio (Figma-style pie, arc, and ring shapes). */

import { generatePolygonPoints } from "@/lib/shapes/pathGenerators";

export const DEFAULT_ELLIPSE_ARC_START_DEG = 0;
export const DEFAULT_ELLIPSE_ARC_SWEEP_DEG = 360;
export const DEFAULT_ELLIPSE_ARC_INNER_RATIO = 0;
export const MIN_ELLIPSE_ARC_SWEEP_DEG = 0.5;
export const FULL_ELLIPSE_ARC_EPS = 0.5;
export const MIN_ELLIPSE_ARC_INNER_RATIO = 0;
export const MAX_ELLIPSE_ARC_INNER_RATIO = 0.999;
/** Minimum ratio used only to place the ratio handle when ratio is 0. */
export const ELLIPSE_RATIO_HANDLE_MIN_RATIO = 0.04;
const PATH_PRECISION = 2;

export type EllipseArcAngles = {
  startDeg: number;
  sweepDeg: number;
  innerRadiusRatio: number;
};

export type EllipseArcPreview = {
  nodeId: string;
  startDeg: number;
  sweepDeg: number;
  innerRadiusRatio: number;
} | null;

/** @deprecated Use EllipseArcPreview */
export type EllipseSweepPreview = EllipseArcPreview;

export function normalizeDegrees(deg: number): number {
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
}

/** Shortest signed delta from `from` to `to` (degrees). */
export function angularDeltaDeg(from: number, to: number): number {
  let d = normalizeDegrees(to) - normalizeDegrees(from);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** Unwrap `angleDeg` to a value within ±180° of `nearDeg` (continuous orbit drag). */
export function unwrapAngleNear(angleDeg: number, nearDeg: number): number {
  const a = normalizeDegrees(angleDeg);
  let u = a;
  while (u - nearDeg > 180) u -= 360;
  while (u - nearDeg < -180) u += 360;
  return u;
}

/** Clockwise sweep from `startDeg` to `endDeg` (0° = 3 o'clock). */
export function clockwiseSweepBetween(startDeg: number, endDeg: number): number {
  const s = normalizeDegrees(startDeg);
  const e = normalizeDegrees(endDeg);
  let sweep = e - s;
  if (sweep <= 0) sweep += 360;
  return sweep;
}

export function clampSweepDeg(sweep: number, opts?: { shiftKey?: boolean }): number {
  let s = sweep;
  if (opts?.shiftKey) {
    s = Math.round(s / 15) * 15;
  }
  return Math.min(360, Math.max(MIN_ELLIPSE_ARC_SWEEP_DEG, s));
}

/** Unwrapped end angle for handle placement and drag continuity. */
export function ellipseEndAngleUnwrapped(
  startDeg: number,
  sweepDeg: number,
  nearDeg: number,
): number {
  if (isFullEllipseArc(sweepDeg)) {
    return unwrapAngleNear(startDeg, nearDeg) + 360;
  }
  return unwrapAngleNear(startDeg + sweepDeg, nearDeg);
}

export function formatArcSweepDegrees(sweepDeg: number): string {
  const n = Math.abs(sweepDeg);
  if (n >= 360 - FULL_ELLIPSE_ARC_EPS) return "360°";
  return `${n.toFixed(n < 10 ? 1 : 0)}°`;
}

/**
 * Sweep handle: fixed start, end follows pointer orbit (clockwise increases sweep).
 */
function unwrapStartNearEnd(startDeg: number, endUnwrapped: number): number {
  let startU = unwrapAngleNear(startDeg, endUnwrapped);
  if (startU > endUnwrapped) startU -= 360;
  return startU;
}

export function sweepDegFromEndHandleDrag(
  startDeg: number,
  grabEndUnwrapped: number,
  moveAngle: number,
  opts?: { shiftKey?: boolean; fromFullCircle?: boolean },
): number {
  if (opts?.fromFullCircle) {
    const moveU = unwrapAngleNear(moveAngle, grabEndUnwrapped);
    const delta = moveU - grabEndUnwrapped;
    if (Math.abs(delta) <= FULL_ELLIPSE_ARC_EPS) {
      return 360;
    }
    const cw = clockwiseSweepBetween(startDeg, moveAngle);
    if (cw >= 360 - FULL_ELLIPSE_ARC_EPS) {
      return clampSweepDeg(delta < 0 ? 360 + delta : 360 - delta, opts);
    }
    return clampSweepDeg(cw, opts);
  }
  const startU = unwrapStartNearEnd(startDeg, grabEndUnwrapped);
  const moveU = unwrapAngleNear(moveAngle, grabEndUnwrapped);
  let sweep = moveU - startU;
  if (sweep < MIN_ELLIPSE_ARC_SWEEP_DEG) {
    sweep = clockwiseSweepBetween(startDeg, moveAngle);
  }
  return clampSweepDeg(sweep, opts);
}

/**
 * Start handle: fixed end, start follows pointer (sweep shrinks/grows with orbit direction).
 */
export function startDegAndSweepFromStartHandleDrag(
  fixedEndUnwrapped: number,
  moveAngle: number,
  opts?: { shiftKey?: boolean },
): { startDeg: number; sweepDeg: number } {
  const endU = fixedEndUnwrapped;
  let moveU = unwrapAngleNear(moveAngle, endU);
  if (moveU > endU) moveU -= 360;
  let sweep = endU - moveU;
  if (sweep < MIN_ELLIPSE_ARC_SWEEP_DEG) {
    sweep = clockwiseSweepBetween(moveU, endU);
  }
  let startDeg = normalizeDegrees(moveU);
  if (opts?.shiftKey) {
    startDeg = normalizeDegrees(Math.round(startDeg / 15) * 15);
    sweep = clockwiseSweepBetween(startDeg, normalizeDegrees(endU));
  }
  return { startDeg, sweepDeg: clampSweepDeg(sweep, opts) };
}

export function effectiveEllipseArc(node: {
  arcStartDeg?: number;
  arcSweepDeg?: number;
  arcInnerRadiusRatio?: number;
}): EllipseArcAngles {
  const startDeg = normalizeDegrees(node.arcStartDeg ?? DEFAULT_ELLIPSE_ARC_START_DEG);
  let sweepDeg = node.arcSweepDeg ?? DEFAULT_ELLIPSE_ARC_SWEEP_DEG;
  if (!Number.isFinite(sweepDeg)) sweepDeg = DEFAULT_ELLIPSE_ARC_SWEEP_DEG;
  sweepDeg = Math.min(360, Math.max(MIN_ELLIPSE_ARC_SWEEP_DEG, sweepDeg));
  let innerRadiusRatio = node.arcInnerRadiusRatio ?? DEFAULT_ELLIPSE_ARC_INNER_RATIO;
  if (!Number.isFinite(innerRadiusRatio)) innerRadiusRatio = DEFAULT_ELLIPSE_ARC_INNER_RATIO;
  innerRadiusRatio = Math.min(
    MAX_ELLIPSE_ARC_INNER_RATIO,
    Math.max(MIN_ELLIPSE_ARC_INNER_RATIO, innerRadiusRatio),
  );
  return { startDeg, sweepDeg, innerRadiusRatio };
}

export function isFullEllipseArc(sweepDeg: number): boolean {
  return sweepDeg >= 360 - FULL_ELLIPSE_ARC_EPS;
}

export function hasEllipseArcInnerHole(innerRadiusRatio: number): boolean {
  return innerRadiusRatio > 0.001;
}

export function formatArcRatioPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Sweep as a percentage of a full turn (Figma arc panel). */
export function sweepDegToPercent(sweepDeg: number): number {
  if (!Number.isFinite(sweepDeg)) return 100;
  return (Math.min(360, Math.max(0, sweepDeg)) / 360) * 100;
}

export function sweepPercentToDeg(percent: number): number {
  if (!Number.isFinite(percent)) return DEFAULT_ELLIPSE_ARC_SWEEP_DEG;
  const sweep = (percent / 100) * 360;
  return Math.min(360, Math.max(MIN_ELLIPSE_ARC_SWEEP_DEG, sweep));
}

export function formatArcSweepPercent(sweepDeg: number): string {
  const pct = sweepDegToPercent(sweepDeg);
  if (pct >= 100 - FULL_ELLIPSE_ARC_EPS / 3.6) return "100%";
  const decimals = pct < 10 ? 2 : pct < 100 ? 2 : 1;
  return `${pct.toFixed(decimals)}%`;
}

export function degreesFromLocalPoint(
  cx: number,
  cy: number,
  px: number,
  py: number,
): number {
  const rad = Math.atan2(py - cy, px - cx);
  return normalizeDegrees((rad * 180) / Math.PI);
}

/** Parametric angle on an ellipse (matches `ellipsePointAtDeg` / arc path). */
export function parametricDegreesFromLocalPoint(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  px: number,
  py: number,
): number {
  if (rx <= 0 || ry <= 0) return degreesFromLocalPoint(cx, cy, px, py);
  const cosT = (px - cx) / rx;
  const sinT = (py - cy) / ry;
  const rad = Math.atan2(sinT, cosT);
  return normalizeDegrees((rad * 180) / Math.PI);
}

/** Unit vector from center toward the parametric point at `deg`. */
export function ellipseParametricUnitVector(
  rx: number,
  ry: number,
  deg: number,
): { ux: number; uy: number } {
  const rad = (deg * Math.PI) / 180;
  const vx = rx * Math.cos(rad);
  const vy = ry * Math.sin(rad);
  const len = Math.hypot(vx, vy) || 1;
  return { ux: vx / len, uy: vy / len };
}

/** Distance from center to the outer parametric point at `deg`. */
export function ellipseParametricOuterDistance(rx: number, ry: number, deg: number): number {
  const rad = (deg * Math.PI) / 180;
  return Math.hypot(rx * Math.cos(rad), ry * Math.sin(rad)) || 1;
}

/** Signed distance from center along the parametric ray at `deg`. */
export function distanceAlongEllipseParametricRay(
  cx: number,
  cy: number,
  px: number,
  py: number,
  rx: number,
  ry: number,
  deg: number,
): number {
  const { ux, uy } = ellipseParametricUnitVector(rx, ry, deg);
  return (px - cx) * ux + (py - cy) * uy;
}

export function ellipsePointAtDeg(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  deg: number,
): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + rx * Math.cos(rad),
    y: cy + ry * Math.sin(rad),
  };
}

/** Radial distance from center to ellipse perimeter along `deg`. */
export function ellipseRadiusAtDeg(
  width: number,
  height: number,
  deg: number,
): number {
  const cx = width / 2;
  const cy = height / 2;
  const p = ellipsePointAtDeg(cx, cy, width / 2, height / 2, deg);
  return Math.hypot(p.x - cx, p.y - cy) || 1;
}

/** Signed distance from center along the ray at `angleDeg`. */
export function radialDistanceAlongAngle(
  cx: number,
  cy: number,
  px: number,
  py: number,
  angleDeg: number,
): number {
  const rad = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  return (px - cx) * ux + (py - cy) * uy;
}

/**
 * Outer parametric distance at `angleDeg` (alias kept for ratio-drag math).
 */
export function bisectorRadialScaleAtRatioOne(
  width: number,
  height: number,
  angleDeg: number,
): number {
  return ellipseParametricOuterDistance(width / 2, height / 2, angleDeg);
}

function clampArcInnerRatio(ratio: number, shiftKey?: boolean): number {
  if (!Number.isFinite(ratio)) return MIN_ELLIPSE_ARC_INNER_RATIO;
  let r = ratio;
  if (shiftKey) {
    r = Math.round(r * 20) / 20;
  }
  return Math.min(
    MAX_ELLIPSE_ARC_INNER_RATIO,
    Math.max(MIN_ELLIPSE_ARC_INNER_RATIO, r),
  );
}

/** Snap a local point onto the arc bisector parametric ray (smooth ratio drag). */
export function projectLocalOntoArcBisector(
  width: number,
  height: number,
  px: number,
  py: number,
  angleDeg: number,
): { x: number; y: number } {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const outer = ellipseParametricOuterDistance(rx, ry, angleDeg);
  const dist = Math.max(
    0,
    Math.min(outer, distanceAlongEllipseParametricRay(cx, cy, px, py, rx, ry, angleDeg)),
  );
  const t = dist / outer;
  return ellipsePointAtDeg(cx, cy, rx * t, ry * t, angleDeg);
}

/** Grab state aligned to the visible ratio handle (avoids jump on pointer down). */
export function ellipseArcRatioDragBaseline(
  width: number,
  height: number,
  startDeg: number,
  sweepDeg: number,
  innerRadiusRatio: number,
): {
  ratioAngleDeg: number;
  grabRatio: number;
  grabLocal: { x: number; y: number };
} {
  const ratioAngleDeg = ellipseArcMidDeg(startDeg, sweepDeg);
  const grabLocal = ellipseRatioHandleLocal(
    width,
    height,
    startDeg,
    sweepDeg,
    innerRadiusRatio,
    { softenZero: true },
  );
  const grabRatio = arcInnerRadiusRatioFromLocalPoint(
    width,
    height,
    grabLocal.x,
    grabLocal.y,
    ratioAngleDeg,
  );
  return { ratioAngleDeg, grabRatio, grabLocal };
}

/**
 * Ratio from pointer position: distance to center / outer ellipse radius at pointer angle.
 * Works for any drag direction (e.g. toward bottom) unlike fixed-angle projection.
 */
export function arcInnerRadiusRatioFromPointer(
  width: number,
  height: number,
  px: number,
  py: number,
  opts?: { shiftKey?: boolean },
): number {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const angle = parametricDegreesFromLocalPoint(cx, cy, rx, ry, px, py);
  const outerR = ellipseParametricOuterDistance(rx, ry, angle);
  if (outerR <= 0) return MIN_ELLIPSE_ARC_INNER_RATIO;
  const dist = distanceAlongEllipseParametricRay(cx, cy, px, py, rx, ry, angle);
  return clampArcInnerRatio(dist / outerR, opts?.shiftKey);
}

/** Inner radius ratio from pointer projected on the arc bisector (Figma `innerRadius`). */
export function arcInnerRadiusRatioFromLocalPoint(
  width: number,
  height: number,
  px: number,
  py: number,
  angleDeg: number,
  opts?: { shiftKey?: boolean },
): number {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const scale = ellipseParametricOuterDistance(rx, ry, angleDeg);
  if (scale <= 0) return MIN_ELLIPSE_ARC_INNER_RATIO;
  const proj = distanceAlongEllipseParametricRay(cx, cy, px, py, rx, ry, angleDeg);
  return clampArcInnerRatio(proj / scale, opts?.shiftKey);
}

/**
 * Ratio drag along the arc bisector (Figma `innerRadius` handle ray).
 * Pointer position is projected onto the fixed mid-angle; dragging perpendicular
 * to the bisector does not change ratio.
 */
export function arcInnerRadiusRatioFromRelativeDrag(
  width: number,
  height: number,
  ratioAngleDeg: number,
  grabRatio: number,
  grabX: number,
  grabY: number,
  moveX: number,
  moveY: number,
  opts?: { shiftKey?: boolean },
): number {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const outer = ellipseParametricOuterDistance(rx, ry, ratioAngleDeg);
  if (outer <= 1e-6) return MIN_ELLIPSE_ARC_INNER_RATIO;
  const grabDist = distanceAlongEllipseParametricRay(cx, cy, grabX, grabY, rx, ry, ratioAngleDeg);
  const moveDist = distanceAlongEllipseParametricRay(cx, cy, moveX, moveY, rx, ry, ratioAngleDeg);
  return clampArcInnerRatio(grabRatio + (moveDist - grabDist) / outer, opts?.shiftKey);
}

/** @deprecated Prefer sweepDegFromEndHandleDrag (orbit drag). */
export function sweepDegFromRelativeDrag(
  grabAngle: number,
  grabSweep: number,
  moveAngle: number,
  opts?: { shiftKey?: boolean },
): number {
  const startU = unwrapAngleNear(0, grabAngle);
  const endU = unwrapAngleNear(grabAngle + grabSweep, grabAngle);
  return sweepDegFromEndHandleDrag(startU, endU, moveAngle, opts);
}

/** @deprecated Prefer startDegAndSweepFromStartHandleDrag. */
export function startDegSweepFromRelativeDrag(
  grabAngle: number,
  grabStart: number,
  grabSweep: number,
  moveAngle: number,
  opts?: { shiftKey?: boolean },
): { startDeg: number; sweepDeg: number } {
  const fixedEnd = ellipseEndAngleUnwrapped(grabStart, grabSweep, grabAngle);
  return startDegAndSweepFromStartHandleDrag(fixedEnd, moveAngle, opts);
}

export function ellipseArcMidDeg(startDeg: number, sweepDeg: number): number {
  return startDeg + sweepDeg / 2;
}

/** Sweep handle at the outer end of the arc. */
export function ellipseSweepHandleLocal(
  width: number,
  height: number,
  startDeg: number,
  sweepDeg: number,
): { x: number; y: number } {
  const cx = width / 2;
  const cy = height / 2;
  const endDeg = startDeg + sweepDeg;
  return ellipsePointAtDeg(cx, cy, width / 2, height / 2, endDeg);
}

/** Start handle at the outer beginning of the arc. */
export function ellipseStartHandleLocal(
  width: number,
  height: number,
  startDeg: number,
): { x: number; y: number } {
  const cx = width / 2;
  const cy = height / 2;
  return ellipsePointAtDeg(cx, cy, width / 2, height / 2, startDeg);
}

/** Ratio handle on the inner arc at the sweep midpoint. */
export function ellipseRatioHandleLocal(
  width: number,
  height: number,
  startDeg: number,
  sweepDeg: number,
  innerRadiusRatio: number,
  opts?: { softenZero?: boolean },
): { x: number; y: number } {
  const cx = width / 2;
  const cy = height / 2;
  const outerRx = width / 2;
  const outerRy = height / 2;
  const midDeg = ellipseArcMidDeg(startDeg, sweepDeg);
  const softenZero = opts?.softenZero !== false;
  const displayRatio =
    innerRadiusRatio > 0.001
      ? innerRadiusRatio
      : softenZero
        ? ELLIPSE_RATIO_HANDLE_MIN_RATIO
        : 0;
  return ellipsePointAtDeg(
    cx,
    cy,
    outerRx * displayRatio,
    outerRy * displayRatio,
    midDeg,
  );
}

function fmt(n: number): string {
  return n.toFixed(PATH_PRECISION);
}

function appendEllipsePolyline(
  parts: string[],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startDeg: number,
  sweepDeg: number,
): void {
  const steps = Math.max(16, Math.ceil(Math.abs(sweepDeg) / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = ellipsePointAtDeg(cx, cy, rx, ry, startDeg + sweepDeg * t);
    parts.push(`L ${fmt(p.x)} ${fmt(p.y)}`);
  }
}

/** Closed polygon approximation for ellipse arcs (boolean / clipper ops). */
export function ellipseLocalPolygonPoints(
  width: number,
  height: number,
  arc: EllipseArcAngles,
  segments = 64,
): { x: number; y: number }[] {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  if (isFullEllipseArc(arc.sweepDeg) && !hasEllipseArcInnerHole(arc.innerRadiusRatio)) {
    return generatePolygonPoints(segments, w, h).map((p) => ({ x: p.x, y: p.y }));
  }
  const cx = w / 2;
  const cy = h / 2;
  const outerRx = w / 2;
  const outerRy = h / 2;
  const innerRx = outerRx * arc.innerRadiusRatio;
  const innerRy = outerRy * arc.innerRadiusRatio;
  const pts: { x: number; y: number }[] = [];
  if (!hasEllipseArcInnerHole(arc.innerRadiusRatio)) {
    pts.push({ x: cx, y: cy });
  }
  const steps = Math.max(8, Math.ceil((arc.sweepDeg / 360) * segments));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const deg = arc.startDeg + arc.sweepDeg * t;
    pts.push(ellipsePointAtDeg(cx, cy, outerRx, outerRy, deg));
  }
  if (hasEllipseArcInnerHole(arc.innerRadiusRatio)) {
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const deg = arc.startDeg + arc.sweepDeg * t;
      pts.push(ellipsePointAtDeg(cx, cy, innerRx, innerRy, deg));
    }
  }
  return pts;
}

/**
 * SVG path for ellipse fill/stroke (pie, arc, ring, or ring sector).
 */
export function ellipseArcPathD(
  width: number,
  height: number,
  startDeg: number,
  sweepDeg: number,
  innerRadiusRatio = 0,
): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const cx = w / 2;
  const cy = h / 2;
  const outerRx = w / 2;
  const outerRy = h / 2;
  const ratio = Math.min(
    MAX_ELLIPSE_ARC_INNER_RATIO,
    Math.max(0, innerRadiusRatio),
  );

  if (!hasEllipseArcInnerHole(ratio)) {
    if (isFullEllipseArc(sweepDeg)) {
      return [
        `M ${fmt(cx - outerRx)} ${fmt(cy)}`,
        `A ${fmt(outerRx)} ${fmt(outerRy)} 0 1 1 ${fmt(cx + outerRx)} ${fmt(cy)}`,
        `A ${fmt(outerRx)} ${fmt(outerRy)} 0 1 1 ${fmt(cx - outerRx)} ${fmt(cy)}`,
        "Z",
      ].join(" ");
    }
    const start = ellipsePointAtDeg(cx, cy, outerRx, outerRy, startDeg);
    const parts = [`M ${fmt(cx)} ${fmt(cy)}`, `L ${fmt(start.x)} ${fmt(start.y)}`];
    appendEllipsePolyline(parts, cx, cy, outerRx, outerRy, startDeg, sweepDeg);
    parts.push("Z");
    return parts.join(" ");
  }

  const innerRx = outerRx * ratio;
  const innerRy = outerRy * ratio;

  if (isFullEllipseArc(sweepDeg)) {
    return [
      `M ${fmt(cx - outerRx)} ${fmt(cy)}`,
      `A ${fmt(outerRx)} ${fmt(outerRy)} 0 1 1 ${fmt(cx + outerRx)} ${fmt(cy)}`,
      `A ${fmt(outerRx)} ${fmt(outerRy)} 0 1 1 ${fmt(cx - outerRx)} ${fmt(cy)}`,
      `M ${fmt(cx - innerRx)} ${fmt(cy)}`,
      `A ${fmt(innerRx)} ${fmt(innerRy)} 0 1 0 ${fmt(cx + innerRx)} ${fmt(cy)}`,
      `A ${fmt(innerRx)} ${fmt(innerRy)} 0 1 0 ${fmt(cx - innerRx)} ${fmt(cy)}`,
      "Z",
    ].join(" ");
  }

  const outerStart = ellipsePointAtDeg(cx, cy, outerRx, outerRy, startDeg);
  const parts = [`M ${fmt(outerStart.x)} ${fmt(outerStart.y)}`];
  appendEllipsePolyline(parts, cx, cy, outerRx, outerRy, startDeg, sweepDeg);
  const innerEnd = ellipsePointAtDeg(cx, cy, innerRx, innerRy, startDeg + sweepDeg);
  parts.push(`L ${fmt(innerEnd.x)} ${fmt(innerEnd.y)}`);
  appendEllipsePolyline(parts, cx, cy, innerRx, innerRy, startDeg + sweepDeg, -sweepDeg);
  parts.push("Z");
  return parts.join(" ");
}

/** @deprecated Use sweepDegFromRelativeDrag during handle drag. */
export function sweepDegFromPointer(
  startDeg: number,
  cx: number,
  cy: number,
  px: number,
  py: number,
  opts?: { shiftKey?: boolean },
): number {
  const angle = degreesFromLocalPoint(cx, cy, px, py);
  let sweep = angle - startDeg;
  if (sweep <= 0) sweep += 360;
  if (opts?.shiftKey) {
    sweep = Math.round(sweep / 15) * 15;
  }
  return Math.min(360, Math.max(MIN_ELLIPSE_ARC_SWEEP_DEG, sweep));
}
