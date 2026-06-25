import {
  clampCornerRadii,
  getNodeCornerRadii,
  type CornerRadii,
} from "@/lib/cornerRadius";
import { pointsToClosedPathD, type Point2 } from "@/lib/strokeOffset";
import {
  resolveStrokeSideWidths,
  resolveStrokeSides,
  type ResolvedStrokeSides,
  type ResolvedStrokeSideWidths,
} from "@/lib/strokeAlign";
import type { EditorNode, StrokePosition } from "@/stores/useEditorStore";
import type { CornerArcPortion, RectCorner, RectStrokeSide } from "@/lib/roundedRectSideStroke";
import {
  cornerExtentAlongSide,
  roundedRectCornerPolyline,
  sideJoin,
  type RoundedRectCorner,
  type RoundedRectRadii,
} from "@/lib/vector/roundedRectPath";

const SIDE_ORDER = ["top", "right", "bottom", "left"] as const;
const CORNER_ARC_K = 0.7071067811865476;
const EPS = 0.001;

export type RoundedRectBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  radii: CornerRadii;
};

export type BorderSideFill = {
  side: RectStrokeSide;
  pathD: string;
  points: Point2[];
  width: number;
};

export type BorderGeometryInput = {
  width: number;
  height: number;
  radii: CornerRadii;
  sides: ResolvedStrokeSides;
  sideWidths: ResolvedStrokeSideWidths;
  position: StrokePosition;
  smoothing?: number;
};

const CORNER_TO_ROUNDED: Record<RectCorner, RoundedRectCorner> = {
  tl: "topLeft",
  tr: "topRight",
  br: "bottomRight",
  bl: "bottomLeft",
};

function shapeRoundedRadii(shape: RoundedRectBounds): RoundedRectRadii {
  const [tl, tr, br, bl] = shape.radii;
  return { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl };
}

function bandRoundedRadii(
  shape: RoundedRectBounds,
  sideWidth: number,
  position: StrokePosition,
  band: "outer" | "inner",
): RoundedRectRadii {
  const [tl, tr, br, bl] = shape.radii;
  return {
    topLeft: borderCornerRadius(tl, sideWidth, position, band),
    topRight: borderCornerRadius(tr, sideWidth, position, band),
    bottomRight: borderCornerRadius(br, sideWidth, position, band),
    bottomLeft: borderCornerRadius(bl, sideWidth, position, band),
  };
}

/** Outer/inner corner contour for border bands (circular arcs or smoothed superellipse). */
function bandCornerPoints(
  corner: RectCorner,
  shape: RoundedRectBounds,
  sideWidth: number,
  position: StrokePosition,
  band: "outer" | "inner",
  portion: CornerArcPortion,
  segments: number,
  smoothing: number,
): Point2[] {
  const shapeR = shape.radii[{ tl: 0, tr: 1, br: 2, bl: 3 }[corner]]!;
  if (smoothing <= EPS) {
    return concentricCornerArcPoints(corner, shapeR, shape, sideWidth, position, band, portion, segments);
  }
  return roundedRectCornerPolyline(
    CORNER_TO_ROUNDED[corner],
    shape.width,
    shape.height,
    bandRoundedRadii(shape, sideWidth, position, band),
    smoothing,
    portion,
    { x: shape.x, y: shape.y },
  );
}

function bandCornerPointsReversed(
  corner: RectCorner,
  shape: RoundedRectBounds,
  sideWidth: number,
  position: StrokePosition,
  band: "outer" | "inner",
  portion: CornerArcPortion,
  segments: number,
  smoothing: number,
): Point2[] {
  return bandCornerPoints(corner, shape, sideWidth, position, band, portion, segments, smoothing).reverse();
}

type SideBandOffsets = {
  outer: number;
  inner: number;
};

function copyPoint(p: Point2): Point2 {
  return { x: p.x, y: p.y };
}

function pointsEqual(a: Point2, b: Point2): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

function appendPoints(out: Point2[], pts: Point2[]): void {
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || !pointsEqual(last, p)) out.push(copyPoint(p));
  }
}

function mergePolygonRing(outer: Point2[], inner: Point2[]): Point2[] {
  const ring = [...outer];
  appendPoints(ring, inner);
  if (ring.length >= 3 && !pointsEqual(ring[0]!, ring[ring.length - 1]!)) {
    ring.push(copyPoint(ring[0]!));
  }
  return ring;
}

