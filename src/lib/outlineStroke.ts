import {
  clampCornerRadii,
  getNodeCornerRadii,
  roundedRectPolygonPoints,
} from "@/lib/cornerRadius";
import { buildCompositePathDForGroup } from "@/lib/booleanGeometry";
import { effectiveStrokeType } from "@/lib/stroke";
import {
  resolveStrokeSideWidths,
  resolveStrokeSides,
  strokeEdgeRects,
  strokeUsesAxisAlignedRects,
  strokeUsesCssIndividualBorders,
  usesPerEdgeStroke,
  type StrokeEdgeRect,
} from "@/lib/strokeAlign";
import { lineEndpointsFromNode } from "@/lib/shapes/lineGeometry";
import { generatePolygonPoints } from "@/lib/shapes/pathGenerators";
import { isPolygonNode, polygonPathDForNode } from "@/lib/shapes/polygonGeometry";
import {
  roundedRectStrokeSegments,
  type StrokeSideSegment,
} from "@/lib/roundedRectSideStroke";
import { isStarNode, starPathDForNode } from "@/lib/shapes/starGeometry";
import { prepareTextForDisplay, textAdvancedStyleFromNode } from "@/lib/text/textAdvancedStyle";
import { layoutText, lineTopY } from "@/lib/text/textMeasure";
import { TEXT_BOX_PAD_X, TEXT_BOX_PAD_Y, textInnerWidth } from "@/lib/text/textNodeModel";
import { resolveTextTypo } from "@/lib/textTypography";
import {
  newPathPointId,
  normalizePathNode,
  pathToSvgD,
  svgPathDToPathPoints,
  type PathPoint,
} from "@/lib/pathGeometry";
import {
  offsetPolygonPoints,
  pointsToClosedPathD,
  type Point2,
} from "@/lib/strokeOffset";
import type { StrokeLinecap, StrokeLinejoin } from "@/lib/stroke";
import {
  resolveStrokeSpec,
  strokeSpecColorRgba,
  strokeSpecIsVisible,
  type StrokeAlign,
} from "@/lib/strokeSpec";
import type { EditorNode } from "@/stores/useEditorStore";

export type { Point2 };

export type StrokeGeometryParams = {
  width: number;
  align: StrokeAlign;
  join: StrokeLinejoin;
  cap: StrokeLinecap;
  miterLimit?: number;
};

export type OutlineStrokeResult = {
  pathD: string;
  fillRule: "nonzero" | "evenodd";
  pathPoints: PathPoint[];
  pathClosed: boolean;
  fill: string;
  fillOpacity: number;
  fillType?: "solid" | "gradient";
  fillGradient?: EditorNode["fillGradient"];
};

export type OutlineStrokeContext = {
  childOrder?: Record<string, string[]>;
  nodes?: Record<string, EditorNode>;
};

const MITER_LIMIT = 4;
const CAP_SEGMENTS = 12;
const BEZIER_SEGMENTS = 8;
const ARC_SEGMENTS = 8;
const ELLIPSE_SEGMENTS = 64;

function dist(x: number, y: number): number {
  return Math.hypot(x, y);
}

function normalize(v: Point2): Point2 {
  const l = dist(v.x, v.y);
  if (l < 1e-9) return { x: 0, y: 0 };
  return { x: v.x / l, y: v.y / l };
}

function leftNormal(dir: Point2): Point2 {
  return { x: dir.y, y: -dir.x };
}

function copyPoint(p: Point2): Point2 {
  return { x: p.x, y: p.y };
}

function pointsEqual(a: Point2, b: Point2, eps = 1e-6): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

/** Straight segment — returns endpoints for offset expansion. */
export function expandLineSegment(p0: Point2, p1: Point2): Point2[] {
  return [copyPoint(p0), copyPoint(p1)];
}

/** Sample cubic bezier from p0 to p3 with controls p1, p2. */
export function expandBezierSegment(
  p0: Point2,
  p1: Point2,
  p2: Point2,
  p3: Point2,
  segments = BEZIER_SEGMENTS,
): Point2[] {
  const out: Point2[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const x =
      u * u * u * p0.x +
      3 * u * u * t * p1.x +
      3 * u * t * t * p2.x +
      t * t * t * p3.x;
    const y =
      u * u * u * p0.y +
      3 * u * u * t * p1.y +
      3 * u * t * t * p2.y +
      t * t * t * p3.y;
    if (i === 0) {
      out.push({ x, y });
      continue;
    }
    const prev = out[out.length - 1]!;
    if (!pointsEqual(prev, { x, y })) out.push({ x, y });
  }
  return out;
}

