import type { StrokeAlign } from "@/lib/strokeSpec";
import { expandOpenPolylineStroke } from "@/lib/outlineStroke";
import type { StrokeLinejoin } from "@/lib/stroke";
import { pointsToClosedPathD } from "@/lib/strokeOffset";
import {
  clampRoundedRectRadii,
  cornerExtentAlongSide,
  normalizeRoundedRectRadii,
  openPathFromPoints,
  roundedRectCornerPolyline,
  sideJoin,
  type RoundedRectRadii,
} from "@/lib/vector/roundedRectPath";

export type RectStrokeSide = "top" | "right" | "bottom" | "left";

export type StrokeSideFlags = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

export const DEFAULT_STROKE_SIDES: StrokeSideFlags = {
  top: true,
  right: true,
  bottom: true,
  left: true,
};

/** Enable thin red centerline overlay to verify side stroke follows rounded contour. */
export const ROUNDED_RECT_SIDE_STROKE_DEBUG =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_CRAFT_RR_SIDE_STROKE_DEBUG === "true";

export type RoundedRectStrokeSegmentParams = {
  width: number;
  height: number;
  radius: number | RoundedRectRadii;
  smoothing?: number;
  strokeSides?: StrokeSideFlags;
  strokePosition?: StrokeAlign;
  strokeWidth?: number;
  origin?: { x: number; y: number };
};

export type RoundedRectStrokeSegment = {
  side: RectStrokeSide;
  d: string;
};

export type RoundedRectStrokeSegmentBand = RoundedRectStrokeSegment & {
  fillPathD: string;
  fillRule: "nonzero";
};

const EPS = 1e-6;

type Point2 = { x: number; y: number };

export function allStrokeSidesEnabled(sides: StrokeSideFlags): boolean {
  return sides.top && sides.right && sides.bottom && sides.left;
}

export function normalizeStrokeSideFlags(
  sides?: Partial<StrokeSideFlags>,
): StrokeSideFlags {
  return {
    top: sides?.top ?? true,
    right: sides?.right ?? true,
    bottom: sides?.bottom ?? true,
    left: sides?.left ?? true,
  };
}

function appendPoints(out: Point2[], pts: Point2[]): void {
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > EPS) out.push({ x: p.x, y: p.y });
  }
}

function cornerPortion(adjacentActive: boolean, role: "start" | "end"): "full" | "first" | "second" {
  if (!adjacentActive) return "full";
  return role === "start" ? "second" : "first";
}

function buildTopSidePoints(
  width: number,
  height: number,
  radii: RoundedRectRadii,
  smoothing: number,
  sides: StrokeSideFlags,
  ox: number,
  oy: number,
): Point2[] {
  const [tl, tr] = [radii.topLeft, radii.topRight];
  const pts: Point2[] = [];

  if (tl > EPS) {
    appendPoints(
      pts,
      roundedRectCornerPolyline(
        "topLeft",
        width,
        height,
        radii,
        smoothing,
        cornerPortion(sides.left, "start"),
        { x: ox, y: oy },
      ),
    );
  } else if (sides.left) {
    pts.push({ x: ox, y: oy });
  }

  const x0 = pts.length ? pts[pts.length - 1]!.x : ox + (tl > EPS ? tl : 0);
  const pTR = cornerExtentAlongSide("topRight", width, height, radii, smoothing);
  const x1 = ox + width - (tr > EPS ? (smoothing > EPS ? pTR : tr) : 0);
  if (x1 - x0 > EPS) appendPoints(pts, [{ x: x0, y: oy }, { x: x1, y: oy }]);

  if (tr > EPS) {
    appendPoints(
      pts,
      roundedRectCornerPolyline(
        "topRight",
        width,
        height,
        radii,
        smoothing,
        cornerPortion(sides.right, "end"),
        { x: ox, y: oy },
      ),
    );
  }

  return pts;
}