function activeWidth(
  side: RectStrokeSide,
  sides: ResolvedStrokeSides,
  sideWidths: ResolvedStrokeSideWidths,
): number {
  return sides[side] ? Math.max(0, sideWidths[side]) : 0;
}

function sideBandOffsets(position: StrokePosition, sideWidth: number): SideBandOffsets {
  const w = Math.max(0, sideWidth);
  if (position === "inside") return { outer: 0, inner: w };
  if (position === "outside") return { outer: w, inner: 0 };
  const half = w / 2;
  return { outer: half, inner: half };
}

function borderCornerRadius(
  shapeRadius: number,
  sideWidth: number,
  position: StrokePosition,
  band: "outer" | "inner",
): number {
  const r = Math.max(0, shapeRadius);
  const w = Math.max(0, sideWidth);
  if (position === "inside") return band === "outer" ? r : Math.max(0, r - w);
  if (position === "outside") return band === "outer" ? r + w : r;
  const half = w / 2;
  return band === "outer" ? r + half : Math.max(0, r - half);
}

function segmentsForRadius(radius: number): number {
  return Math.max(12, Math.ceil(Math.max(0, radius) / 1.5));
}

function cornerArcCenter(corner: RectCorner, shapeR: number, shape: RoundedRectBounds): Point2 {
  const { width: w, height: h } = shape;
  switch (corner) {
    case "tl":
      return { x: shape.x + shapeR, y: shape.y + shapeR };
    case "tr":
      return { x: shape.x + w - shapeR, y: shape.y + shapeR };
    case "br":
      return { x: shape.x + w - shapeR, y: shape.y + h - shapeR };
    case "bl":
      return { x: shape.x + shapeR, y: shape.y + h - shapeR };
    default:
      return { x: shape.x, y: shape.y };
  }
}

/** Clockwise sweep angles per corner (matches roundedCornerArc / SVG sweep-flag 1). */
function cornerArcSweep(
  corner: RectCorner,
  portion: CornerArcPortion,
): { startAngle: number; endAngle: number } {
  const q = Math.PI / 2;
  const h = Math.PI / 4;
  switch (corner) {
    case "tl":
      if (portion === "first") return { startAngle: Math.PI, endAngle: Math.PI + h };
      if (portion === "second") return { startAngle: Math.PI + h, endAngle: Math.PI + q };
      return { startAngle: Math.PI, endAngle: Math.PI + q };
    case "tr":
      if (portion === "first") return { startAngle: -q, endAngle: -h };
      if (portion === "second") return { startAngle: -h, endAngle: 0 };
      return { startAngle: -q, endAngle: 0 };
    case "br":
      if (portion === "first") return { startAngle: 0, endAngle: h };
      if (portion === "second") return { startAngle: h, endAngle: q };
      return { startAngle: 0, endAngle: q };
    case "bl":
      if (portion === "first") return { startAngle: q, endAngle: q + h };
      if (portion === "second") return { startAngle: q + h, endAngle: Math.PI };
      return { startAngle: q, endAngle: Math.PI };
    default:
      return { startAngle: 0, endAngle: 0 };
  }
}

function arcAnglePoints(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number,
): Point2[] {
  if (radius <= 0) return [];
  const out: Point2[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + (endAngle - startAngle) * t;
    out.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
  }
  return out;
}

/** Concentric corner arc sharing the shape corner center (matches roundedCornerArc trim). */
function concentricCornerArcPoints(
  corner: RectCorner,
  shapeRadius: number,
  shape: RoundedRectBounds,
  sideWidth: number,
  position: StrokePosition,
  band: "outer" | "inner",
  portion: CornerArcPortion,
  segments: number,
): Point2[] {
  const radius = borderCornerRadius(shapeRadius, sideWidth, position, band);
  if (radius <= 0) return [];
  const { x: cx, y: cy } = cornerArcCenter(corner, shapeRadius, shape);
  const { startAngle, endAngle } = cornerArcSweep(corner, portion);
  return arcAnglePoints(cx, cy, radius, startAngle, endAngle, Math.max(4, segments));
}