/** Tessellate path anchors + handles into a polyline. */
export function tessellatePathPoints(points: PathPoint[], closed: boolean): Point2[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ x: points[0]!.x, y: points[0]!.y }];

  const out: Point2[] = [];
  const n = points.length;
  const segCount = closed ? n : n - 1;

  for (let i = 0; i < segCount; i++) {
    const curr = points[i]!;
    const next = points[(i + 1) % n]!;
    const hasCurve = curr.handleOut || next.handleIn;
    if (!hasCurve) {
      if (out.length === 0 || !pointsEqual(out[out.length - 1]!, curr)) {
        out.push({ x: curr.x, y: curr.y });
      }
      out.push({ x: next.x, y: next.y });
      continue;
    }
    const p0 = { x: curr.x, y: curr.y };
    const p1 = {
      x: curr.x + (curr.handleOut?.x ?? 0),
      y: curr.y + (curr.handleOut?.y ?? 0),
    };
    const p2 = {
      x: next.x + (next.handleIn?.x ?? 0),
      y: next.y + (next.handleIn?.y ?? 0),
    };
    const p3 = { x: next.x, y: next.y };
    const sampled = expandBezierSegment(p0, p1, p2, p3);
    for (let j = 0; j < sampled.length; j++) {
      const p = sampled[j]!;
      if (out.length === 0 || !pointsEqual(out[out.length - 1]!, p)) out.push(p);
    }
  }
  return out;
}