function buildRightSidePoints(
  width: number,
  height: number,
  radii: RoundedRectRadii,
  smoothing: number,
  sides: StrokeSideFlags,
  ox: number,
  oy: number,
): Point2[] {
  const [, tr, br] = [radii.topLeft, radii.topRight, radii.bottomRight];
  const pts: Point2[] = [];

  if (tr > EPS) {
    appendPoints(
      pts,
      roundedRectCornerPolyline(
        "topRight",
        width,
        height,
        radii,
        smoothing,
        cornerPortion(sides.top, "start"),
        { x: ox, y: oy },
      ),
    );
  } else {
    pts.push({ x: ox + width, y: oy });
  }

  const y0 = pts.length ? pts[pts.length - 1]!.y : oy + (tr > EPS ? tr : 0);
  const pBR = cornerExtentAlongSide("bottomRight", width, height, radii, smoothing);
  const y1 = oy + height - (br > EPS ? (smoothing > EPS ? sideJoin(height, pBR) : br) : 0);
  if (y1 - y0 > EPS) appendPoints(pts, [{ x: ox + width, y: y0 }, { x: ox + width, y: y1 }]);

  if (br > EPS) {
    appendPoints(
      pts,
      roundedRectCornerPolyline(
        "bottomRight",
        width,
        height,
        radii,
        smoothing,
        cornerPortion(sides.bottom, "end"),
        { x: ox, y: oy },
      ),
    );
  }

  return pts;
}

function buildBottomSidePoints(
  width: number,
  height: number,
  radii: RoundedRectRadii,
  smoothing: number,
  sides: StrokeSideFlags,
  ox: number,
  oy: number,
): Point2[] {
  const [, , br, bl] = [radii.topLeft, radii.topRight, radii.bottomRight, radii.bottomLeft];
  const pts: Point2[] = [];

  if (br > EPS) {
    appendPoints(
      pts,
      roundedRectCornerPolyline(
        "bottomRight",
        width,
        height,
        radii,
        smoothing,
        cornerPortion(sides.right, "start"),
        { x: ox, y: oy },
      ),
    );
  } else {
    pts.push({ x: ox + width, y: oy + height });
  }

  const x0 = pts.length ? pts[pts.length - 1]!.x : ox + width - (br > EPS ? br : 0);
  const pBL = cornerExtentAlongSide("bottomLeft", width, height, radii, smoothing);
  const x1 = ox + (bl > EPS ? (smoothing > EPS ? sideJoin(width, pBL) : bl) : 0);
  if (x0 - x1 > EPS) appendPoints(pts, [{ x: x0, y: oy + height }, { x: x1, y: oy + height }]);

  if (bl > EPS) {
    appendPoints(
      pts,
      roundedRectCornerPolyline(
        "bottomLeft",
        width,
        height,
        radii,
        smoothing,
        cornerPortion(sides.left, "end"),
        { x: ox, y: oy },
      ),
    );
  }

  return pts;
}

function buildLeftSidePoints(
  width: number,
  height: number,
  radii: RoundedRectRadii,
  smoothing: number,
  sides: StrokeSideFlags,
  ox: number,
  oy: number,
): Point2[] {
  const [tl, , , bl] = [radii.topLeft, radii.topRight, radii.bottomRight, radii.bottomLeft];
  const pts: Point2[] = [];

  if (bl > EPS) {
    appendPoints(
      pts,
      roundedRectCornerPolyline(
        "bottomLeft",
        width,
        height,
        radii,
        smoothing,
        cornerPortion(sides.bottom, "start"),
        { x: ox, y: oy },
      ),
    );
  } else {
    pts.push({ x: ox, y: oy + height });
  }

  const y0 = pts.length ? pts[pts.length - 1]!.y : oy + height - (bl > EPS ? bl : 0);
  const pTL = cornerExtentAlongSide("topLeft", width, height, radii, smoothing);
  const y1 = oy + (tl > EPS ? (smoothing > EPS ? sideJoin(height, pTL) : tl) : 0);
  if (y0 - y1 > EPS) appendPoints(pts, [{ x: ox, y: y0 }, { x: ox, y: y1 }]);

  if (tl > EPS) {
    appendPoints(
      pts,
      roundedRectCornerPolyline(
        "topLeft",
        width,
        height,
        radii,
        smoothing,
        cornerPortion(sides.top, "end"),
        { x: ox, y: oy },
      ),
    );
  }

  return pts;
}