function concentricCornerArcPointsReversed(
  corner: RectCorner,
  shapeRadius: number,
  shape: RoundedRectBounds,
  sideWidth: number,
  position: StrokePosition,
  band: "outer" | "inner",
  portion: CornerArcPortion,
  segments: number,
): Point2[] {
  return concentricCornerArcPoints(
    corner,
    shapeRadius,
    shape,
    sideWidth,
    position,
    band,
    portion,
    segments,
  ).reverse();
}

function cornerSeamPoint(
  corner: RectCorner,
  shapeRadius: number,
  shape: RoundedRectBounds,
  sideWidth: number,
  position: StrokePosition,
  band: "outer" | "inner",
): Point2 {
  const { endAngle } = cornerArcSweep(corner, "first");
  const { x: cx, y: cy } = cornerArcCenter(corner, shapeRadius, shape);
  const radius = borderCornerRadius(shapeRadius, sideWidth, position, band);
  return { x: cx + radius * Math.cos(endAngle), y: cy + radius * Math.sin(endAngle) };
}

/** Radial segment bridging adjacent sides with different stroke widths at a shared corner. */
function appendCornerSeamConnector(
  out: Point2[],
  corner: RectCorner,
  shapeRadius: number,
  shape: RoundedRectBounds,
  ownWidth: number,
  adjacentWidth: number,
  position: StrokePosition,
  band: "outer" | "inner",
): void {
  if (Math.abs(ownWidth - adjacentWidth) <= EPS) return;
  const own = cornerSeamPoint(corner, shapeRadius, shape, ownWidth, position, band);
  const adj = cornerSeamPoint(corner, shapeRadius, shape, adjacentWidth, position, band);
  appendPoints(out, [own, adj]);
}

/** Inner ring: splice radial bridge after the seam point of a reversed first-portion arc. */
function appendInnerCornerArcWithSeam(
  out: Point2[],
  corner: RectCorner,
  shapeRadius: number,
  shape: RoundedRectBounds,
  ownWidth: number,
  adjacentWidth: number | undefined,
  position: StrokePosition,
  portion: CornerArcPortion,
  segments: number,
  smoothing: number,
): void {
  const pts = bandCornerPointsReversed(
    corner,
    shape,
    ownWidth,
    position,
    "inner",
    portion,
    segments,
    smoothing,
  );
  if (
    portion === "first" &&
    adjacentWidth != null &&
    Math.abs(ownWidth - adjacentWidth) > EPS &&
    pts.length > 0
  ) {
    const adj = cornerSeamPoint(corner, shapeRadius, shape, adjacentWidth, position, "inner");
    appendPoints(out, [pts[0]!, adj]);
    appendPoints(out, pts.slice(1));
    return;
  }
  appendPoints(out, pts);
}

function shapeBounds(input: BorderGeometryInput): RoundedRectBounds {
  const [tl, tr, br, bl] = clampCornerRadii(input.radii, input.width, input.height);
  return { x: 0, y: 0, width: input.width, height: input.height, radii: [tl, tr, br, bl] };
}

/** Legacy ring bounds (used by tests). */
export function resolveBorderRingBounds(input: BorderGeometryInput): {
  outer: RoundedRectBounds;
  inner: RoundedRectBounds;
} | null {
  const shape = shapeBounds(input);
  const t = activeWidth("top", input.sides, input.sideWidths);
  const r = activeWidth("right", input.sides, input.sideWidths);
  const b = activeWidth("bottom", input.sides, input.sideWidths);
  const l = activeWidth("left", input.sides, input.sideWidths);
  const position = input.position ?? "center";

  if (position === "inside") {
    return {
      outer: shape,
      inner: { x: l, y: t, width: Math.max(0, shape.width - l - r), height: Math.max(0, shape.height - t - b), radii: shape.radii },
    };
  }
  if (position === "outside") {
    return {
      outer: { x: -l, y: -t, width: shape.width + l + r, height: shape.height + t + b, radii: shape.radii },
      inner: shape,
    };
  }
  const half = { top: t / 2, right: r / 2, bottom: b / 2, left: l / 2 };
  return {
    outer: { x: -half.left, y: -half.top, width: shape.width + half.left + half.right, height: shape.height + half.top + half.bottom, radii: shape.radii },
    inner: { x: half.left, y: half.top, width: Math.max(0, shape.width - half.left - half.right), height: Math.max(0, shape.height - half.top - half.bottom), radii: shape.radii },
  };
}