/** Tessellate SVG path d (M/L/A/C/Z) to a polyline. */
export function tessellateSvgPathD(pathD: string): Point2[] {
  const tokens = pathD.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens?.length) return [];
  const out: Point2[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;

  const readNum = () => parseFloat(tokens[i++] ?? "0");

  const push = (x: number, y: number) => {
    const p = { x, y };
    if (out.length === 0 || !pointsEqual(out[out.length - 1]!, p)) out.push(p);
    cx = x;
    cy = y;
  };

  while (i < tokens.length) {
    const cmd = tokens[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const c = cmd.toUpperCase();

    if (c === "M") {
      const x = readNum() + (rel ? cx : 0);
      const y = readNum() + (rel ? cy : 0);
      startX = x;
      startY = y;
      push(x, y);
    } else if (c === "L") {
      push(readNum() + (rel ? cx : 0), readNum() + (rel ? cy : 0));
    } else if (c === "H") {
      push(readNum() + (rel ? cx : 0), cy);
    } else if (c === "V") {
      push(cx, readNum() + (rel ? cy : 0));
    } else if (c === "C") {
      const c1x = readNum() + (rel ? cx : 0);
      const c1y = readNum() + (rel ? cy : 0);
      const c2x = readNum() + (rel ? cx : 0);
      const c2y = readNum() + (rel ? cy : 0);
      const x = readNum() + (rel ? cx : 0);
      const y = readNum() + (rel ? cy : 0);
      const sampled = expandBezierSegment(
        { x: cx, y: cy },
        { x: c1x, y: c1y },
        { x: c2x, y: c2y },
        { x, y },
      );
      for (let j = 1; j < sampled.length; j++) push(sampled[j]!.x, sampled[j]!.y);
    } else if (c === "A") {
      const rx = readNum();
      const ry = readNum();
      readNum();
      const largeArc = readNum() >= 1;
      const sweep = readNum() >= 1;
      const x = readNum() + (rel ? cx : 0);
      const y = readNum() + (rel ? cy : 0);
      const arcPts = sampleSvgArc(cx, cy, rx, ry, largeArc, sweep, x, y);
      for (let j = 1; j < arcPts.length; j++) push(arcPts[j]!.x, arcPts[j]!.y);
    } else if (c === "Z") {
      if (!pointsEqual({ x: cx, y: cy }, { x: startX, y: startY })) {
        push(startX, startY);
      }
      cx = startX;
      cy = startY;
    }
  }
  return out;
}

function sampleSvgArc(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  largeArc: boolean,
  sweep: boolean,
  x1: number,
  y1: number,
): Point2[] {
  if (Math.abs(rx) < 1e-9 || Math.abs(ry) < 1e-9) return [{ x: x0, y: y0 }, { x: x1, y: y1 }];
  const r = (Math.abs(rx) + Math.abs(ry)) / 2;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = (x0 - x1) / 2;
  const dy = (y0 - y1) / 2;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return [{ x: x0, y: y0 }];
  const h = Math.sqrt(Math.max(0, r * r - d * d));
  const nx = -dy / d;
  const ny = dx / d;
  const sign = sweep !== largeArc ? 1 : -1;
  const cx = mx + nx * h * sign;
  const cy = my + ny * h * sign;
  const a0 = Math.atan2(y0 - cy, x0 - cx);
  const a1 = Math.atan2(y1 - cy, x1 - cx);
  let delta = a1 - a0;
  if (sweep && delta < 0) delta += Math.PI * 2;
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  const steps = Math.max(2, ARC_SEGMENTS);
  const pts: Point2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + delta * t;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Offset joint between two segments on an open/closed chain. */
export function createJoinGeometry(
  prev: Point2,
  curr: Point2,
  next: Point2,
  delta: number,
  join: StrokeLinejoin,
  miterLimit = MITER_LIMIT,
): Point2 {
  const e1 = normalize({ x: curr.x - prev.x, y: curr.y - prev.y });
  const e2 = normalize({ x: next.x - curr.x, y: next.y - curr.y });
  const n1 = leftNormal(e1);
  const n2 = leftNormal(e2);

  let nx = n1.x + n2.x;
  let ny = n1.y + n2.y;
  const nl = dist(nx, ny);
  if (nl < 1e-9) {
    return { x: curr.x + n1.x * delta, y: curr.y + n1.y * delta };
  }
  nx /= nl;
  ny /= nl;

  const cross = e1.x * e2.y - e1.y * e2.x;
  const sinHalf = Math.abs(cross) > 1e-9 ? cross / 2 : 1;
  let miterLen = delta / sinHalf;
  const dot = n1.x * nx + n1.y * ny;
  if (Math.abs(dot) > 1e-9) miterLen = delta / dot;

  if (join === "bevel" || (join === "miter" && Math.abs(miterLen) > Math.abs(delta) * miterLimit)) {
    return { x: curr.x + n1.x * delta, y: curr.y + n1.y * delta };
  }
  if (join === "round") {
    return { x: curr.x + nx * delta, y: curr.y + ny * delta };
  }
  return { x: curr.x + nx * miterLen, y: curr.y + ny * miterLen };
}

/** Semicircle / square extension cap points between left and right offset endpoints. */
export function createCapGeometry(
  tip: Point2,
  direction: Point2,
  halfWidth: number,
  cap: StrokeLinecap,
  left: Point2,
  right: Point2,
  atStart: boolean,
): Point2[] {
  const dir = normalize(direction);
  if (cap === "butt") return [];

  if (cap === "square") {
    const ext = { x: dir.x * halfWidth, y: dir.y * halfWidth };
    const sign = atStart ? -1 : 1;
    return [
      { x: left.x + ext.x * sign, y: left.y + ext.y * sign },
      { x: right.x + ext.x * sign, y: right.y + ext.y * sign },
    ];
  }

  const center = tip;
  const startAngle = Math.atan2(left.y - center.y, left.x - center.x);
  const endAngle = Math.atan2(right.y - center.y, right.x - center.x);
  let delta = endAngle - startAngle;
  if (atStart) {
    if (delta > 0) delta -= Math.PI * 2;
  } else if (delta < 0) {
    delta += Math.PI * 2;
  }
  const pts: Point2[] = [];
  for (let i = 1; i < CAP_SEGMENTS; i++) {
    const t = i / CAP_SEGMENTS;
    const a = startAngle + delta * t;
    pts.push({
      x: center.x + Math.cos(a) * halfWidth,
      y: center.y + Math.sin(a) * halfWidth,
    });
  }
  return pts;
}

function offsetSideAtVertex(
  points: Point2[],
  index: number,
  delta: number,
  closed: boolean,
  join: StrokeLinejoin,
): Point2 {
  const n = points.length;
  const curr = points[index]!;
  const prev = points[closed ? (index - 1 + n) % n : Math.max(0, index - 1)]!;
  const next = points[closed ? (index + 1) % n : Math.min(n - 1, index + 1)]!;

  if (!closed && index === 0) {
    const e = normalize({ x: next.x - curr.x, y: next.y - curr.y });
    const n0 = leftNormal(e);
    return { x: curr.x + n0.x * delta, y: curr.y + n0.y * delta };
  }
  if (!closed && index === n - 1) {
    const e = normalize({ x: curr.x - prev.x, y: curr.y - prev.y });
    const n0 = leftNormal(e);
    return { x: curr.x + n0.x * delta, y: curr.y + n0.y * delta };
  }
  return createJoinGeometry(prev, curr, next, delta, join);
}

/** Expand an open polyline into a closed stroke outline polygon. */
export function expandOpenPolylineStroke(
  points: Point2[],
  params: StrokeGeometryParams,
): Point2[] {
  if (points.length < 2 || params.width < 1e-9) return [];
  const half = params.width / 2;
  const join = params.join;
  const cap = params.cap;
  const n = points.length;
  const left: Point2[] = [];
  const right: Point2[] = [];

  for (let i = 0; i < n; i++) {
    left.push(offsetSideAtVertex(points, i, half, false, join));
    right.push(offsetSideAtVertex(points, i, -half, false, join));
  }

  const startDir = { x: points[1]!.x - points[0]!.x, y: points[1]!.y - points[0]!.y };
  const endDir = { x: points[n - 1]!.x - points[n - 2]!.x, y: points[n - 1]!.y - points[n - 2]!.y };
  const startCap = createCapGeometry(points[0]!, startDir, half, cap, left[0]!, right[0]!, true);
  const endCap = createCapGeometry(points[n - 1]!, endDir, half, cap, left[n - 1]!, right[n - 1]!, false);

  return mergeStrokePolygons([left, startCap, right.slice().reverse(), endCap]);
}

/** Expand a closed contour into inner/outer stroke band geometry. */
export function expandClosedContourStroke(
  contour: Point2[],
  params: StrokeGeometryParams,
): { outer: Point2[]; inner: Point2[] } | null {
  if (contour.length < 3 || params.width < 1e-9) return null;
  const half = params.width / 2;
  let outerDelta = half;
  let innerDelta = half;
  if (params.align === "inside") {
    outerDelta = 0;
    innerDelta = params.width;
  } else if (params.align === "outside") {
    outerDelta = params.width;
    innerDelta = 0;
  }
  const outer =
    outerDelta > 1e-9
      ? offsetPolygonPoints(contour, outerDelta, params.join)
      : contour.map(copyPoint);
  const inner =
    innerDelta > 1e-9
      ? offsetPolygonPoints(contour, -innerDelta, params.join)
      : params.align === "outside"
        ? contour.map(copyPoint)
        : [];
  return { outer, inner };
}

export function mergeStrokePolygons(rings: Point2[][]): Point2[] {
  const out: Point2[] = [];
  for (const ring of rings) {
    for (const p of ring) {
      if (out.length === 0 || !pointsEqual(out[out.length - 1]!, p)) out.push(copyPoint(p));
    }
  }
  if (out.length >= 3 && !pointsEqual(out[0]!, out[out.length - 1]!)) {
    out.push(copyPoint(out[0]!));
  }
  return out;
}

function closedRingToPathD(outer: Point2[], inner: Point2[]): { pathD: string; fillRule: "nonzero" | "evenodd" } {
  const outerD = pointsToClosedPathD(outer);
  if (inner.length < 3) {
    return { pathD: outerD, fillRule: "nonzero" };
  }
  const innerD = pointsToClosedPathD(inner);
  return { pathD: `${outerD} ${innerD}`, fillRule: "evenodd" };
}

function polylineToPathD(points: Point2[]): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  return `M ${first!.x} ${first!.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")} Z`;
}

function pointsToPathPoints(points: Point2[]): PathPoint[] {
  return points.map((p) => ({ id: newPathPointId(), x: p.x, y: p.y }));
}

function rectBandToPathD(r: StrokeEdgeRect): string {
  const x1 = r.x + r.width;
  const y1 = r.y + r.height;
  return `M ${r.x} ${r.y} H ${x1} V ${y1} H ${r.x} Z`;
}

function mergePathParts(parts: string[]): { pathD: string; fillRule: "nonzero" | "evenodd" } {
  const clean = parts.filter((p) => p.trim().length > 0);
  if (clean.length === 0) return { pathD: "", fillRule: "nonzero" };
  return { pathD: clean.join(" "), fillRule: "nonzero" };
}

function resultFromPathParts(
  parts: string[],
  fill: string,
  fillOpacity: number,
  fillType?: OutlineStrokeResult["fillType"],
  fillGradient?: EditorNode["fillGradient"],
): OutlineStrokeResult | null {
  const { pathD, fillRule } = mergePathParts(parts);
  if (!pathD) return null;
  const outlinePts = tessellateSvgPathD(pathD);
  return {
    pathD,
    fillRule,
    pathPoints: pointsToPathPoints(outlinePts),
    pathClosed: true,
    fill,
    fillOpacity,
    fillType,
    fillGradient,
  };
}

function segmentLength(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function polylineLength(points: Point2[], closed: boolean): number {
  if (points.length < 2) return 0;
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += segmentLength(points[i - 1]!, points[i]!);
  }
  if (closed) len += segmentLength(points[points.length - 1]!, points[0]!);
  return len;
}

/** Point at distance `d` along an open polyline. */
function pointAlongPolyline(points: Point2[], d: number): { point: Point2; segmentIndex: number; t: number } {
  if (points.length === 0) return { point: { x: 0, y: 0 }, segmentIndex: 0, t: 0 };
  if (points.length === 1 || d <= 0) return { point: copyPoint(points[0]!), segmentIndex: 0, t: 0 };
  let traveled = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = segmentLength(a, b);
    if (traveled + seg >= d) {
      const t = seg > 1e-9 ? (d - traveled) / seg : 0;
      return {
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        segmentIndex: i - 1,
        t,
      };
    }
    traveled += seg;
  }
  const last = points[points.length - 1]!;
  return { point: copyPoint(last), segmentIndex: points.length - 2, t: 1 };
}