const SIDE_BUILDERS = {
  top: buildTopSidePoints,
  right: buildRightSidePoints,
  bottom: buildBottomSidePoints,
  left: buildLeftSidePoints,
} as const;

function sideContourPathD(
  side: RectStrokeSide,
  width: number,
  height: number,
  radii: RoundedRectRadii,
  smoothing: number,
  sides: StrokeSideFlags,
  ox: number,
  oy: number,
): string {
  const points = SIDE_BUILDERS[side](width, height, radii, smoothing, sides, ox, oy);
  if (points.length < 2) return "";
  return openPathFromPoints(points);
}

/**
 * Build independent open stroke paths for each enabled side of a rounded rectangle.
 * Returns an empty array when all sides are enabled (use full closed stroke instead).
 * Paths follow the same rounded contour as {@link buildRoundedRectPath} (cubic curves).
 */
export function buildRoundedRectStrokeSegments(
  params: RoundedRectStrokeSegmentParams,
): RoundedRectStrokeSegment[] {
  const width = Math.max(0, params.width);
  const height = Math.max(0, params.height);
  if (width <= 0 || height <= 0) return [];

  const sides = normalizeStrokeSideFlags(params.strokeSides);
  if (allStrokeSidesEnabled(sides)) return [];

  const smoothing = Math.max(0, Math.min(1, params.smoothing ?? 0));
  const radii = clampRoundedRectRadii(normalizeRoundedRectRadii(params.radius), width, height);
  const ox = params.origin?.x ?? 0;
  const oy = params.origin?.y ?? 0;

  const segments: RoundedRectStrokeSegment[] = [];
  for (const side of ["top", "right", "bottom", "left"] as const) {
    if (!sides[side]) continue;
    const d = sideContourPathD(side, width, height, radii, smoothing, sides, ox, oy);
    if (!d) continue;
    segments.push({ side, d });
  }

  return segments;
}

/** Expand side contour paths into filled stroke bands (export / legacy). */
export function buildRoundedRectStrokeSegmentBands(
  params: RoundedRectStrokeSegmentParams,
  join: StrokeLinejoin = "round",
): RoundedRectStrokeSegmentBand[] {
  const strokeWidth = Math.max(0, params.strokeWidth ?? 0);
  if (strokeWidth <= EPS) return [];

  const align = params.strokePosition ?? "center";
  const segments = buildRoundedRectStrokeSegments(params);
  if (segments.length === 0) return [];

  const width = params.width;
  const height = params.height;

  return segments
    .map((segment) => {
      const sides = normalizeStrokeSideFlags(params.strokeSides);
      const radii = clampRoundedRectRadii(normalizeRoundedRectRadii(params.radius), width, height);
      const smoothing = Math.max(0, Math.min(1, params.smoothing ?? 0));
      const centerlinePts = SIDE_BUILDERS[segment.side](
        width,
        height,
        radii,
        smoothing,
        sides,
        params.origin?.x ?? 0,
        params.origin?.y ?? 0,
      );
      if (centerlinePts.length < 2) return null;

      const outline = expandOpenPolylineStroke(
        centerlinePts,
        { width: strokeWidth, align, join, cap: "butt" },
        { width, height },
      );
      if (outline.length < 3) return null;
      return {
        ...segment,
        fillPathD: pointsToClosedPathD(outline),
        fillRule: "nonzero" as const,
      };
    })
    .filter((band): band is RoundedRectStrokeSegmentBand => band != null);
}