function topBandY(position: StrokePosition, sideWidth: number, band: "outer" | "inner"): number {
  const { outer, inner } = sideBandOffsets(position, sideWidth);
  if (position === "inside") return band === "outer" ? 0 : inner;
  if (position === "outside") return band === "outer" ? -outer : 0;
  return band === "outer" ? -outer : inner;
}

function rightBandX(position: StrokePosition, sideWidth: number, shapeWidth: number, band: "outer" | "inner"): number {
  const { outer, inner } = sideBandOffsets(position, sideWidth);
  if (position === "inside") return band === "outer" ? shapeWidth : shapeWidth - inner;
  if (position === "outside") return band === "outer" ? shapeWidth + outer : shapeWidth;
  return band === "outer" ? shapeWidth + outer : shapeWidth - inner;
}

function bottomBandY(position: StrokePosition, sideWidth: number, shapeHeight: number, band: "outer" | "inner"): number {
  const { outer, inner } = sideBandOffsets(position, sideWidth);
  if (position === "inside") return band === "outer" ? shapeHeight : shapeHeight - inner;
  if (position === "outside") return band === "outer" ? shapeHeight + outer : shapeHeight;
  return band === "outer" ? shapeHeight + outer : shapeHeight - inner;
}

function leftBandX(position: StrokePosition, sideWidth: number, band: "outer" | "inner"): number {
  const { outer, inner } = sideBandOffsets(position, sideWidth);
  if (position === "inside") return band === "outer" ? 0 : inner;
  if (position === "outside") return band === "outer" ? -outer : 0;
  return band === "outer" ? -outer : inner;
}

function buildTopBorderPolygon(
  shape: RoundedRectBounds,
  sides: ResolvedStrokeSides,
  sideWidth: number,
  sideWidths: ResolvedStrokeSideWidths,
  position: StrokePosition,
  smoothing: number,
): Point2[] | null {
  const [otl, otr] = shape.radii;
  const outerPts: Point2[] = [];
  const innerPts: Point2[] = [];
  const outerY = topBandY(position, sideWidth, "outer");
  const innerY = topBandY(position, sideWidth, "inner");
  const segTl = segmentsForRadius(otl);
  const segTr = segmentsForRadius(otr);
  const shapeRadii = shapeRoundedRadii(shape);
  const pTL = cornerExtentAlongSide("topLeft", shape.width, shape.height, shapeRadii, smoothing);
  const pTR = cornerExtentAlongSide("topRight", shape.width, shape.height, shapeRadii, smoothing);

  const tlOuter = sides.left ? "first" : "full";
  if (otl > 0) {
    appendPoints(
      outerPts,
      bandCornerPoints("tl", shape, sideWidth, position, "outer", tlOuter, segTl, smoothing),
    );
    if (sides.left) {
      appendCornerSeamConnector(outerPts, "tl", otl, shape, sideWidth, sideWidths.left, position, "outer");
    }
  } else {
    appendPoints(outerPts, [{ x: shape.x, y: outerY }]);
  }

  const topX0 = otl > 0 ? shape.x + (smoothing > EPS ? pTL : otl) : shape.x;
  const topX1 = shape.x + shape.width - (otr > 0 ? (smoothing > EPS ? pTR : otr) : 0);
  if (topX1 - topX0 > EPS) appendPoints(outerPts, [{ x: topX0, y: outerY }, { x: topX1, y: outerY }]);

  const trOuter = sides.right ? "first" : "full";
  if (otr > 0) {
    appendPoints(
      outerPts,
      bandCornerPoints("tr", shape, sideWidth, position, "outer", trOuter, segTr, smoothing).slice(1),
    );
    if (sides.right) {
      appendCornerSeamConnector(outerPts, "tr", otr, shape, sideWidth, sideWidths.right, position, "outer");
    }
  }

  const trInner = sides.right ? "first" : "full";
  if (otr > 0) {
    appendInnerCornerArcWithSeam(
      innerPts,
      "tr",
      otr,
      shape,
      sideWidth,
      sides.right ? sideWidths.right : undefined,
      position,
      trInner,
      segTr,
      smoothing,
    );
  } else {
    appendPoints(innerPts, [{ x: topX1, y: innerY }]);
  }

  if (topX1 - topX0 > EPS) appendPoints(innerPts, [{ x: topX1, y: innerY }, { x: topX0, y: innerY }]);

  const tlInner = sides.left ? "first" : "full";
  if (otl > 0) {
    const tlInnerPts = bandCornerPointsReversed(
      "tl",
      shape,
      sideWidth,
      position,
      "inner",
      tlInner,
      segTl,
      smoothing,
    );
    appendPoints(innerPts, tlInnerPts.slice(1));
    if (sides.left) {
      appendCornerSeamConnector(innerPts, "tl", otl, shape, sideWidth, sideWidths.left, position, "inner");
    }
  } else {
    appendPoints(innerPts, [{ x: topX0, y: innerY }]);
  }

  if (outerPts.length < 2 || innerPts.length < 2) return null;
  return mergePolygonRing(outerPts, innerPts);
}