function sliceOpenPolyline(points: Point2[], start: number, end: number): Point2[] {
  if (points.length < 2 || end <= start + 1e-6) return [];
  const total = polylineLength(points, false);
  const a = Math.max(0, Math.min(start, total));
  const b = Math.max(0, Math.min(end, total));
  if (b <= a + 1e-6) return [];

  const startPt = pointAlongPolyline(points, a);
  const endPt = pointAlongPolyline(points, b);
  const out: Point2[] = [startPt.point];

  for (let i = startPt.segmentIndex + 1; i <= endPt.segmentIndex; i++) {
    const p = points[i]!;
    if (!pointsEqual(out[out.length - 1]!, p)) out.push(copyPoint(p));
  }
  if (!pointsEqual(out[out.length - 1]!, endPt.point)) out.push(endPt.point);
  return out.length >= 2 ? out : [];
}

/**
 * Figma-style dash sampling: half dash at start/end, full dash + gap between.
 * Returns open sub-polylines for each visible dash segment.
 */
export function splitPolylineByDashPattern(
  points: Point2[],
  closed: boolean,
  dash: number,
  gap: number,
): Point2[][] {
  if (points.length < 2 || dash <= 0) return [points.map(copyPoint)];
  const total = polylineLength(points, closed);
  if (total < 1e-6) return [];

  const loopPts = closed ? [...points, points[0]!] : points;
  const segments: Point2[][] = [];
  let pos = 0;
  let draw = true;
  let run = dash / 2;

  while (pos < total - 1e-6) {
    const nextPos = Math.min(pos + run, total);
    if (draw && nextPos > pos + 1e-6) {
      const slice = sliceOpenPolyline(loopPts, pos, nextPos);
      if (slice.length >= 2) segments.push(slice);
    }
    pos = nextPos;
    if (draw) {
      draw = false;
      run = gap > 0 ? gap : dash;
    } else {
      draw = true;
      run = pos + dash >= total - 1e-6 && total - pos <= dash ? dash / 2 : dash;
    }
  }
  return segments;
}

function outlineOpenSegments(
  segments: Point2[][],
  params: StrokeGeometryParams,
): string[] {
  const parts: string[] = [];
  for (const seg of segments) {
    if (seg.length < 2) continue;
    const outline = expandOpenPolylineStroke(seg, params);
    if (outline.length >= 3) parts.push(polylineToPathD(outline));
  }
  return parts;
}

function outlinePerSideRectStroke(node: EditorNode): OutlineStrokeResult | null {
  const spec = resolveStrokeSpec(node);
  const sides = resolveStrokeSides(node);
  const sideWidths = resolveStrokeSideWidths(node);
  const position = spec.align;
  const rects = strokeEdgeRects(node.width, node.height, position, sides, sideWidths);
  const parts = rects.map(rectBandToPathD);
  const fillProps = fillPropsFromNode(node);
  return resultFromPathParts(parts, spec.color, spec.opacity, fillProps.fillType, fillProps.fillGradient);
}

function outlineRoundedSideSegments(
  node: EditorNode,
  segments: StrokeSideSegment[],
): OutlineStrokeResult | null {
  const spec = resolveStrokeSpec(node);
  const parts: string[] = [];
  for (const seg of segments) {
    const pts = tessellateSvgPathD(seg.pathD);
    if (pts.length < 2) continue;
    const outline = expandOpenPolylineStroke(pts, {
      width: seg.width,
      align: "center",
      join: spec.join,
      cap: "butt",
    });
    if (outline.length >= 3) parts.push(polylineToPathD(outline));
  }
  const fillProps = fillPropsFromNode(node);
  return resultFromPathParts(parts, spec.color, spec.opacity, fillProps.fillType, fillProps.fillGradient);
}