function buildRightBorderPolygon(
  shape: RoundedRectBounds,
  sides: ResolvedStrokeSides,
  sideWidth: number,
  sideWidths: ResolvedStrokeSideWidths,
  position: StrokePosition,
  smoothing: number,
): Point2[] | null {
  const [, otr, obr] = shape.radii;
  const outerPts: Point2[] = [];
  const innerPts: Point2[] = [];
  const outerX = rightBandX(position, sideWidth, shape.width, "outer");
  const innerX = rightBandX(position, sideWidth, shape.width, "inner");
  const segTr = segmentsForRadius(otr);
  const segBr = segmentsForRadius(obr);
  const shapeRadii = shapeRoundedRadii(shape);
  const pTR = cornerExtentAlongSide("topRight", shape.width, shape.height, shapeRadii, smoothing);
  const pBR = cornerExtentAlongSide("bottomRight", shape.width, shape.height, shapeRadii, smoothing);

  const trOuter = sides.top ? "second" : "full";
  if (otr > 0) {
    appendPoints(
      outerPts,
      bandCornerPoints("tr", shape, sideWidth, position, "outer", trOuter, segTr, smoothing),
    );
  } else {
    appendPoints(outerPts, [{ x: outerX, y: shape.y }]);
  }

  const rightY0 = otr > 0 ? shape.y + (smoothing > EPS ? pTR : otr) : shape.y;
  const rightY1 =
    shape.y +
    shape.height -
    (obr > 0 ? (smoothing > EPS ? sideJoin(shape.height, pBR) : obr) : 0);
  if (rightY1 - rightY0 > EPS) {
    appendPoints(outerPts, [{ x: outerX, y: rightY0 }, { x: outerX, y: rightY1 }]);
  }

  const brOuter = sides.bottom ? "first" : "full";
  if (obr > 0) {
    appendPoints(
      outerPts,
      bandCornerPoints("br", shape, sideWidth, position, "outer", brOuter, segBr, smoothing).slice(1),
    );
    if (sides.bottom) {
      appendCornerSeamConnector(outerPts, "br", obr, shape, sideWidth, sideWidths.bottom, position, "outer");
    }
  }

  const brInner = sides.bottom ? "first" : "full";
  if (obr > 0) {
    appendInnerCornerArcWithSeam(
      innerPts,
      "br",
      obr,
      shape,
      sideWidth,
      sides.bottom ? sideWidths.bottom : undefined,
      position,
      brInner,
      segBr,
      smoothing,
    );
  } else {
    appendPoints(innerPts, [{ x: innerX, y: rightY1 }]);
  }

  if (rightY1 - rightY0 > EPS) appendPoints(innerPts, [{ x: innerX, y: rightY1 }, { x: innerX, y: rightY0 }]);

  const trInner = sides.top ? "second" : "full";
  if (otr > 0) {
    appendPoints(
      innerPts,
      bandCornerPointsReversed("tr", shape, sideWidth, position, "inner", trInner, segTr, smoothing).slice(1),
    );
  } else {
    appendPoints(innerPts, [{ x: innerX, y: rightY0 }]);
  }

  if (outerPts.length < 2 || innerPts.length < 2) return null;
  return mergePolygonRing(outerPts, innerPts);
}

function buildBottomBorderPolygon(
  shape: RoundedRectBounds,
  sides: ResolvedStrokeSides,
  sideWidth: number,
  sideWidths: ResolvedStrokeSideWidths,
  position: StrokePosition,
  smoothing: number,
): Point2[] | null {
  const [, , obr, obl] = shape.radii;
  const outerPts: Point2[] = [];
  const innerPts: Point2[] = [];
  const outerY = bottomBandY(position, sideWidth, shape.height, "outer");
  const innerY = bottomBandY(position, sideWidth, shape.height, "inner");
  const segBr = segmentsForRadius(obr);
  const segBl = segmentsForRadius(obl);
  const shapeRadii = shapeRoundedRadii(shape);
  const pBR = cornerExtentAlongSide("bottomRight", shape.width, shape.height, shapeRadii, smoothing);
  const pBL = cornerExtentAlongSide("bottomLeft", shape.width, shape.height, shapeRadii, smoothing);

  const brOuter = sides.right ? "second" : "full";
  if (obr > 0) {
    appendPoints(
      outerPts,
      bandCornerPoints("br", shape, sideWidth, position, "outer", brOuter, segBr, smoothing),
    );
  } else {
    appendPoints(outerPts, [{ x: shape.x + shape.width, y: outerY }]);
  }

  const bottomX0 =
    shape.x +
    shape.width -
    (obr > 0 ? (smoothing > EPS ? pBR : obr) : 0);
  const bottomX1 = shape.x + (obl > 0 ? (smoothing > EPS ? sideJoin(shape.width, pBL) : obl) : 0);
  if (bottomX0 - bottomX1 > EPS) {
    appendPoints(outerPts, [{ x: bottomX0, y: outerY }, { x: bottomX1, y: outerY }]);
  }

  const blOuter = sides.left ? "first" : "full";
  if (obl > 0) {
    appendPoints(
      outerPts,
      bandCornerPoints("bl", shape, sideWidth, position, "outer", blOuter, segBl, smoothing).slice(1),
    );
    if (sides.left) {
      appendCornerSeamConnector(outerPts, "bl", obl, shape, sideWidth, sideWidths.left, position, "outer");
    }
  }

  const blInner = sides.left ? "first" : "full";
  if (obl > 0) {
    appendInnerCornerArcWithSeam(
      innerPts,
      "bl",
      obl,
      shape,
      sideWidth,
      sides.left ? sideWidths.left : undefined,
      position,
      blInner,
      segBl,
      smoothing,
    );
  } else {
    appendPoints(innerPts, [{ x: bottomX1, y: innerY }]);
  }

  if (bottomX0 - bottomX1 > EPS) appendPoints(innerPts, [{ x: bottomX1, y: innerY }, { x: bottomX0, y: innerY }]);

  const brInner = sides.right ? "second" : "full";
  if (obr > 0) {
    appendPoints(
      innerPts,
      bandCornerPointsReversed("br", shape, sideWidth, position, "inner", brInner, segBr, smoothing).slice(1),
    );
  } else {
    appendPoints(innerPts, [{ x: bottomX0, y: innerY }]);
  }

  if (outerPts.length < 2 || innerPts.length < 2) return null;
  return mergePolygonRing(outerPts, innerPts);
}