function outlinePerSideStroke(node: EditorNode): OutlineStrokeResult | null {
  if (node.type !== "rectangle" && node.type !== "frame") return null;
  if (!usesPerEdgeStroke(node)) return null;

  if (strokeUsesCssIndividualBorders(node) || strokeUsesAxisAlignedRects(node, node.width, node.height)) {
    return outlinePerSideRectStroke(node);
  }

  const segments = roundedRectStrokeSegments(node);
  if (segments?.length) return outlineRoundedSideSegments(node, segments);

  return outlinePerSideRectStroke(node);
}

function fillPropsFromNode(node: EditorNode): {
  fillType: OutlineStrokeResult["fillType"];
  fillGradient?: EditorNode["fillGradient"];
} {
  if (effectiveStrokeType(node) === "gradient" && node.strokeGradient) {
    return { fillType: "gradient", fillGradient: node.strokeGradient };
  }
  return { fillType: "solid" };
}

function textGlyphCenterlines(node: EditorNode): Point2[][] | null {
  if (node.type !== "text") return null;
  if (typeof document === "undefined") return null;
  try {
    const typo = resolveTextTypo(node);
    const style = textAdvancedStyleFromNode(node);
    const display = prepareTextForDisplay(node.content ?? "", style);
    const innerW = textInnerWidth(node.width);
    const layout = layoutText(display, innerW, typo, style);
    const lines: Point2[][] = [];
    const padX = TEXT_BOX_PAD_X;
    for (let i = 0; i < layout.lines.length; i++) {
      const ln = layout.lines[i]!;
      if (!ln.text.length) continue;
      const y = lineTopY(layout, i) + typo.fontSize * 0.72 + TEXT_BOX_PAD_Y;
      const x0 = padX;
      const x1 = padX + Math.max(ln.width, 1);
      lines.push([
        { x: x0, y },
        { x: x1, y },
      ]);
    }
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}

function outlineTextStroke(node: EditorNode, spec: ReturnType<typeof resolveStrokeSpec>): OutlineStrokeResult | null {
  const params: StrokeGeometryParams = {
    width: spec.width,
    align: "center",
    join: spec.join,
    cap: spec.cap,
  };
  const fillProps = fillPropsFromNode(node);
  const glyphLines = textGlyphCenterlines(node);
  if (glyphLines) {
    const parts = outlineOpenSegments(glyphLines, params);
    return resultFromPathParts(parts, spec.color, spec.opacity, fillProps.fillType, fillProps.fillGradient);
  }
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);
  const contour = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const base = generateStrokeGeometry(contour, true, { ...params, align: spec.align });
  if (!base) return null;
  return { ...base, ...fillProps, fill: spec.color, fillOpacity: spec.opacity };
}

function booleanGroupContour(
  node: EditorNode,
  ctx?: OutlineStrokeContext,
): { points: Point2[]; closed: boolean } | null {
  if (!node.isBooleanGroup || !ctx?.childOrder || !ctx.nodes) return null;
  const childIds = ctx.childOrder[node.id] ?? [];
  if (childIds.length === 0) return null;
  const composite = buildCompositePathDForGroup(
    node.id,
    childIds,
    ctx.nodes,
    node.booleanOperation ?? "union",
    ctx.childOrder,
  );
  if (!composite?.d) return null;
  const points = tessellateSvgPathD(composite.d);
  return points.length >= 3 ? { points, closed: true } : null;
}

/** Generate stroke outline geometry from a centerline polyline. */
export function generateStrokeGeometry(
  points: Point2[],
  closed: boolean,
  params: StrokeGeometryParams,
): OutlineStrokeResult | null {
  if (points.length < 2 || params.width < 1e-9) return null;

  if (closed) {
    const band = expandClosedContourStroke(points, params);
    if (!band) return null;
    const { pathD, fillRule } = closedRingToPathD(band.outer, band.inner);
    const outlinePts =
      fillRule === "evenodd"
        ? tessellateSvgPathD(pathD)
        : band.outer;
    return {
      pathD,
      fillRule,
      pathPoints: pointsToPathPoints(outlinePts),
      pathClosed: true,
      fill: "#000000",
      fillOpacity: 1,
    };
  }

  const outline = expandOpenPolylineStroke(points, params);
  if (outline.length < 3) return null;
  return {
    pathD: polylineToPathD(outline),
    fillRule: "nonzero",
    pathPoints: pointsToPathPoints(outline),
    pathClosed: true,
    fill: "#000000",
    fillOpacity: 1,
  };
}

/** Step 1 — build centerline contour for any layer with stroke. */
export function centerlineContourForNode(
  node: EditorNode,
  ctx?: OutlineStrokeContext,
): { points: Point2[]; closed: boolean } | null {
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);

  if (node.isBooleanGroup) {
    return booleanGroupContour(node, ctx);
  }

  if (node.type === "text") {
    const glyphLines = textGlyphCenterlines(node);
    if (glyphLines?.[0] && glyphLines.length === 1 && glyphLines[0]!.length >= 2) {
      return { points: glyphLines[0]!, closed: false };
    }
    if (glyphLines && glyphLines.length > 1) return null;
    return {
      points: [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ],
      closed: true,
    };
  }

  if (node.type === "group" || node.type === "image") {
    return {
      points: [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ],
      closed: true,
    };
  }

  if (node.type === "rectangle" || node.type === "frame") {
    const radii = clampCornerRadii(getNodeCornerRadii(node), w, h);
    return { points: roundedRectPolygonPoints(w, h, radii, 10), closed: true };
  }

  if (node.type === "ellipse") {
    return { points: generatePolygonPoints(ELLIPSE_SEGMENTS, w, h), closed: true };
  }

  if (isPolygonNode(node)) {
    const d = polygonPathDForNode(node);
    return { points: tessellateSvgPathD(d), closed: true };
  }

  if (node.type === "path" && isStarNode(node)) {
    const d = starPathDForNode(node);
    return { points: tessellateSvgPathD(d), closed: true };
  }

  if (node.type === "path") {
    if (node.flattenedPathData) {
      return { points: tessellateSvgPathD(node.flattenedPathData), closed: true };
    }
    if (node.pathPoints?.length) {
      return {
        points: tessellatePathPoints(node.pathPoints, node.pathClosed ?? false),
        closed: node.pathClosed ?? false,
      };
    }
    return null;
  }

  if (node.type === "line" || node.type === "arrow") {
    const ep = lineEndpointsFromNode(node);
    return {
      points: [
        { x: ep.x1, y: ep.y1 },
        { x: ep.x2, y: ep.y2 },
      ],
      closed: false,
    };
  }

  return null;
}

export function canOutlineStroke(node: EditorNode | null | undefined): boolean {
  if (!node || node.locked || node.visible === false) return false;
  return strokeSpecIsVisible(resolveStrokeSpec(node));
}

function outlineDashedStroke(
  node: EditorNode,
  points: Point2[],
  closed: boolean,
  params: StrokeGeometryParams,
  spec: ReturnType<typeof resolveStrokeSpec>,
): OutlineStrokeResult | null {
  const dash = spec.dashPattern[0] ?? 0;
  const gap = spec.dashPattern[1] ?? dash;
  if (!spec.dashPattern.length || dash <= 0) return null;

  const segments = splitPolylineByDashPattern(points, closed, dash, gap);
  const parts = outlineOpenSegments(segments, params);
  const fillProps = fillPropsFromNode(node);
  return resultFromPathParts(parts, spec.color, spec.opacity, fillProps.fillType, fillProps.fillGradient);
}

function outlineTextGlyphLines(
  node: EditorNode,
  spec: ReturnType<typeof resolveStrokeSpec>,
): OutlineStrokeResult | null {
  const glyphLines = textGlyphCenterlines(node);
  if (!glyphLines?.length) return outlineTextStroke(node, spec);
  const params: StrokeGeometryParams = {
    width: spec.width,
    align: "center",
    join: spec.join,
    cap: spec.cap,
  };
  const fillProps = fillPropsFromNode(node);
  if (spec.dashPattern.length > 0) {
    const parts: string[] = [];
    for (const line of glyphLines) {
      const dash = spec.dashPattern[0] ?? 0;
      const gap = spec.dashPattern[1] ?? dash;
      const segments = splitPolylineByDashPattern(line, false, dash, gap);
      parts.push(...outlineOpenSegments(segments, params));
    }
    return resultFromPathParts(parts, spec.color, spec.opacity, fillProps.fillType, fillProps.fillGradient);
  }
  const parts = outlineOpenSegments(glyphLines, params);
  return resultFromPathParts(parts, spec.color, spec.opacity, fillProps.fillType, fillProps.fillGradient);
}