function buildLeftBorderPolygon(
  shape: RoundedRectBounds,
  sides: ResolvedStrokeSides,
  sideWidth: number,
  sideWidths: ResolvedStrokeSideWidths,
  position: StrokePosition,
  smoothing: number,
): Point2[] | null {
  const [otl, , , obl] = shape.radii;
  const outerPts: Point2[] = [];
  const innerPts: Point2[] = [];
  const outerX = leftBandX(position, sideWidth, "outer");
  const innerX = leftBandX(position, sideWidth, "inner");
  const segTl = segmentsForRadius(otl);
  const segBl = segmentsForRadius(obl);
  const shapeRadii = shapeRoundedRadii(shape);
  const pTL = cornerExtentAlongSide("topLeft", shape.width, shape.height, shapeRadii, smoothing);
  const pBL = cornerExtentAlongSide("bottomLeft", shape.width, shape.height, shapeRadii, smoothing);

  const blOuter = sides.bottom ? "second" : "full";
  if (obl > 0) {
    appendPoints(
      outerPts,
      bandCornerPoints("bl", shape, sideWidth, position, "outer", blOuter, segBl, smoothing),
    );
  } else {
    appendPoints(outerPts, [{ x: outerX, y: shape.y + shape.height }]);
  }

  const leftY0 =
    shape.y +
    shape.height -
    (obl > 0 ? (smoothing > EPS ? pBL : obl) : 0);
  const leftY1 = shape.y + (otl > 0 ? (smoothing > EPS ? sideJoin(shape.height, pTL) : otl) : 0);
  if (leftY0 - leftY1 > EPS) {
    appendPoints(outerPts, [{ x: outerX, y: leftY0 }, { x: outerX, y: leftY1 }]);
  }

  const tlOuter = sides.top ? "second" : "full";
  if (otl > 0) {
    appendPoints(
      outerPts,
      bandCornerPoints("tl", shape, sideWidth, position, "outer", tlOuter, segTl, smoothing).slice(1),
    );
  }

  const tlInner = sides.top ? "second" : "full";
  if (otl > 0) {
    appendPoints(
      innerPts,
      bandCornerPointsReversed("tl", shape, sideWidth, position, "inner", tlInner, segTl, smoothing),
    );
  } else {
    appendPoints(innerPts, [{ x: innerX, y: leftY1 }]);
  }

  if (leftY0 - leftY1 > EPS) appendPoints(innerPts, [{ x: innerX, y: leftY1 }, { x: innerX, y: leftY0 }]);

  const blInner = sides.bottom ? "second" : "full";
  if (obl > 0) {
    appendPoints(
      innerPts,
      bandCornerPointsReversed("bl", shape, sideWidth, position, "inner", blInner, segBl, smoothing).slice(1),
    );
  } else {
    appendPoints(innerPts, [{ x: innerX, y: leftY0 }]);
  }

  if (outerPts.length < 2 || innerPts.length < 2) return null;
  return mergePolygonRing(outerPts, innerPts);
}

const SIDE_BUILDERS = {
  top: buildTopBorderPolygon,
  right: buildRightBorderPolygon,
  bottom: buildBottomBorderPolygon,
  left: buildLeftBorderPolygon,
} as const;

/** Filled border polygons per active side (no stroke primitives). */
export function buildRoundedRectBorderFills(input: BorderGeometryInput): BorderSideFill[] {
  const shape = shapeBounds(input);
  const position = input.position ?? "center";
  const smoothing = Math.max(0, Math.min(1, input.smoothing ?? 0));
  const fills: BorderSideFill[] = [];

  for (const side of SIDE_ORDER) {
    if (!input.sides[side] || input.sideWidths[side] <= 0) continue;
    const points = SIDE_BUILDERS[side](
      shape,
      input.sides,
      input.sideWidths[side],
      input.sideWidths,
      position,
      smoothing,
    );
    if (!points || points.length < 3) continue;
    fills.push({
      side,
      points,
      pathD: pointsToClosedPathD(points),
      width: input.sideWidths[side],
    });
  }
  return fills;
}

export function shapeHasCornerRadius(
  node: Pick<EditorNode, "cornerRadius" | "cornerRadii">,
  width: number,
  height: number,
): boolean {
  const [tl, tr, br, bl] = clampCornerRadii(getNodeCornerRadii(node), width, height);
  return tl > 0 || tr > 0 || br > 0 || bl > 0;
}

/** Border fills for rounded rectangle / frame per-side strokes. */
export function roundedRectBorderFills(
  node: Pick<
    EditorNode,
    | "type"
    | "width"
    | "height"
    | "strokeWidth"
    | "strokeSides"
    | "strokeSidesCustom"
    | "strokePosition"
    | "cornerRadius"
    | "cornerRadii"
    | "cornerSmoothing"
  >,
): BorderSideFill[] | null {
  if (node.type !== "rectangle" && node.type !== "frame") return null;
  if (!shapeHasCornerRadius(node, node.width, node.height)) return null;

  const sideWidths = resolveStrokeSideWidths(node);
  const sides = resolveStrokeSides(node);
  const hasActive = SIDE_ORDER.some((s) => sides[s] && sideWidths[s] > 0);
  if (!hasActive) return null;

  const radii = getNodeCornerRadii(node);
  const smoothing = node.cornerSmoothing ?? 0;
  const position = node.strokePosition ?? "center";

  const fills = buildRoundedRectBorderFills({
    width: node.width,
    height: node.height,
    radii,
    sides,
    sideWidths,
    position,
    smoothing,
  });
  return fills.length > 0 ? fills : null;
}