/** Convert stroked shape into filled vector path geometry (Figma Outline Stroke). */
export function outlineStroke(
  node: EditorNode,
  ctx?: OutlineStrokeContext,
): OutlineStrokeResult | null {
  if (!canOutlineStroke(node)) return null;
  const spec = resolveStrokeSpec(node);
  const fillProps = fillPropsFromNode(node);

  const perSide = outlinePerSideStroke(node);
  if (perSide) return perSide;

  if (node.type === "text") {
    return outlineTextGlyphLines(node, spec);
  }

  const params: StrokeGeometryParams = {
    width: spec.width,
    align: spec.align,
    join: spec.join,
    cap: spec.cap,
  };

  const contour = centerlineContourForNode(node, ctx);
  if (!contour || contour.points.length < 2) return null;

  const points = contour.points;
  const closed = contour.closed;

  if (spec.dashPattern.length > 0) {
    const dashed = outlineDashedStroke(node, points, closed, params, spec);
    if (dashed) return dashed;
  }

  const base = generateStrokeGeometry(points, closed, params);
  if (!base) return null;

  return {
    ...base,
    fill: spec.color,
    fillOpacity: spec.opacity,
    ...fillProps,
  };
}

function clearStrokeFields(): Partial<EditorNode> {
  return {
    strokeWidth: 0,
    strokeEnabled: false,
    stroke: {
      enabled: false,
      color: "#0f172a",
      width: 0,
      opacity: 1,
      align: "center",
      join: "miter",
      cap: "butt",
      dashPattern: [],
    },
    strokeColor: undefined,
    strokeType: "solid",
    strokeGradient: undefined,
    strokeOpacity: 1,
    strokePosition: "center",
    strokeStyle: "solid",
    strokeDashLength: undefined,
    strokeDashGap: undefined,
    strokeLinecap: "butt",
    strokeLinejoin: "miter",
    strokeStartPoint: "none",
    strokeEndPoint: "none",
    strokeSides: "all",
    strokeSidesCustom: undefined,
    startArrow: "none",
    endArrow: "none",
    arrowHead: false,
    strokeWidthProfile: "uniform",
  };
}

/** Apply outline stroke to a node, returning a path-shaped replacement. */
export function convertStrokeToVector(
  node: EditorNode,
  ctx?: OutlineStrokeContext,
): EditorNode | null {
  const result = outlineStroke(node, ctx);
  if (!result) return null;

  const useCompound = result.fillRule === "evenodd" || result.pathD.includes(" Z ");
  const next: EditorNode = {
    ...node,
    type: "path",
    pathPoints: result.pathPoints,
    pathClosed: true,
    flattenedPathData: useCompound ? result.pathD : undefined,
    pathFillRule: result.fillRule,
    fill: result.fill,
    fillEnabled: true,
    fillOpacity: result.fillOpacity,
    fillType: result.fillType ?? "solid",
    fillGradient: result.fillGradient,
    isBooleanGroup: undefined,
    booleanOperation: undefined,
    polygonSides: undefined,
    starPoints: undefined,
    starInnerRadius: undefined,
    lineX1: undefined,
    lineY1: undefined,
    lineX2: undefined,
    lineY2: undefined,
    arrowHead: undefined,
    startArrow: undefined,
    endArrow: undefined,
    arcStartDeg: undefined,
    arcSweepDeg: undefined,
    arcInnerRadiusRatio: undefined,
    content: node.type === "text" ? node.content : undefined,
    ...clearStrokeFields(),
  };
  return normalizePathNode(next);
}

/** Child ids to remove when a boolean group is converted to a path. */
export function booleanGroupChildrenToRemove(
  node: EditorNode,
  ctx?: OutlineStrokeContext,
): string[] {
  if (!node.isBooleanGroup || !ctx?.childOrder) return [];
  return ctx.childOrder[node.id] ?? [];
}

export { strokeSpecColorRgba };
